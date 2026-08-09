# IMPLEMENT-SCC-001-L3-B — Historical Context Backfill

**Status:** **PASS · Verified** · 2026-08-09  
**Grant:** EXECUTE GRANTED (Historical Context backfill — additive only)  
**Parent program:** `docs/spikes/implement-scc-001-level3-route-ownership-sunset.md`  
**Prerequisite:** L3-A **PASS · Verified** · `scene_contexts_v1` migration in target envs  
**Does not authorize:** L3-C column drop · Reader URL redesign · blind copy of Route `character_ids` into Context as truth

---

## 1. Slice intent

```text
Where legacy Frame provenance (and related cues) can be mapped,
materialize Scene Context records additively on existing Reading Routes.

MUST NOT invent ownership from polluted Route membership lists.
MUST NOT drop character_ids / location_id (that is L3-C).
```

---

## 2. Source of truth for backfill (ordered)

| Priority | Source | Use |
| -------- | ------ | --- |
| 1 | Existing `scene_contexts_v1` for same editorial `sourceReviewId` | **Skip** (idempotent) |
| 2 | `frame_provenance_v1` with Expression/Intent + Frame caption | Associate via staging adapter semantics |
| 3 | Provenance without Expression | Minimal Context from caption (default on) |
| — | Route `character_ids` / `location_id` | **Ignored** for ownership |

---

## 3. Delivered (EXECUTE)

1. **Planner** — `lib/scene-context/backfill-from-provenance.ts`  
2. **Persist** — `replaceSceneContextsOnly` / `listSceneRowsWithContextsForWork` in `scenes-server.ts` (contexts only)  
3. **CLI** — `scripts/scene-context-backfill/run.ts` (dry-run default; `--apply` to write)  
4. **Tests** — `__tests__/scene-context/backfill-from-provenance.test.ts`

---

## 4. Out of scope

```text
❌ Drop or null-enforce character_ids / location_id (L3-C)
❌ Blind “Route cast → every Context” pollution copy
❌ Reader URL / Scene Context page identity
❌ Unbounded all-Works production backfill without allowlist / dry-run
```

---

## 5. Ops

```bash
# Dry-run
npx tsx scripts/scene-context-backfill/run.ts --workId=<uuid>

# Apply
npx tsx scripts/scene-context-backfill/run.ts --workId=<uuid> --apply

# Allowlist override
npx tsx scripts/scene-context-backfill/run.ts --workId=<uuid> --force --apply
```

See `scripts/scene-context-backfill/README.md`.

---

## 6. Runtime Truth Gate (L3-B)

```text
1. Backfill writes scene_contexts_v1 only — MUST NOT write character_ids / location_id
2. MUST NOT treat Route membership as Context ownership source
3. Idempotent: second run adds no duplicate Context for same editorial source
4. Allowlisted Work can show relatedFromContextsLine from backfilled Contexts
5. Identity freeze unchanged
6. L3-A consumer demotion remains in force
```

---

## 7. Architect Gate

```text
IMPLEMENT-SCC-001-L3-B

Status: EXECUTE GRANTED → Implemented
Scope: Historical Context backfill (additive only)
```

---

## 8. Implementation evidence

| Gate | Evidence |
| ---- | -------- |
| Plan from provenance without Route cast ownership | `backfill-from-provenance.test.ts` |
| Idempotent apply plan | same (second plan noop) |
| No membership column writes | `replaceSceneContextsOnly` patches `scene_contexts_v1` only |
| Human verification | **PASS** · CLI dry-run / apply / idempotent · 2026-08-09 |

---

## Refs

```text
docs/spikes/implement-scc-001-level3-route-ownership-sunset.md
lib/scene-context/backfill-from-provenance.ts
scripts/scene-context-backfill/run.ts
```
