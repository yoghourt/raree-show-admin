# Renderer Model Qualification Spike

Fixed **Renderer Expression** across Local models. Measures whether the production
Local model is the Runtime bottleneck (not Expression quality).

```bash
# LocalAI :8080 with sd-3.5-medium-ggml (+ optional flux.2-klein-4b)
# Optional Candidate A: Diffusers server :8191 (sdxl-turbo)
#   see scripts/README-local-image-server.md

npx tsx scripts/renderer-model-qualification-spike/run.ts

# Subset:
SPIKE_MODEL_IDS=baseline,candidate-b npx tsx scripts/renderer-model-qualification-spike/run.ts
```

Outputs: `results/` · findings: `docs/findings/renderer-model-qualification-spike.md`
