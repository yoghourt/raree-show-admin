/**
 * One-shot Discovery propose LLM smoke — run from repo root:
 *   npx tsx scripts/test-discovery-propose-llm.ts
 *
 * Loads .env.local (ignores DISCOVERY_PROPOSE_MODE=mock).
 */

import { readFileSync } from "node:fs";
import path from "node:path";

function loadEnvLocal(): void {
  const envPath = path.resolve(".env.local");
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    console.warn("No .env.local found — using process env only");
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  delete process.env.DISCOVERY_PROPOSE_MODE;

  const { EXCERPT_BUNDLE_MIN_PROSE } = await import("@/lib/discovery/constants");
  const { proposeAllCandidateTypes } = await import(
    "@/lib/discovery/propose-service"
  );

  function makeProse(length: number): string {
    const unit =
      "The north remembers old oaths and colder winters. ";
    let out = "";
    while (out.length < length) out += unit;
    return out.slice(0, length);
  }

  const narrative = {
    excerpts: [{ text: makeProse(EXCERPT_BUNDLE_MIN_PROSE), orderIndex: 0 }],
    operatorSummary: null,
    inputMode: "excerpt_bundle" as const,
    summaryAttested: false,
  };

  const provider = process.env.COPILOT_TEXT_PROVIDER ?? "(auto)";
  const model =
    provider === "openrouter"
      ? process.env.OPENROUTER_SUGGEST_MODEL ?? "(default)"
      : process.env.GEMINI_SUGGEST_MODEL ?? "(default)";

  console.info("[discovery-llm-smoke] provider=%s model=%s", provider, model);

  const started = Date.now();
  const { candidates, errors } = await proposeAllCandidateTypes({
    workId: "smoke-work",
    workTitle: "Smoke Test Work",
    narrative,
  });

  console.info("[discovery-llm-smoke] elapsed=%dms", Date.now() - started);
  console.info(
    "[discovery-llm-smoke] candidates=%d errors=%d",
    candidates.length,
    errors.length
  );

  for (const type of ["character", "location", "story", "readingRoute"] as const) {
    const count = candidates.filter((c) => c.candidateType === type).length;
    const err = errors.find((e) => e.candidateType === type);
    console.info(
      "  %s: %d candidate(s)%s",
      type,
      count,
      err ? ` — FAIL ${err.code}: ${err.message}` : ""
    );
  }

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
