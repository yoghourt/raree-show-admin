/**
 * One-shot LocalAI Discovery prompt debug:
 *   npx tsx scripts/discovery-provider-eval/debug-localai-one.ts
 */
import { readFileSync } from "node:fs";

function loadEnvLocal(): void {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim();
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    /* optional */
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const model =
    process.env.DISCOVERY_EVAL_LOCALAI_MODEL?.trim() || "qwen3.5-9b-dflash";
  const base =
    process.env.DISCOVERY_EVAL_LOCALAI_BASE?.trim() || "http://127.0.0.1:8080";
  const type = (process.env.DISCOVERY_EVAL_DEBUG_TYPE?.trim() ||
    "character") as "character" | "location" | "story" | "scene";

  const { buildZhPrologueNarrative, EVAL_WORK_TITLE } = await import(
    "./fixture"
  );
  const { buildProposePrompt } = await import(
    "@/lib/discovery/propose-service"
  );
  const { createLocalAiEvalClient } = await import("./llm-clients");
  const { parseCandidateArray } = await import(
    "@/lib/discovery/propose-parse"
  );

  const narrative = buildZhPrologueNarrative();
  const prompt = buildProposePrompt({
    workTitle: EVAL_WORK_TITLE,
    narrative,
    candidateType: type,
  });
  console.info("model=%s type=%s prompt_len=%d", model, type, prompt.length);

  const call = createLocalAiEvalClient({ baseUrl: base, model });
  const t0 = Date.now();
  const raw = await call(prompt);
  console.info("ms=%d raw_len=%d", Date.now() - t0, raw.length);
  console.info("RAW_PREVIEW:\n%s", raw.slice(0, 800));
  try {
    const items = parseCandidateArray(raw, type);
    console.info("PARSED count=%d", items.length);
  } catch (err) {
    console.info(
      "PARSE_FAIL %s",
      err instanceof Error ? err.message : String(err)
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
