# IMPLEMENT-SCC-001-L3 — Route Ownership Sunset

**Status:** **GRANTED** · L3-A **PASS · Verified** · 2026-08-09  
**Program grant:** L3 Program Charter approved · 2026-08-09  
**Execution:** **L3-A only** (L3-B / L3-C not authorized for coding)  
**Scope:** Level 3 migration program (beyond Option A Level 2 Controlled Expansion)  
**Prerequisite:** S1 · L2-A · L2-B · L2-C all **PASS · Verified**  
**Does not inherit:** Option A Level 2 grant alone — Level 3 requires separate Architect authorization

---

## 1. Slice intent

```text
Retire Reading Route as a carrier of narrative character/location ownership.
Route remains delivery only; appearance/location live on Scene Context.
```

L2-A stopped **new** pollution. L2-B/C aligned display and Propose.  
L3 retires **physical / consumer** debt on `scenes.character_ids` / `scenes.location_id`.

---

## 2. Why this is a separate Level (not Level 2)

| Level 2 (done) | Level 3 (this program) |
| -------------- | ---------------------- |
| Semantics + new-path stop-pollution | Schema / migration / broad consumer cleanup |
| Fields may remain empty or legacy-readable | Fields null-authority then remove or freeze-null |
| Admin minimal aggregate (L2-B) | Optional broader Admin IA on Context |
| No historical backfill required | Historical Context backfill where justified |

---

## 3. Phases

### L3-A — Consumer demotion (EXECUTE — delivered)

**Intent:** Stop treating Route membership as editable/authoritative in Admin surfaces.

| Delivered | Still out of scope for L3-A |
| --------- | --------------------------- |
| `ReadingRouteForm`: pickers removed; Context / provenance aggregate read-only | Drop DB columns |
| `lib/scenes` create/update: never write `character_ids` / `location_id` (update omits; insert empty) | Mass historical rewrite |
| Discovery Route persist: update omits membership; insert empty | Reader URL redesign |
| Rollout Story preview: membership editors removed | L3-B backfill |

**Success gate:** New edits cannot re-pollute Route membership; operators see Context-derived related cast/place on story edit.

### L3-B — Historical Context backfill (not executed)

Additive backfill job — requires separate **EXECUTE GRANTED**.

### L3-C — Schema sunset (not executed)

Drop or permanently null columns — requires separate **EXECUTE GRANTED**.

---

## 4. Explicit non-goals (until separately authorized)

```text
❌ L3-B / L3-C without their own EXECUTE
❌ Blindly copy polluted Route character_ids into Scene Context as “truth”
❌ Reader URL / Scene Context page identity (own ADR)
❌ Full Admin IA redesign beyond membership demotion
❌ Restore Story-batch attach or D1 heuristic ownership
```

---

## 5. Allowlist (L3-A delivered)

| Path | Role |
| ---- | ---- |
| `lib/rollout/route-membership.ts` | Empty membership helpers |
| `lib/scenes.ts` | `toUpdateRowWithoutMembership` · related line from Contexts |
| `lib/rollout/reading-route-persist.ts` · `scenes-server.ts` | No membership writes |
| `components/reading-routes/ReadingRouteForm.tsx` | Aggregate display; no pickers |
| `components/rollout/StoryWritePreviewCard.tsx` | Membership editors removed |
| `lib/locale/zh-CN.ts` · `lib/rollout/ui-copy.ts` | Demotion copy |
| `__tests__/rollout/route-membership-l3a.test.ts` | No re-pollution regression |

---

## 6. Runtime Truth Gate (L3-A)

```text
1. Story edit / Discovery Route persist MUST NOT write character_ids / location_id
2. Story edit shows related cast/place from Scene Context (or Frame provenance cues)
3. Columns remain in schema (L3-C later); legacy values may persist unread for ownership
4. Identity freeze unchanged: Editorial Scene ≠ Scene Context ≠ Frame ≠ Route ≠ Story
```

---

## 7. Architect Gate

```text
IMPLEMENT-SCC-001-L3

Status: GRANTED
Program: Route ownership sunset
Execution: L3-A only

L3-B / L3-C: still PENDING until separate EXECUTE GRANTED
```

---

## 8. Implementation evidence

| Phase | Status | Evidence |
| ----- | ------ | -------- |
| L3-A Consumer demotion | **PASS · Verified** | `route-membership-l3a.test.ts` + form/persist paths |
| L3-B Historical backfill | pending | — |
| L3-C Schema sunset | pending | — |
| Human verification (L3-A) | **PASS** · 2026-08-09 | — |

---

## Refs

```text
docs/adr/012-scene-context-runtime-boundary.md
docs/specs/spec-scc-001-scene-context-contract.md
docs/spikes/adr-012-batch-attach-pollution-resolution.md
docs/spikes/implement-scc-001-level2-controlled-expansion.md
docs/spikes/implement-scc-001-l2a-context-ownership-authority.md
lib/rollout/route-membership.ts
lib/scenes.ts
```
