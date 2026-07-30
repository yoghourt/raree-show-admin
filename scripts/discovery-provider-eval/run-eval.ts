/**
 * Discovery Runtime Provider Evaluation runner (eval-only).
 *
 *   npx tsx scripts/discovery-provider-eval/run-eval.ts
 *
 * Env:
 *   DISCOVERY_EVAL_RUNS          default 5 (protocol target 10)
 *   DISCOVERY_EVAL_CANDIDATES    comma list: A,B,C  (default A,C — B needs text model)
 *   DISCOVERY_EVAL_LOCALAI_BASE  default http://127.0.0.1:8080
 *   DISCOVERY_EVAL_LOCALAI_MODEL optional chat model id
 *
 * Does NOT change production Discovery defaults or SPECs.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  capCandidatesByType,
  dedupeCandidates,
  filterScenesWithValidParents,
  normalizeRawCandidate,
} from "@/lib/discovery/candidate-validate";
import { DISCOVERY_CANDIDATE_TYPES } from "@/lib/discovery/propose-types";
import type {
  DiscoveryCandidate,
  DiscoveryCandidateType,
  SceneCandidateFields,
} from "@/lib/discovery/propose-types";
import { parseCandidateArray } from "@/lib/discovery/propose-parse";
import { buildProposePrompt } from "@/lib/discovery/propose-service";
import type { NarrativeInputBundle } from "@/lib/discovery/types";

import {
  buildZhPrologueNarrative,
  EVAL_WORK_ID,
  EVAL_WORK_TITLE,
} from "./fixture";
import {
  createGeminiEvalClient,
  createLocalAiEvalClient,
  createOpenRouterEvalClient,
  probeLocalAiModels,
  type EvalLlmCall,
} from "./llm-clients";
import {
  classifyFailure,
  emptyFailureHistogram,
  mean,
  percentile,
} from "./metrics";
import { scoreProvisionalQuality } from "./quality-rubric";
import type {
  CandidateAggregate,
  EvalCandidateId,
  ProposeRunResult,
  TypeTiming,
} from "./types";

function loadEnvLocal(): void {
  const envPath = path.resolve(".env.local");
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) {
        continue;
      }
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    console.warn("[eval] no .env.local");
  }
}

async function generateTypeWithClient(params: {
  callLlm: EvalLlmCall;
  workId: string;
  workTitle: string;
  narrative: NarrativeInputBundle;
  candidateType: DiscoveryCandidateType;
  storyCandidates: DiscoveryCandidate[];
}): Promise<{
  candidates: DiscoveryCandidate[];
  timing: TypeTiming;
}> {
  const { candidateType, storyCandidates } = params;
  const t0 = Date.now();

  if (candidateType === "scene" && storyCandidates.length === 0) {
    return {
      candidates: [],
      timing: {
        candidateType,
        timingMs: Date.now() - t0,
        candidateCount: 0,
        jsonParseOk: true,
        schemaOk: false,
        failureClass: "model_generation",
        errorCode: "SCENE_REQUIRES_STORY",
        errorMessage: "Scene propose requires Story candidates",
      },
    };
  }

  try {
    const prompt = buildProposePrompt({
      workTitle: params.workTitle,
      narrative: params.narrative,
      candidateType,
      storyCandidates:
        candidateType === "scene" ? storyCandidates : undefined,
    });
    const raw = await params.callLlm(prompt);
    let items: unknown[];
    try {
      items = parseCandidateArray(raw, candidateType);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        candidates: [],
        timing: {
          candidateType,
          timingMs: Date.now() - t0,
          candidateCount: 0,
          jsonParseOk: false,
          schemaOk: false,
          failureClass: "json_formatting",
          errorCode: "GENERATION_PARSE_FAILED",
          errorMessage: message,
        },
      };
    }

    const storyIds = new Set(storyCandidates.map((c) => c.candidateId));
    const candidates: DiscoveryCandidate[] = [];
    const validationErrors: string[] = [];

    for (const item of items) {
      const normalized = normalizeRawCandidate(
        item,
        candidateType,
        params.workId
      );
      if (!normalized.ok) {
        validationErrors.push(...normalized.errors);
        continue;
      }
      if (candidateType === "scene") {
        const parentId = (normalized.candidate.fields as SceneCandidateFields)
          .parentStoryCandidateId;
        if (!storyIds.has(parentId)) {
          validationErrors.push(
            `parentStoryCandidateId "${parentId}" not in story set`
          );
          continue;
        }
      }
      candidates.push(normalized.candidate);
    }

    const capped = capCandidatesByType(dedupeCandidates(candidates));
    if (items.length > 0 && capped.length === 0) {
      return {
        candidates: [],
        timing: {
          candidateType,
          timingMs: Date.now() - t0,
          candidateCount: 0,
          jsonParseOk: true,
          schemaOk: false,
          failureClass: "schema_validation",
          errorCode: "GENERATION_PARSE_FAILED",
          errorMessage: validationErrors[0] ?? "schema validation empty",
        },
      };
    }

    return {
      candidates: capped,
      timing: {
        candidateType,
        timingMs: Date.now() - t0,
        candidateCount: capped.length,
        jsonParseOk: true,
        schemaOk: true,
        failureClass: "none",
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      candidates: [],
      timing: {
        candidateType,
        timingMs: Date.now() - t0,
        candidateCount: 0,
        jsonParseOk: false,
        schemaOk: false,
        failureClass: classifyFailure("GENERATION_FAILED", message),
        errorCode: "GENERATION_FAILED",
        errorMessage: message,
      },
    };
  }
}

async function runOnePropose(params: {
  callLlm: EvalLlmCall;
  candidateId: EvalCandidateId;
  provider: string;
  model: string;
  runtime: string;
  runIndex: number;
  narrative: NarrativeInputBundle;
}): Promise<ProposeRunResult> {
  const all: DiscoveryCandidate[] = [];
  const byType: TypeTiming[] = [];
  const t0 = Date.now();

  for (const candidateType of DISCOVERY_CANDIDATE_TYPES) {
    const storyCandidates = all.filter((c) => c.candidateType === "story");
    const { candidates, timing } = await generateTypeWithClient({
      callLlm: params.callLlm,
      workId: EVAL_WORK_ID,
      workTitle: EVAL_WORK_TITLE,
      narrative: params.narrative,
      candidateType,
      storyCandidates,
    });
    all.push(...candidates);
    byType.push(timing);
    console.info(
      "[eval] %s run=%d type=%s ms=%d n=%d fail=%s%s",
      params.candidateId,
      params.runIndex,
      candidateType,
      timing.timingMs,
      timing.candidateCount,
      timing.failureClass,
      timing.errorMessage ? ` err=${timing.errorMessage.slice(0, 120)}` : ""
    );
  }

  const filtered = filterScenesWithValidParents(
    capCandidatesByType(dedupeCandidates(all))
  );
  const quality = scoreProvisionalQuality(filtered);

  return {
    runIndex: params.runIndex,
    candidateId: params.candidateId,
    provider: params.provider,
    model: params.model,
    runtime: params.runtime,
    totalMs: Date.now() - t0,
    typesOk: byType.filter((t) => t.candidateCount > 0).length,
    candidateCount: filtered.length,
    jsonParseSuccessTypes: byType.filter((t) => t.jsonParseOk).length,
    schemaSuccessTypes: byType.filter((t) => t.schemaOk).length,
    byType,
    provisionalQuality: quality,
  };
}

function aggregate(
  candidateId: EvalCandidateId,
  meta: {
    provider: string;
    model: string;
    runtime: string;
    hardwareNote: string;
    configuration: Record<string, string>;
    estimatedUsdPerFullPropose: number | null;
    blockedReason?: string;
  },
  runs: ProposeRunResult[]
): CandidateAggregate {
  const hist = emptyFailureHistogram();
  for (const run of runs) {
    for (const t of run.byType) {
      hist[t.failureClass] += 1;
    }
  }

  const totals = runs.map((r) => r.totalMs).sort((a, b) => a - b);
  const typeSlots = runs.length * 4;
  const jsonOk = runs.reduce((s, r) => s + r.jsonParseSuccessTypes, 0);
  const schemaOk = runs.reduce((s, r) => s + r.schemaSuccessTypes, 0);
  const fullOk = runs.filter((r) => r.typesOk === 4).length;
  const q = mean(runs.map((r) => r.provisionalQuality.overall));

  let recommendation: CandidateAggregate["recommendation"] =
    "continue_evaluation";
  if (meta.blockedReason) {
    recommendation = "continue_evaluation";
  } else if (runs.length >= 3) {
    const jsonRate = typeSlots ? jsonOk / typeSlots : 0;
    const fullRate = runs.length ? fullOk / runs.length : 0;
    const p50 = percentile(totals, 0.5) ?? Infinity;
    if (jsonRate >= 0.9 && fullRate >= 0.8 && p50 <= 90_000 && (q ?? 0) >= 3.5) {
      recommendation = "approve_production_candidate";
    } else if (jsonRate < 0.5 || fullRate < 0.3 || p50 > 300_000) {
      recommendation = "reject_candidate";
    }
  }

  return {
    candidateId,
    ...meta,
    runs: runs.length,
    totalMs: totals,
    p50TotalMs: percentile(totals, 0.5),
    p95TotalMs: percentile(totals, 0.95),
    meanTotalMs: mean(totals),
    jsonParseSuccessRate: typeSlots ? jsonOk / typeSlots : null,
    schemaSuccessRate: typeSlots ? schemaOk / typeSlots : null,
    typeCoverageSuccessRate: runs.length ? fullOk / runs.length : null,
    meanProvisionalQuality: q,
    failureHistogram: hist,
    blockedReason: meta.blockedReason,
    recommendation,
  };
}

/** Gemini 2.5 Flash approx input+output blended for short Discovery prompts. */
const GEMINI_FLASH_USD_PER_FULL_PROPOSE = 0.002;
/** OpenRouter free tier. */
const OPENROUTER_FREE_USD = 0;

