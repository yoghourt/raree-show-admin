# Scene Context Deployment Defaults (IMPLEMENT-SCC-001-S1)

Deployment knobs for Context-aware projection. Not Architecture constants.

**Authorization (2026-08-08):** Architect Option A — controlled Level 2 expansion authorized. Prefer Work allowlist when enabling in shared envs. Level 3 still forbidden.

**Batch-attach pollution track:** See `docs/spikes/adr-012-batch-attach-pollution-resolution.md`.

- **L2-A PASS · Verified** — Accept MUST NOT batch-fill Route `character_ids` / `location_id`; Context path may enrich appearance/location archive refs by name.
- **L2-B PASS · Verified** (`docs/spikes/implement-scc-001-l2b-ui-context-aggregate.md`) — Review/Rollout display = child Scene/Context union.
- **L2-C PASS · Verified** (`docs/spikes/implement-scc-001-l2c-propose-context-signals.md`) — Propose → Context candidate signals.
- **L3 GRANTED · L3-A PASS · Verified** (`docs/spikes/implement-scc-001-level3-route-ownership-sunset.md`) — Route membership demoted in Admin/persist; columns remain until L3-C.

| Env | Default | Meaning |
| --- | ------- | ------- |
| `SCENE_CONTEXT_PROJECTION_ENABLED` | unset / off | When `1`/`true`, Projection Accept uses Editorial Scene → Scene Context → Frame |
| `SCENE_CONTEXT_WORK_ALLOWLIST` | empty | Comma-separated Work UUIDs; empty = all Works when globally enabled |

## Rollback

```bash
# unset or:
SCENE_CONTEXT_PROJECTION_ENABLED=0
```

Legacy Hot Path (Scene staging → Frame) resumes. Existing `scene_contexts_v1` rows remain; not deleted.

## Prerequisite

Apply additive migration:

```text
docs/supabase/migrations/20260808000000_scene_contexts_v1.sql
```

before enabling the flag in an environment.
