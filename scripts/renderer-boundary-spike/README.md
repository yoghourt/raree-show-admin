# Renderer Boundary Validation Spike

Same Visual Intent + LocalAI model + seed; only prompt representation changes (A/B/C).

**Does not** change models, Production, Assets, CPP, queue, or ADRs.

## Variants

| Id | Representation |
|----|----------------|
| A | Natural language (source sentence) |
| B | Structured Visual Intent listing |
| C | Strong spatial / cast constraints |

## Run

```bash
npx tsx scripts/renderer-boundary-spike/run.ts
```

## Output

```
results/scene-N/
  visual-intent.json
  variant-A.prompt.txt / .png / .json
  variant-B.prompt.txt / .png / .json
  variant-C.prompt.txt / .png / .json
```

Findings: [`docs/findings/renderer-boundary-validation-spike.md`](../../docs/findings/renderer-boundary-validation-spike.md)