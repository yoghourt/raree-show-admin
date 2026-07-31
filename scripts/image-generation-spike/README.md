# Image Generation Architecture Spike

Isolated comparison: cloud reference vs local direct vs Gemini director + local render.

**Does not** modify Production Runtime, Assets, CPP, queue, or ADRs.

Findings: [`docs/findings/image-generation-architecture-spike.md`](../../docs/findings/image-generation-architecture-spike.md)

## Prerequisites

- LocalAI at `http://127.0.0.1:8080` with `sd-3.5-medium-ggml`
- Optional alt arm: Diffusers portrait server on `:8191` (`sdxl-turbo`) — see `scripts/README-local-image-server.md`
- `.env.local`: `GEMINI_API_KEY`; for cloud ceiling if Gemini image quota is 0: `IMAGE_SPIKE_SILICONFLOW_KEY` / `SILICONFLOW_API_KEY`

## Run

```bash
npx tsx scripts/image-generation-spike/run-all.ts

# Or individually
npx tsx scripts/image-generation-spike/run-reference.ts
npx tsx scripts/image-generation-spike/run-local-direct.ts
npx tsx scripts/image-generation-spike/run-gemini-director.ts
```

## Output

```
results/scene-N/
  gemini-reference.png       # Cloud ceiling (Gemini image if quota allows; else SiliconFlow FLUX)
  local-direct.png           # Option A current (LocalAI)
  local-direct-alt.png       # Option A single alternative
  gemini-director-local.png  # Option B
  *.json                     # latency / cost / prompt meta
  visual-plan.json           # Option B structured plan
```

## Env overrides

| Var | Default |
|-----|---------|
| `SPIKE_LOCAL_MODEL_CURRENT` | `sd-3.5-medium-ggml` |
| `SPIKE_LOCAL_MODEL_ALT` | `sdxl-turbo` |
| `SPIKE_LOCAL_ALT_PROVIDER` | `local` (`:8191`) or `localai` |
| `SPIKE_LOCAL_ONLY` | `current` \| `alt` |
| `SPIKE_SKIP_EXISTING` | `1` to skip existing PNGs |
| `SPIKE_GEMINI_IMAGE_MODEL` | `gemini-2.5-flash-image` |
| `SPIKE_GEMINI_DIRECTOR_MODEL` | `gemini-3.5-flash-lite` |
| `SPIKE_LOCAL_MAX_EDGE` | `512` |

## Notes from this run

- Gemini **image** free-tier quota was 0 → reference used SiliconFlow FLUX.
- LocalAI `flux.2-klein-4b` returned gRPC EOF → alt used `sdxl-turbo` only (no further model search).
