# IMPLEMENT-SCC-001-S1 Result Review

**Status:** Authorized Review — **PASS** · Architect **Accepted Option A** (2026-08-08)  
**Date:** 2026-08-08  
**Review scope:** Prove Scene Context Runtime Boundary can stand on Runtime Truth v1 delivery path  
**Out of scope:** Level 3 Migration · Route field removal · Reader URL · Admin redesign · schema finalization  
**Follow-on grant:** `docs/spikes/implement-scc-001-level2-controlled-expansion.md`

Operator confirmation: manual verification reported **OK** (2026-08-08).  
Automated evidence: `npm test -- __tests__/scene-context/` → **9 passed**.

---

## 1. Execution Summary

### S1 actual implementation scope

| Item | Delivered |
| ---- | --------- |
| Slice intent | Context-aware projection path behind existing Reader delivery |
| Association | Editorial Scene staging → `SceneContextRecord` (`lib/scene-context/associate.ts`) |
| Persistence (additive) | `scenes.scene_contexts_v1` jsonb (migration `20260808000000_scene_contexts_v1.sql`) |
| Projection | Context → Frame `{url, caption}` via existing `story_images_v2` |
| Enablement | `SCENE_CONTEXT_PROJECTION_ENABLED` + optional Work allowlist (default **OFF**) |
| Gate | Runtime Truth Gate aborts persist on ownership leakage |
| API surface | Projection Accept may return `contextId` / `contextPath` |

### Validation paths used

1. **Unit / mocked persist** — `__tests__/scene-context/*` (flag on/off, gate, associate, parse)  
2. **Operator path** — enable flag → Discovery Accept → Story persist → Scene Projection Accept → inspect DB / API response  
3. **Regression** — flag OFF restores legacy Scene staging → Frame path

### Freeze constraints preserved

| Constraint | Held? |
| ---------- | ----- |
| URL unchanged | **Yes** — no Reader URL / page identity for Context |
| Route fields not deleted | **Yes** — `character_ids` / `location_id` retained |
| Schema ownership not migrated | **Yes** — additive column only; no Work-wide ownership rewrite |
| Admin / Web not redesigned | **Yes** — existing Projection Accept path; no IA/URL redesign |

---

## 2. Runtime Evidence

### Path proven

```text
Scene Context          (scene_contexts_v1 — narrative ownership)
      |
      | projection
      ↓
Reading Frame          (story_images_v2 [{url, caption}])
      |
      ↓
Reading Route delivery (existing scenes.tsid container / Reader delivery)
```

API evidence shape (Context path):

```json
{
  "ok": true,
  "contextId": "ctx_<sourceReviewId>",
  "contextPath": true,
  "sceneTsid": "scene_...",
  "frameIndex": 0
}
```

DB evidence checks (operator-confirmed):

| Artifact | Expected | Result |
| -------- | -------- | ------ |
| `scene_contexts_v1` | Context record with narrative / appearance / location / Expression | **Observed** |
| `story_images_v2` | Remains `{url, caption}` | **Observed** |
| `frame_provenance_v1[].sourceContextId` | Points at Context | **Observed** |
| Route `character_ids` / `location_id` | Unchanged by Context path | **Observed** |

### Context Ownership

```text
Scene Context owns:
- narrative context          ✓ (narrativeMoment + readerFacingNarrativeContext)
- appearance references      ✓ (characterAppearanceContext)
- location context           ✓ (locationContext.environmentFromExpression [+ optional archive refs])
- creation-facing Expression ✓ (creationFacingVisualExpression; dual-written to provenance for Creator tools)
```

Archive identity remains Work-scoped (refs only; not Context-owned entities).

### Frame Boundary

```text
Reading Frame owns:
- visual representation      ✓ ({url, caption} only)

NOT:
- narrative ownership        ✓ (gate + shape check)
- character/location ownership ✓ (no structured archive fields on Frame)
```

### Route Boundary

```text
Reading Route owns:
- delivery projection        ✓ (ordered Frames container; existing Reader path)

NOT:
- scene ownership            ✓ (Context is distinct id; not Route rename)
- character/location ownership via Context path ✓ (Context path does not write character_ids/location_id)
```

Legacy Route `character_ids` / `location_id` may still exist as **migration debt** from Story persist — not treated as Context authority and not removed in S1.

---

## 3. Regression Check

Legacy path with flag off:

```text
Existing Route → Frame delivery
```

| 项目 | Result |
| ---- | ------ |
| Existing Reader delivery | **PASS** — URL / Step atom unchanged; Frames still served from Route |
| Existing Route behavior | **PASS** — Story→Route persist and Route container unchanged |
| Existing Frame rendering | **PASS** — `story_images_v2` shape unchanged; Creator provenance dual-write preserves Expression consumers |

Automated: flag-off persist test asserts `contextPath: false` and no `sceneContexts` write option.

---

## 4. Boundary Audit

### Identity

```text
Editorial Scene  ≠  Scene Context  ≠  Reading Frame  ≠  Reading Route
```

| Separation | Evidence |
| ---------- | -------- |
| Editorial Scene ≠ Context | `editorialSceneSourceReviewId` ≠ `contextId` (`ctx_` prefix) |
| Context ≠ Frame | Context record vs `{url,caption}`; projection index only |
| Context ≠ Route | `contextId` ≠ `readingRouteTsid` |
| Story ≠ Context | parent Story review id remains delivery hint only |

### Forbidden Pattern Audit

| Pattern | Status |
| ------- | ------ |
| Route ownership回流 from Context path | **Absent** — gate fails if characterIds/locationId mutate |
| Frame narrative ownership | **Absent** — Frame shape locked to representation |
| Editorial Scene runtime merge | **Absent** — association ≠ identity |
| Context URL/page identity | **Absent** — no routing grant |

---

## 5. Architecture Decision Impact

### Recommendation: **Option A**

```text
Proceed with controlled Context-aware projection expansion
```

Reasons:

* Boundary holds on Runtime Truth v1 delivery path  
* Risks controllable via feature flag + Work allowlist + additive storage  
* No ADR-012 / SPEC-SCC-001 conflict discovered  
* Operator verification OK; automated gate/path tests PASS  

### Not selected

| Option | Why not |
| ------ | ------- |
| **B** Keep Runtime Truth v1 Freeze | Evidence sufficient for controlled Level 2 expansion (still flag-gated) |
| **C** Revisit ADR/SPEC | No architecture counterexample |

Expansion remains **controlled** (flag/allowlist). This does **not** authorize Level 3.

---

## 6. Explicit Non-Decision

This Review does **not** authorize:

* Full migration of all Works  
* Deletion of Route ownership fields (`character_ids` / `location_id`)  
* Reader URL / navigation change  
* Admin redesign  
* Schema finalization / persistence architecture freeze  
* Unbounded Production Authorization beyond S1 allowlist posture  

---

## Final Gate

```text
IMPLEMENT-SCC-001-S1 Result:

Status:
PASS

Architecture:
Stable

Next Authorization:
A — AUTHORIZED (2026-08-08)
```

### Verdict (Architect target)

Scene Context has moved from architecture concept to a **Runtime-consumable capability boundary** on the existing delivery path:

* safely associable from Editorial Scene staging  
* projectable to Reading Frame representation  
* deliverable via Reading Route without URL/page identity  
* rollbackable to legacy Hot Path when flag is off  

**Architect decision:** Option A authorized — controlled Context-aware projection expansion. Level 3 remains unauthorized.
