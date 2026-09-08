# IMPLEMENT-WMA-001 — Work Map Authority (scoped Implementation Grant)

**Status:** Implementation Authorization **GRANTED** (scoped) · 2026-09-08 · L1–L3 wired  
**Contract authority:** ADR-014 · SPEC-WMA-001 v0.1 (Accepted — Contract Freeze)  
**Primary repos:** `raree-show-admin` (Creator) · `raree-show-web` (Reader)  
**Does not authorize:** GIS · multi-region maps · automatic reprojection · AI-established geometry · whole-Work pin hard gate · Copilot coordinate enrichment · Reader Image Port · URL-as-asset-identity · Reading Route URL redesign

---

## Slice intent

```text
Work-scoped map authority + Location pins relative to geometry_id
        → Creator MapPicker consumes Published Work Map Asset
        → Reader MiniMap / pan consume the same resolve
        → missing authority fails closed (no Westeros / no 0.5 default)
```

---

## Implementation choices (closes SPEC open gaps)

| Choice | Decision |
| ------ | -------- |
| `published_asset_id` | Thin `media_assets(id, url, created_at)`; `work_maps` stores id only |
| `map_capability` | `works.map_capability` `'off' \| 'required'`, default `'off'` |
| Geometry mint | Human「接受几何」sets `geometry_id` + `geometry_accepted_at` |
| Visual replace | Swap `published_asset_id` only; keep `geometry_id` only when frame unchanged |
| Reader consumption set | Current Step Scene Context `locationContext.archiveTsid` |

---

## Allowlist

### Admin (`raree-show-admin`)

| Path | Purpose |
| ---- | ------- |
| `docs/supabase/migrations/20260908000000_work_map_authority.sql` | Schema |
| `lib/work-maps/**` | Resolve / CRUD / pin validity |
| `lib/media-assets.ts` | Thin asset registry |
| `lib/works.ts` · `lib/types.ts` | `map_capability` |
| `lib/locations.ts` · `lib/types.ts` | `map_focus_geometry_id` |
| `components/locations/MapPicker.tsx` | Remove Westeros; resolve-driven |
| `components/locations/LocationForm.tsx` | Pin + geometry bind |
| `components/works/WorkForm.tsx` · Work Map panel | Capability / geometry / publish |
| `lib/ai/field-registry.ts` | Register `map_focus_geometry_id` asset/excluded |
| `docs/specs/spec-core-001-entity-schema-registry.md` | Same registry row |
| `lib/discovery/candidate-validate.ts` | Exclude geometry field |
| `__tests__/work-maps/**` | Resolve + pin validity |

### Reader (`raree-show-web`)

| Path | Purpose |
| ---- | ------- |
| `src/lib/work-maps/**` | Equivalent resolve (no shared package) |
| `src/lib/data.ts` | Load work map + drop `WESTEROS_MAP_URL` |
| `src/lib/types.ts` | Map / pin fields |
| `src/lib/scene-context/resolve-step-context.ts` | No `0.5` default pin |
| `src/components/raree/ReadingRouteExperience.tsx` | Fail closed; no Westeros fallback |
| `src/components/raree/MiniMap.tsx` | Consume resolved URL only when ready |
| related verify scripts / tests | Gate checks |

---

## Denylist

* GIS / lat-lng / projections / multi-region maps
* Automatic reprojection of Westeros-derived pins
* AI output establishing `geometry_id`
* Whole-Work pin completeness as hard Runtime gate
* Copilot / Discovery writing `map_focus_*`
* Reader generating or independently selecting a map
* Persisting URL on `work_maps` instead of `published_asset_id`
* Seed / hard-code showcase Work titles as architecture
* Reading Route URL / Scene Context page identity changes

---

## Enablement

1. Apply `docs/supabase/migrations/20260908000000_work_map_authority.sql` in Supabase
2. Deploy Admin with MapPicker resolve path
3. Deploy web with fail-closed map consumption
4. Per Work (Deployment / authoring): set `map_capability = required` → accept geometry → publish asset → re-pin Reader-visible Locations

Rollback: set `map_capability = off` (maps inactive). Schema columns remain additive.

---

## Slices

| Slice | Scope |
| ----- | ----- |
| **L1** | Schema + resolve + CORE-001 registry |
| **L2** | Creator Work Map UI + MapPicker + Location pin bind |
| **L3** | Reader resolve + remove Westeros / `0.5` fallbacks |

---

## Runtime Truth Gate

* `map_focus` relative to `geometry_id`, never URL
* Creator and Reader consume the same `published_asset_id`
* Missing Work Map or invalid pin → no map surface (fail closed)
* No Westeros / repository-local / `(0.5, 0.5)` repair
* Scene Context remains Location identity join only

---

## Refs

* `docs/adr/014-work-map-authority-and-location-map-focus-reference-frame.md`
* `docs/specs/spec-wma-001-work-map-authority.md`