async function main(): Promise<void> {
  loadEnvLocal();
  delete process.env.DISCOVERY_PROPOSE_MODE;

  const runsN = Math.max(
    1,
    parseInt(process.env.DISCOVERY_EVAL_RUNS ?? "5", 10) || 5
  );
  const want = new Set(
    (process.env.DISCOVERY_EVAL_CANDIDATES ?? "A,C")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  );

  const narrative = buildZhPrologueNarrative();
  const outDir = path.resolve(
    "docs/findings/discovery-provider-eval-runs"
  );
  mkdirSync(outDir, { recursive: true });

  const allRuns: ProposeRunResult[] = [];
  const aggregates: CandidateAggregate[] = [];

  // ---- Candidate A: Gemini 2.5 Flash ----
  if (want.has("A")) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error("GEMINI_API_KEY required for Candidate A");
    const model =
      process.env.DISCOVERY_EVAL_GEMINI_MODEL?.trim() ||
      process.env.GEMINI_SUGGEST_MODEL?.trim() ||
      "gemini-2.5-flash";
    const callLlm = createGeminiEvalClient(model, apiKey);
    const runs: ProposeRunResult[] = [];
    for (let i = 1; i <= runsN; i++) {
      console.info("\n=== Candidate A Gemini run %d/%d ===", i, runsN);
      const result = await runOnePropose({
        callLlm,
        candidateId: "A_gemini_flash",
        provider: "gemini",
        model,
        runtime: "Google Gemini OpenAI-compat API",
        runIndex: i,
        narrative,
      });
      runs.push(result);
      allRuns.push(result);
    }
    aggregates.push(
      aggregate("A_gemini_flash", {
        provider: "gemini",
        model,
        runtime: "Google Generative Language API (OpenAI-compat)",
        hardwareNote: "Cloud — Google-managed",
        configuration: {
          response_format: "json_object",
          max_rpm: String(
            Math.min(
              15,
              parseInt(process.env.DISCOVERY_EVAL_GEMINI_RPM ?? "15", 10) || 15
            )
          ),
          eval_client: "scripts/discovery-provider-eval/llm-clients.ts",
          prompt: "lib/discovery/propose-service buildProposePrompt",
        },
        estimatedUsdPerFullPropose: GEMINI_FLASH_USD_PER_FULL_PROPOSE,
      }, runs)
    );
  }

  // ---- Candidate C: low-cost cloud (OpenRouter free) ----
  if (want.has("C")) {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) throw new Error("OPENROUTER_API_KEY required for Candidate C");
    const model =
      process.env.OPENROUTER_SUGGEST_MODEL?.trim() ||
      "openai/gpt-oss-20b:free";
    const callLlm = createOpenRouterEvalClient(model, apiKey);
    const runs: ProposeRunResult[] = [];
    for (let i = 1; i <= runsN; i++) {
      console.info("\n=== Candidate C OpenRouter run %d/%d ===", i, runsN);
      const result = await runOnePropose({
        callLlm,
        candidateId: "C_openrouter_free",
        provider: "openrouter",
        model,
        runtime: "OpenRouter chat completions",
        runIndex: i,
        narrative,
      });
      runs.push(result);
      allRuns.push(result);
    }
    aggregates.push(
      aggregate("C_openrouter_free", {
        provider: "openrouter",
        model,
        runtime: "OpenRouter (free-tier routing)",
        hardwareNote: "Cloud — third-party free pool (variable capacity)",
        configuration: {
          response_format: "none (free models)",
          eval_client: "scripts/discovery-provider-eval/llm-clients.ts",
        },
        estimatedUsdPerFullPropose: OPENROUTER_FREE_USD,
      }, runs)
    );
  }

  // ---- Candidate B: LocalAI text ----
  if (want.has("B")) {
    const base =
      process.env.DISCOVERY_EVAL_LOCALAI_BASE?.trim() ||
      process.env.IMAGE_CREATOR_LOCALAI_BASE?.trim() ||
      "http://127.0.0.1:8080";
    const probe = await probeLocalAiModels(base);
    const configuredModel = process.env.DISCOVERY_EVAL_LOCALAI_MODEL?.trim();
    const imageLike = /flux|sd-|dreamshaper|stable-diffusion|image/i;
    const chatCandidates = probe.modelIds.filter((id) => !imageLike.test(id));
    const model = configuredModel || chatCandidates[0];

    if (!probe.ok) {
      aggregates.push(
        aggregate(
          "B_localai",
          {
            provider: "localai",
            model: "(none)",
            runtime: "LocalAI OpenAI-compat",
            hardwareNote: "localhost — probe failed",
            configuration: { base },
            estimatedUsdPerFullPropose: 0,
            blockedReason: `LocalAI unreachable: ${probe.error}`,
          },
          []
        )
      );
    } else if (!model) {
      aggregates.push(
        aggregate(
          "B_localai",
          {
            provider: "localai",
            model: "(no chat model loaded)",
            runtime: "LocalAI OpenAI-compat /v1/chat/completions",
            hardwareNote:
              "Apple Silicon host (arm64); LocalAI currently serving image models only",
            configuration: {
              base,
              listed_models: probe.modelIds.join(","),
              required:
                "Load a chat/instruct GGUF (e.g. qwen2.5-7b-instruct, llama-3.2-3b-instruct) before re-run",
            },
            estimatedUsdPerFullPropose: 0,
            blockedReason:
              "No text/chat model available on LocalAI — only image models listed; chat probe previously hung/timed out on image model ids",
          },
          []
        )
      );
    } else {
      const callLlm = createLocalAiEvalClient({
        baseUrl: base,
        model,
        apiKey: process.env.IMAGE_CREATOR_LOCALAI_KEY?.trim(),
      });
      const runs: ProposeRunResult[] = [];
      for (let i = 1; i <= runsN; i++) {
        console.info("\n=== Candidate B LocalAI run %d/%d ===", i, runsN);
        const result = await runOnePropose({
          callLlm,
          candidateId: "B_localai",
          provider: "localai",
          model,
          runtime: "LocalAI OpenAI-compat (eval-only)",
          runIndex: i,
          narrative,
        });
        runs.push(result);
        allRuns.push(result);
      }
      aggregates.push(
        aggregate(
          "B_localai",
          {
            provider: "localai",
            model,
            runtime: "LocalAI OpenAI-compat /v1/chat/completions",
            hardwareNote: "localhost arm64 — operator machine",
            configuration: { base, model },
            estimatedUsdPerFullPropose: 0,
          },
          runs
        )
      );
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const artifact = {
    protocol: "discovery-runtime-provider-evaluation-v1",
    ranAt: new Date().toISOString(),
    runsRequested: runsN,
    fixture: {
      workId: EVAL_WORK_ID,
      workTitle: EVAL_WORK_TITLE,
      narrativeChars: narrative.excerpts[0]?.text.length ?? 0,
    },
    note: "Production Discovery provider defaults were NOT changed.",
    aggregates,
    runs: allRuns,
  };

  const jsonPath = path.join(outDir, `eval-${stamp}.json`);
  writeFileSync(jsonPath, JSON.stringify(artifact, null, 2), "utf8");
  writeFileSync(
    path.join(outDir, "latest.json"),
    JSON.stringify(artifact, null, 2),
    "utf8"
  );
  console.info("\n[eval] wrote %s", jsonPath);
  console.info("[eval] aggregates:");
  for (const a of aggregates) {
    console.info(
      "  %s runs=%d p50=%s json=%s full4=%s quality=%s rec=%s%s",
      a.candidateId,
      a.runs,
      a.p50TotalMs != null ? `${Math.round(a.p50TotalMs)}ms` : "n/a",
      a.jsonParseSuccessRate != null
        ? (a.jsonParseSuccessRate * 100).toFixed(0) + "%"
        : "n/a",
      a.typeCoverageSuccessRate != null
        ? (a.typeCoverageSuccessRate * 100).toFixed(0) + "%"
        : "n/a",
      a.meanProvisionalQuality?.toFixed(1) ?? "n/a",
      a.recommendation,
      a.blockedReason ? ` BLOCKED:${a.blockedReason}` : ""
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
