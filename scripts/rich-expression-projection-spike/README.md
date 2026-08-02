# Spike — Rich Expression Projection Validation

Experiment only. No production / ADR / SPEC changes.

```bash
# requires LocalAI :8080 + SILICONFLOW_API_KEY (or IMAGE_SPIKE_SILICONFLOW_KEY)
IMAGE_CREATOR_LOCALAI_BASE=http://127.0.0.1:8080 \
  npx tsx scripts/rich-expression-projection-spike/run.ts

# optional: SPIKE_ONLY=A,B | SPIKE_SKIP_LOCALAI=1 | SPIKE_SEED=42
```

Results: `results/<case>/{A_current_cloud,B_rich_cloud,C_rich_localai}.png` + `summary.json`
