/**
 * A/B: same Discovery propose prompt/narrative × OpenRouter vs Gemini.
 *
 *   npx tsx scripts/ab-discovery-propose-providers.ts
 *
 * Uses .env.local keys; forces COPILOT_TEXT_PROVIDER per arm.
 * Prints per-type timing (via DISCOVERY_PROPOSE_TIMING=1) + summary table.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

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
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    console.warn("No .env.local — using process env only");
  }
}

/** Chinese AGoT-prologue-style excerpt (≥512) — matches live Discovery failure context. */
function chinesePrologueFixture(minLen: number): string {
  const unit = [
    "三名守夜人——经验丰富的年轻老兵威尔、谨慎的老兵盖雷德，以及年轻骑士威玛·罗伊斯——",
    "正深入绝境长城以北的鬼影森林执行巡逻任务。",
    "他们发现一处被遗弃的野人营地，尸体却在转眼间消失。",
    "威玛坚持追查，却在林间遭遇异鬼；决斗后他倒下，又重新站起，已成尸鬼。",
    "威尔目睹这一切后逃回长城，心中只剩恐惧与誓言。",
  ].join("");
  let out = "";
  while (out.length < minLen) {
    out += unit + "\n";
  }
  return out.slice(0, Math.max(minLen, unit.length));
}

type Arm = {
  id: "openrouter" | "gemini";
  provider: "openrouter" | "gemini";
  modelEnv: string;
  modelFallback: string;
};

const ARMS: Arm[] = [
  {
    id: "openrouter",
    provider: "openrouter",
    modelEnv: "OPENROUTER_SUGGEST_MODEL",
    modelFallback: "meta-llama/llama-3.3-70b-instruct:free",
  },
  {
    id: "gemini",
    provider: "gemini",
    modelEnv: "GEMINI_SUGGEST_MODEL",
    modelFallback: "gemini-2.5-flash",
  },
];

type TypeResult = {
  candidateType: string;
  count: number;
  errorCode?: string;
  errorMessage?: string;
};

type ArmResult = {
  arm: string;
  provider: string;
  model: string;
  totalMs: number;
  candidates: number;
  errors: number;
  byType: TypeResult[];
  okTypes: number;
};

async function runArm(
  arm: Arm,
  narrative: {
    excerpts: { text: string; orderIndex: number }[];
    operatorSummary: null;
    inputMode: "excerpt_bundle";
    summaryAttested: false;
  },
  proposeAllCandidateTypes: typeof import("@/lib/discovery/propose-service").proposeAllCandidateTypes
): Promise<ArmResult> {
  process.env.COPILOT_TEXT_PROVIDER = arm.provider;
  process.env.DISCOVERY_PROPOSE_TIMING = "1";
  process.env.DISCOVERY_PROPOSE_DEBUG = "1";
  delete process.env.DISCOVERY_PROPOSE_MODE;

  const model =
    process.env[arm.modelEnv]?.trim() || arm.modelFallback;

  console.info("\n========== ARM %s ==========", arm.id);
  console.info("provider=%s model=%s", arm.provider, model);

  const started = Date.now();
  const { candidates, errors } = await proposeAllCandidateTypes({
    workId: "ab-discovery-work",
    workTitle: "A Song of Ice and Fire (AB fixture)",
    narrative,
  });
  const totalMs = Date.now() - started;

  const types = ["character", "location", "story", "scene"] as const;
  const byType: TypeResult[] = types.map((candidateType) => {
    const count = candidates.filter((c) => c.candidateType === candidateType)
      .length;
    const err = errors.find((e) => e.candidateType === candidateType);
    return {
      candidateType,
      count,
      errorCode: err?.code,
      errorMessage: err?.message,
    };
  });

  const okTypes = byType.filter((t) => t.count > 0 && !t.errorCode).length;

  console.info(
    "[ab] arm=%s total_ms=%d candidates=%d errors=%d ok_types=%d/4",
    arm.id,
    totalMs,
    candidates.length,
    errors.length,
    okTypes
  );
  for (const row of byType) {
    console.info(
      "  %s: n=%d%s",
      row.candidateType,
      row.count,
      row.errorCode ? ` FAIL ${row.errorCode}: ${row.errorMessage}` : ""
    );
  }

  return {
    arm: arm.id,
    provider: arm.provider,
    model,
    totalMs,
    candidates: candidates.length,
    errors: errors.length,
    byType,
    okTypes,
  };
}

async function main(): Promise<void> {
  loadEnvLocal();

  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error("OPENROUTER_API_KEY missing");
  }
  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error("GEMINI_API_KEY missing");
  }

  const { EXCERPT_BUNDLE_MIN_PROSE } = await import(
    "@/lib/discovery/constants"
  );
  const { proposeAllCandidateTypes } = await import(
    "@/lib/discovery/propose-service"
  );

  const prose = chinesePrologueFixture(EXCERPT_BUNDLE_MIN_PROSE);
  const narrative = {
    excerpts: [{ text: prose, orderIndex: 0 }],
    operatorSummary: null,
    inputMode: "excerpt_bundle" as const,
    summaryAttested: false,
  };

  console.info(
    "[ab-discovery] narrative_chars=%d fixture=zh-prologue",
    prose.length
  );
  console.info(
    "[ab-discovery] openrouter_model=%s gemini_model=%s",
    process.env.OPENROUTER_SUGGEST_MODEL?.trim() || "(default)",
    process.env.GEMINI_SUGGEST_MODEL?.trim() || "gemini-2.5-flash"
  );

  const results: ArmResult[] = [];
  for (const arm of ARMS) {
    results.push(await runArm(arm, narrative, proposeAllCandidateTypes));
  }

  console.info("\n========== SUMMARY ==========");
  console.info(
    [
      "arm".padEnd(12),
      "model".padEnd(28),
      "total_ms".padStart(8),
      "cands".padStart(6),
      "errs".padStart(6),
      "okTypes".padStart(8),
    ].join(" ")
  );
  for (const r of results) {
    console.info(
      [
        r.arm.padEnd(12),
        r.model.slice(0, 28).padEnd(28),
        String(r.totalMs).padStart(8),
        String(r.candidates).padStart(6),
        String(r.errors).padStart(6),
        `${r.okTypes}/4`.padStart(8),
      ].join(" ")
    );
  }

  const outPath = path.resolve(
    "docs/findings/ab-discovery-propose-providers.json"
  );
  try {
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          narrativeChars: prose.length,
          narrativePreview: prose.slice(0, 120),
          results,
        },
        null,
        2
      ),
      "utf8"
    );
    console.info("[ab-discovery] wrote %s", outPath);
  } catch (err) {
    console.warn(
      "[ab-discovery] could not write findings json:",
      err instanceof Error ? err.message : err
    );
  }

  const openrouter = results.find((r) => r.arm === "openrouter");
  const gemini = results.find((r) => r.arm === "gemini");
  if (openrouter && gemini) {
    const winner =
      gemini.okTypes !== openrouter.okTypes
        ? gemini.okTypes > openrouter.okTypes
          ? "gemini (parse success)"
          : "openrouter (parse success)"
        : gemini.totalMs < openrouter.totalMs
          ? "gemini (faster, same okTypes)"
          : "openrouter (faster, same okTypes)";
    console.info("[ab-discovery] winner_by_okTypes_then_latency=%s", winner);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
