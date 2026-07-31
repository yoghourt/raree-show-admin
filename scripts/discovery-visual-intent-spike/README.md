# Discovery Visual Intent Extension Spike

Validate whether Discovery should emit Narrative Visual Intent (vs a separate Gemini planner).

**Does not** modify Production Discovery schema, Runtime, Assets, CPP, queue, or ADRs.

## Compare

| Arm | Flow |
|-----|------|
| Baseline A | Discovery scene title/summary → `buildFrameDraftPrompt` → LocalAI |
| Experiment B | Same Discovery call’s `visualIntent` → `adapter.ts` → LocalAI |

Same Discovery bundle is cached in `results/scene-N/discovery-bundle.json`.

## Run

```bash
npx tsx scripts/discovery-visual-intent-spike/run-all.ts
```

Requires LocalAI (`sd-3.5-medium-ggml`) + `GEMINI_API_KEY` (Discovery text).

## Output

```
results/scene-N/
  discovery-bundle.json   # scene fields + visualIntent
  baseline-current.png
  visual-intent.png
  adapter-prompt.json
  *.json                  # latency meta
```

Temporary schema: `schema.example.json`

Findings: [`docs/findings/discovery-visual-intent-extension-spike.md`](../../docs/findings/discovery-visual-intent-extension-spike.md)
