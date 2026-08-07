# SPIKE-SCC-001 — Scene Context Runtime Materialization

Spike-only harness. Validates Scene Context ownership + Frame projection on existing Runtime Truth shapes **in memory**.

## Run

```bash
./node_modules/.bin/jiti scripts/scene-context-spike/run.ts
```

Evidence: `scripts/scene-context-spike/results/evidence.json`  
Findings: `docs/findings/spike-scc-001-runtime-materialization.md`

## Allowlist

- `scripts/scene-context-spike/**`
- `docs/spikes/spike-scc-001-*.md`
- `docs/findings/spike-scc-001-*.md`

## Denylist

No schema, migration, Route field removal, Web URL, Reader navigation, Admin UX, or production rollout wiring.
