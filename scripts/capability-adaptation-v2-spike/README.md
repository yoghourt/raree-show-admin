# Spike: Renderer Expression Capability Adaptation v2

Validate whether stronger Discovery Expression rules improve Local success on hard multi-character / interaction scenes.

```bash
# LocalAI up; .env.local with IMAGE_CREATOR_* + discovery LLM
npx tsx scripts/capability-adaptation-v2-spike/run.ts

# Optional
SPIKE_CASE=case-duel npx tsx scripts/capability-adaptation-v2-spike/run.ts
SPIKE_SKIP_EXISTING=1 npx tsx scripts/capability-adaptation-v2-spike/run.ts
```

Outputs: `results/<case>/{baseline,adapted}.png` + `docs/findings/capability-adaptation-v2-spike.md` (gitignored).

Architecture: Discovery Expression only. No Planner / Adapter / Port / Cloud.
