# Discovery Runtime Provider Evaluation (eval-only)

**Status:** Evaluation phase — does **not** change production Discovery defaults, SPEC, or Admin wiring.

## Protocol

Identical for every candidate:

- Same fixture (`fixture.ts` zh prologue NarrativeInputBundle)
- Same `buildProposePrompt` from `lib/discovery/propose-service.ts`
- Same `parseCandidateArray` + `normalizeRawCandidate` + cap/dedupe/parent filter

## Candidates

| Id | Provider | Purpose |
|----|----------|---------|
| A | Gemini 3.5 Flash-Lite (primary cloud probe) | Cloud baseline |
| B | LocalAI + chat model | Local marginal-cost probe |
| C | OpenRouter free model | Low-cost cloud fallback probe |

## Run

```bash
# A + C, 5 runs each (default)
npx tsx scripts/discovery-provider-eval/run-eval.ts

# Protocol target 10 runs
DISCOVERY_EVAL_RUNS=10 npx tsx scripts/discovery-provider-eval/run-eval.ts

# Candidate A — Gemini 3.5 Flash-Lite @ RPM 15 (eval only)
DISCOVERY_EVAL_CANDIDATES=A \
DISCOVERY_EVAL_GEMINI_MODEL=gemini-3.5-flash-lite \
DISCOVERY_EVAL_GEMINI_RPM=15 \
DISCOVERY_EVAL_RUNS=5 \
  npx tsx scripts/discovery-provider-eval/run-eval.ts

# Include LocalAI when a chat model is loaded
DISCOVERY_EVAL_CANDIDATES=A,B,C \
DISCOVERY_EVAL_LOCALAI_BASE=http://127.0.0.1:8080 \
DISCOVERY_EVAL_LOCALAI_MODEL=qwen2.5-7b-instruct \
npx tsx scripts/discovery-provider-eval/run-eval.ts
```

### Gemini RPM (Candidate A)

- **gemini-3.5-flash-lite:** operator-confirmed **15 RPM** (default / hard max 15 via `DISCOVERY_EVAL_GEMINI_RPM`).
- Enforced as sliding window **and** min gap `ceil(60s/RPM)` ≈ **4s** at RPM=15.
- On HTTP 429: cool 65s + one retry.
- Prior RPM=5 runs inflated wall clock (~47s p50) — treat those as rate-limit artifacts, not model speed.
- Older Flash free tiers may still be 5 RPM — lower the env when testing those models.

Artifacts: `docs/findings/discovery-provider-eval-runs/`.

## LocalAI (Candidate B) prerequisites

LocalAI must expose a **chat/instruct** model via `/v1/models` and `/v1/chat/completions`.

Image-only models (`dreamshaper`, `flux.*`, `sd-*`) are **not** valid Discovery runtimes.

Suggested next load (operator machine): Qwen2.5-7B-Instruct or Llama-3.2-3B-Instruct GGUF per [LocalAI model gallery](https://localai.io/models/).

## Constraints

- Do not import these clients from production Discovery routes.
- Do not set Admin `COPILOT_TEXT_PROVIDER` from this harness.
