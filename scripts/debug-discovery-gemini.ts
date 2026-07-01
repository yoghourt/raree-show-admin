/**
 * Debug one Gemini propose call — prints raw LLM output or error.
 *   npx tsx scripts/debug-discovery-gemini.ts
 */

import { readFileSync } from "node:fs";
import path from "node:path";

function loadEnvLocal(): void {
  const envPath = path.resolve(".env.local");
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main(): Promise<void> {
  loadEnvLocal();

  const { callCopilotTextLlm } = await import("@/lib/ai/copilot-text-llm");
  const { parseCandidateArray } = await import("@/lib/discovery/propose-parse");

  const prompt = `Return ONLY valid JSON object with key "candidates" (array of 1 item).
Candidate type: character
Example: {"candidates":[{"displayName":"Arya Stark","summary":"Young Stark.","fields":{"name":"Arya Stark","house":"Stark"}}]}
Work: Smoke Test
Narrative excerpt: The north remembers old oaths and colder winters beyond the wall.`;

  console.info("model=%s", process.env.GEMINI_SUGGEST_MODEL);

  try {
    const raw = await callCopilotTextLlm(prompt, { geminiJsonObject: true });
    console.info("SUCCESS raw_len=%d", raw.length);
    console.info("RAW:\n%s", raw);
    const items = parseCandidateArray(raw, "character");
    console.info("PARSED count=%d", items.length);
  } catch (err) {
    console.error("FAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

main().catch(console.error);
