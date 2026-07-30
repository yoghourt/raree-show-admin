# Discovery text generation — Deployment defaults

**Layer:** Deployment (not Architecture / SPEC).  
**Authority for Discovery propose quality evidence:** `docs/findings/discovery-runtime-provider-evaluation.md` (v3).

## Defaults

| Knob | Default | Notes |
|------|---------|--------|
| `DISCOVERY_TEXT_PROVIDER` | `gemini` | Discovery propose/regen only |
| `DISCOVERY_TEXT_MODEL` | `gemini-3.5-flash-lite` | Do **not** reuse Enrichment `GEMINI_SUGGEST_MODEL` |
| `DISCOVERY_TEXT_FALLBACK_PROVIDER` | `openrouter` if `OPENROUTER_API_KEY` set | Transport/provider failure only |
| `DISCOVERY_TEXT_FALLBACK_MODEL` | `OPENROUTER_SUGGEST_MODEL` or `openai/gpt-oss-20b:free` | Emergency path; not primary |

Enrichment continues to use `COPILOT_TEXT_PROVIDER` / `GEMINI_SUGGEST_MODEL`.

## Behavior

- Parse / schema failures **do not** trigger fallback (avoids double cost).
- Set `DISCOVERY_TEXT_FALLBACK_PROVIDER=none` to disable fallback.
- Timing logs: `DISCOVERY_PROPOSE_TIMING=1`.

## Rejected as Discovery primary (eval v3)

- OpenRouter `openai/gpt-oss-20b:free` (slow / unstable structured output)
- LocalAI + `qwen3.5-9b-dflash` (latency / thinking)

## Code

- `lib/discovery/discovery-text-llm.ts`
- `lib/discovery/propose-service.ts` → `callDiscoveryTextLlm`
