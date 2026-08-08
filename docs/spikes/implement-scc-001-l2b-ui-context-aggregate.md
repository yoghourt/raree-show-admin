# IMPLEMENT-SCC-001-L2-B — UI Aggregate from Context / Child Scenes

**Status:** **PASS · Verified** · 2026-08-08  
**Grant:** EXECUTE GRANTED → implemented → human verification PASS  
**Scope:** Level 2 Controlled Expansion — Display Projection  
**Parent grant:** Level 2 Controlled Expansion (Option A)  
**Prerequisite:** L2-A **PASS · Verified** · `docs/spikes/implement-scc-001-l2a-context-ownership-authority.md`  
**Does not authorize:** Level 3 · URL change · full Admin IA redesign · D1 heuristic-as-ownership-fix · Propose rewrite (L2-C)

---

## 1. Slice intent

```text
Story-related cast/place in Review/Rollout =
  union of child Editorial Scene / Scene Context appearance·location refs
NOT the Work-batch character/location list re-rendered under every Story
```

Product outcome (ADR-012 reading):

> A Story surfaces related cast/place via its Scene Contexts — not via a polluted Route membership list.

L2-A stopped **write** pollution. L2-B aligns **display** with Context ownership.

---

## 2. In scope (when coding is kicked off)

1. **Aggregate helper (pure)**  
   - Input: child `AcceptedSceneCandidateStaging[]` and/or `SceneContextRecord[]`  
   - Output: de-duplicated characters / location cues (name + optional `archiveTsid`)  
   - Priority: Context records when present; else Intent/Expression on child scene staging

2. **Discovery Review UI (minimal)**  
   - Under each Story: read-only “related from child scenes” aggregate  
   - Accepted tab: replace reliance on empty `relatedCharacterRefs` with child-scene/Context union  
   - Work Archive character/location remain Work-scoped (L2-A bottom list + separate Accept)

3. **Rollout Story preview (minimal)**  
   - Primary related display = frames/Context union  
   - Route `characterIds` / `locationId` remain non-authoritative debt; default empty;  
     MUST NOT backfill from legacy `related*Refs` when empty

4. **Tests + copy**  
   - Story A aggregate MUST NOT include Story B-only appearance names  
   - Locale: stop implying batch membership under Story

---

## 3. Out of scope (this slice)

```text
❌ Heuristic filter that still treats Story/Route as ownership (rejected D1)
❌ Delete Route columns / historical migration (Level 3)
❌ Reader URL / Scene Context page identity
❌ Full Admin information-architecture redesign
❌ Propose → Context signal redesign (L2-C)
❌ Re-enable Accept batch-fill of character_ids / location_id
```

---

## 4. Allowlist (implementation when execute is authorized)

| Path | Role |
| ---- | ---- |
| `lib/scene-context/aggregate-story-refs.ts` (or equivalent) | Pure union from staging / Context |
| `components/discovery/DiscoveryReviewPanel.tsx` | Story / Accepted aggregate display |
| `components/rollout/StoryWritePreviewCard.tsx` | Aggregate primary; no relatedRefs→characterIds backfill |
| `lib/locale/zh-CN.ts` · Rollout copy as needed | Non-membership wording |
| `__tests__/scene-context/**` · discovery as needed | A ↛ B-only aggregate regression |
| `docs/spikes/*` · Level2 / ADR-012 status rows | Grant + evidence |

---

## 5. Runtime Truth Gate (L2-B)

Must prove after implementation:

```text
Display: Story A related cast/place ⊆ union(child Contexts / child Scenes of A)
Display: Story A MUST NOT show Story B-only appearance/location cues from Work batch
Write path: L2-A invariants unchanged (Accept MUST NOT batch-fill Route membership)
Identity: Editorial Scene ≠ Scene Context ≠ Frame ≠ Route ≠ Story
```

---

## 6. Follow-on slices (not this grant)

| Slice | Intent |
| ----- | ------ |
| **L2-C** | Propose signals for Context candidates — **PASS · Verified** · `implement-scc-001-l2c-propose-context-signals.md` |
| **Level 3** | Sunset Route fields + historical cleanup — separate authorization |

---

## 7. Architect Gate

```text
IMPLEMENT-SCC-001-L2-B

Status: EXECUTE GRANTED
Grant: Level 2 Controlled Expansion — Display Projection

Allowed: Pure child Scene / Scene Context aggregate helper ·
         Discovery Review aggregate display ·
         Rollout Story preview aggregate display ·
         Non-membership wording · regression tests
Forbidden: Route schema deletion · historical migration ·
           Reader identity redesign · full Admin IA redesign ·
           Propose rewrite · heuristic ownership replacement
```

---

## 8. Implementation evidence (post-coding)

| Gate | Evidence |
| ---- | -------- |
| Aggregate A ↛ B-only | `__tests__/scene-context/aggregate-story-refs.test.ts` |
| Review display uses union | `DiscoveryReviewPanel` pending + accepted → `aggregateStoryRelatedRefs` |
| Rollout preview no relatedRefs backfill | `StoryWritePreviewCard.stagingToValues` explicit IDs only + frames union display |
| L2-A regressions still green | discovery + scene-context + resolve-story-entities suites |
| Human verification | **PASS** · 2026-08-08 |

---

## Refs

```text
docs/spikes/adr-012-batch-attach-pollution-resolution.md
docs/spikes/implement-scc-001-level2-controlled-expansion.md
docs/spikes/implement-scc-001-l2a-context-ownership-authority.md
docs/adr/012-scene-context-runtime-boundary.md
docs/specs/spec-scc-001-scene-context-contract.md
```
