# IMPLEMENT-SCC-001-L2-A — Context Ownership Authority (Write Stop-Pollution)

**Status:** **PASS · Verified** · 2026-08-08  
**Grant:** GRANTED → implemented → human verification PASS  
**Parent grant:** Level 2 Controlled Expansion (Option A)  
**Prerequisite:** SCC-S1 PASS · `docs/spikes/adr-012-batch-attach-pollution-resolution.md`  
**Does not authorize:** Level 3 · URL change · Admin IA redesign · D1 heuristic-as-ownership-fix

---

## 1. Slice intent

```text
Stop treating Work-batch character/location attach to Story/Route as ownership authority.
Make Scene Context the ownership boundary for appearance/location context on new paths.
```

Product outcome (ADR-012 reading):

> A Story surfaces related cast/place via its Scene Contexts — not via a polluted Route membership list.

---

## 2. In scope (when GRANTED)

1. **Accept / Persist demotion**  
   - Stop default `buildStoryRelatedEntityRefs` whole-batch write into every Story’s `characterIds` / `locationId` as authoritative narrative ownership.  
   - Coexistence: fields may remain empty, operator-edited, or legacy-readable; **MUST NOT** be refilled from full Work batch on Accept.

2. **Context materialization authority**  
   - New Projection (SCC-S1 flag path): appearance/location/narrative continue to land on `scene_contexts_v1`.  
   - Optionally enrich Context refs from child Editorial Scene Expression + Work Archive name match (Context-scoped, not Story membership table).

3. **Non-authoritative marking**  
   - Document / code comments / Rollout copy: Route `character_ids` / `location_id` = migration debt, not Context authority.

4. **Tests**  
   - Accept Story A must not attach batch-only entities that only appear under Story B’s scenes (when Context/enrichment path is used).  
   - Context path still does not mutate Route archive fields from Context ownership writes.

---

## 3. Out of scope (this slice)

```text
❌ Heuristic filter that still treats Story/Route as ownership (rejected D1)
❌ Delete Route columns (Level 3)
❌ Historical data backfill / migration of all Works
❌ Reader URL / Scene Context page identity
❌ Full Admin redesign (L2-B may do minimal aggregate display later)
❌ Propose schema freeze (L2-C optional later)
```

---

## 4. Allowlist (implementation when granted)

| Path | Role |
| ---- | ---- |
| `lib/discovery/review-state.ts` | Remove/disable batch attach as default authority |
| `lib/rollout/resolve-story-entities.ts` · `reading-route-persist.ts` | Do not re-expand batch onto Route |
| `lib/scene-context/**` | Enrich Context appearance/location refs as needed |
| `components/rollout/*` copy / preview defaults | Stop implying “entities write with story as batch” |
| `__tests__/discovery/**` · `__tests__/scene-context/**` | Regressions for stop-pollution |
| `docs/spikes/*` · `config/infra/scene-context-defaults.md` | Grant + ops notes |

---

## 5. Runtime Truth Gate (L2-A)

Must prove after implementation:

```text
Scene Context owns appearance / location context / narrative beat
Reading Frame owns visual representation only
Reading Route owns delivery only — Accept MUST NOT batch-fill character_ids/location_id
```

Identity: Editorial Scene ≠ Scene Context ≠ Frame ≠ Route ≠ Story  

---

## 6. Follow-on slices (not this grant)

| Slice | Intent |
| ----- | ------ |
| **L2-B** | Review/Rollout UI: Story’s related entities = union of child Context refs |
| **L2-C** | Propose signals for Context candidates (not Story membership) |
| **Level 3** | Sunset Route fields + historical cleanup — separate authorization |

---

## 7. Architect Gate

```text
IMPLEMENT-SCC-001-L2-A

Status: GRANTED
Grant: Proceed under Level 2 controlled expansion

Allowed: remove batch attach authority · Context-scoped enrichment ·
         non-authoritative Route marking · regression coverage
Forbidden: Level 3 · schema removal · historical migration ·
           Reader identity redesign · heuristic ownership replacement
```

---

## 8. Implementation evidence (post-grant)

| Gate | Evidence |
| ---- | -------- |
| Accept MUST NOT batch-fill Story `character_ids` / `location_id` | `prepareAcceptStoryWithChildScenes` clears membership; cascade accepts Story + child Scenes only |
| Resolve MUST NOT re-expand related refs onto Route | `resolveStoryRelatedEntities` honors explicit IDs only |
| Context-scoped enrichment | `associateStagingToSceneContext({ archive })` + Context persist path load Work catalog |
| Regression | `__tests__/discovery/review-state.test.ts` — Story A ↛ Story B-only entities via Work batch |
| Non-authoritative Route marking | comments on `reading-route-persist` / resolve; Review copy in `zh-CN` |
| Human verification | **PASS** · 2026-08-08 |

---

## Refs

```text
docs/spikes/adr-012-batch-attach-pollution-resolution.md
docs/spikes/implement-scc-001-level2-controlled-expansion.md
docs/spikes/implement-scc-001-s1-result-review.md
docs/adr/012-scene-context-runtime-boundary.md
docs/specs/spec-scc-001-scene-context-contract.md
```
