# Expression Minimality Spike

Compare Renderer Expression **density** (full / minimal / over-compressed) on Local
`sd-3.5-medium-ggml`, fixed seed & 512². ADR-011 boundary — no Planner / Adapter / Cloud.

```bash
# Local image server must be running (see scripts/README-local-image-server.md)
npx tsx scripts/expression-minimality-spike/run.ts
```

Outputs: `results/` (gitignored) · findings draft: `docs/findings/expression-minimality-spike.md`
