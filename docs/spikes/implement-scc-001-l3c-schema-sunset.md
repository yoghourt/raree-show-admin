# IMPLEMENT-SCC-001-L3-C — Route Membership Schema Sunset

**Status:** **PASS · Verified** · 2026-08-09  
**Grant:** EXECUTE GRANTED (Drop Route membership columns)  
**Parent program:** `docs/spikes/implement-scc-001-level3-route-ownership-sunset.md`  
**Prerequisite:** L3-A **PASS · Verified** · L3-B **PASS · Verified**  
**Does not authorize:** Reader URL / Scene Context page identity · restoring membership editors · treating legacy Route cast as Context truth

---

## 1. Slice intent

```text
Retire scenes.character_ids / scenes.location_id as physical carriers
of narrative ownership on Reading Routes.

Route remains delivery only.
Appearance / location ownership stays on Scene Context.
```

---

## 2. EXECUTE decision

**Hard drop** (not freeze-null):

| Step | Delivered |
| ---- | --------- |
| 1 | Admin consumers purged of select/insert/update for membership columns |
| 2 | `ReadingRoute` domain type no longer carries `characterIds` / `locationId` |
| 3 | Migration `docs/supabase/migrations/20260809000000_drop_route_membership_columns.sql` |
| 4 | `emptyRouteMembership*` shims removed (`route-membership.ts` deleted) |

Staging may still *clear* optional `characterIds` / `locationId` on Discovery payloads so Propose/Accept cannot revive ownership. Copilot registry keeps the keys as **excluded** so they are never suggested.

---

## 3. Delivered

1. Migration — drop `character_ids` / `location_id`
2. Persist / select — `scenes.ts` · `scenes-server.ts` · `reading-route-persist.ts` · `reading-frame-persist.ts`
3. Domain — `lib/types.ts` ReadingRoute
4. Tests — `__tests__/rollout/route-membership-l3c.test.ts` (+ related suite updates)

---

## 4. Ops

```bash
# Apply in Supabase SQL editor (after scene_contexts_v1 if not already applied):
docs/supabase/migrations/20260809000000_drop_route_membership_columns.sql
```

Admin code assumes columns are gone. Apply migration before deploying Admin that selects without them… actually Admin no longer selects them, so old columns can remain unread until drop; **drop must land before any code that still inserts empty membership** — this PR removes those inserts, so apply migration **with or immediately after** deploy.

---

## 5. Out of scope

```text
❌ Reader URL redesign / Scene Context page identity
❌ Blind Route cast → Context ownership copy
❌ Re-introducing membership pickers
❌ Dropping scene_contexts_v1 or frame_provenance_v1
```

---

## 6. Runtime Truth Gate (L3-C)

```text
1. scenes MUST NOT carry character_ids / location_id (dropped)
2. Admin persist / create MUST NOT write those columns
3. Display of related cast/place remains Context / provenance aggregate
4. Identity freeze unchanged
5. L3-B backfill CLI remains valid
```

---

## 7. Architect Gate

```text
IMPLEMENT-SCC-001-L3-C

Status: PASS · Verified
Scope: Drop Route membership columns
```

---

## 8. Implementation evidence

| Gate | Evidence |
| ---- | -------- |
| No membership on update/insert/domain map | `route-membership-l3c.test.ts` |
| Migration | `20260809000000_drop_route_membership_columns.sql` |
| Human verification | **PASS** · migration applied + smoke · 2026-08-09 |

---

## Refs

```text
docs/spikes/implement-scc-001-level3-route-ownership-sunset.md
docs/supabase/migrations/20260809000000_drop_route_membership_columns.sql
lib/scenes.ts
lib/rollout/scenes-server.ts
```
