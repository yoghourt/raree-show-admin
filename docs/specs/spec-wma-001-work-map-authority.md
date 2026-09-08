# SPEC-WMA-001 — Work Map Authority

## Metadata

| Field | Value |
| ----- | ----- |
| Title | Work Map Authority |
| Status | **Accepted** — Contract Freeze |
| Version | v0.1 |
| Owner | Architect |
| Last Updated | 2026-09-08 |
| Derived From | ADR-014 (Work Map Authority and Location Map Focus Reference Frame — Accepted) |
| Related | ADR-004 · ADR-010 · ADR-012 · SPEC-CORE-001 · SPEC-SCC-001 · SPEC-RDX-001 · SPEC-IMG-001 |
| Authorization | **Contract Accepted** · **Implementation Granted (scoped)** — `docs/spikes/implement-wma-001-work-map-authority.md` |
| Supersedes | SPEC-WMA-001 v0.1 Draft (Contract Freeze Ready A1–A3) |
| Amendment | **A1–A3** (included at Accept) — `published_asset_id` is Asset identity; URL is resolved runtime representation; current Reader consumption set is the map-ready gate; `geometry_id` means the same canonical spatial reference frame, not visual resemblance |

> **Authority boundary:** This SPEC is the downstream Runtime Contract for ADR-014. It freezes Work Map Authority meaning, coordinate reference-frame semantics, persistence ownership, publication gates, and Creator / Reader consumption rules. Implementation wiring is authorized only inside the IMPLEMENT-WMA-001 allowlist.

> **v0.1 (Contract Accepted — 2026-09-08):** Architect Accept after A1–A3. Freezes Work Map Authority contract only.

> **IMPLEMENT-WMA-001 (2026-09-08):** Scoped Implementation Authorization granted for Admin Creator path + `raree-show-web` Reader consumption. Spike remains **not granted**. Denylist in the grant still applies.

> On any conflict with ADR-014, ADR-014 prevails until amended. On conflict with ADR-004 / ADR-010 / ADR-012, those ADRs prevail. Named showcase works, providers, and map image hosts are **Deployment**, not this contract.

---

## 0. Three-State Authorization (normative)

Per `POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC` §6:

| State | SPEC-WMA-001 |
| ----- | ------------ |
| Contract Freeze | **Yes** (Accepted) |
| Spike Implementation Authorization | **Not granted** |
| Production Authorization | **Granted (scoped)** — IMPLEMENT-WMA-001 allowlist |

Wiring outside the IMPLEMENT-WMA-001 allowlist remains unauthorized. Contract semantics (A1–A3) are unchanged.

---

## 1. Purpose

Close the ADR-014 storage and consumption deferral so Location coordinates have an explicit Work-owned reference frame.

This SPEC freezes:

* Work Map Authority meaning and v1 cardinality
* persistence ownership (dedicated Work-scoped map record, not a URL)
* canonical geometry vs published visual as distinct acceptances
* `Location.map_focus` validity rules, including geometry binding
* Reader-visible pinning requirements
* map-ready publication gates and forbidden fallbacks
* Creator / Reader consumption of the same Published Work Map Asset

This SPEC does **not** freeze GIS, multi-region maps, automatic reprojection, Admin page layout, Reader component design, or Cloudinary (or any vendor) as architecture.

---

## 2. Relationship to ADR-014

| Concern | ADR-014 | SPEC-WMA-001 |
| ------- | ------- | ------------ |
| Work-scoped map authority | Decides | Contracts |
| `map_focus` relative to canonical geometry, not a URL | Decides | Defines validity and binding |
| Creator and Reader consume the same published asset | Decides | Defines resolve / consume rules |
| Scene Context is Location identity join only | Decides (ADR-012 unchanged) | Restates as invariant |
| Concrete storage representation | Deferred | **Decides** (§5) |
| Schema DDL / indexes / UI / APIs | Out of Architecture | Remain Non-goals |

**Consistency constraint:** Any interpretation that restores a Westeros / repository-local / default-coordinate fallback, or that moves coordinate authority into Scene Context, is invalid.

---

## 3. Layer classification

| Content in this SPEC | Layer |
| -------------------- | ----- |
| Work Map Authority; geometry ⊥ visual; Creator ⊥ Reader consumption of one published asset | Architecture / Runtime Contract |
| `map_capability`; Work / Location / current-consumption map-ready gates; `map_focus` validity | Runtime Contract |
| v1 dedicated `work_maps` record; `published_asset_id`; geometry binding field | Runtime Contract (persistence ownership) |
| Whole-Work pin completeness across every Reader-reachable Location | **Runtime / Product policy** — not a WMA invariant |
| Resolved map URL, Cloudinary, named map files, showcase work titles | **Forbidden as identity** → Deployment / runtime representation |
| MapPicker layout, Reader map chrome, SQL types | Implementation (not authorized by this SPEC) |

---

## 4. Definitions

### 4.1 Work Map Authority

> **Work Map Authority** is the Work-owned record that establishes (1) the Work's canonical map geometry and (2) the Published Work Map Asset registered to that geometry.

v1 cardinality: **at most one** Work Map Authority per Work.

```text
Work
 └── Work Map Authority          (0..1)
       ├── canonical geometry    (stable identity)
       └── Published Work Map Asset
```

### 4.2 Canonical map geometry

The Work's single v1 coordinate space:

```text
[0, 1] × [0, 1]
```

Geometry is a **human-accepted spatial identity**, not an image URL, not an asset id, and not an AI-generated picture.

```text
same geometry_id
        =
same canonical spatial reference frame
```

Keeping `geometry_id` is a human assertion that existing `(x, y)` continue to name the same places on that frame. Visual replacement MAY keep the same `geometry_id` only under that assertion.

Visual resemblance MUST NOT be used as the basis for retaining `geometry_id`. “Looks like the same map,” a restyled landmass, or an illustration that merely appears aligned is insufficient. If the canonical spatial reference frame changed, `geometry_id` MUST change.

Changing `geometry_id` is a geometry replacement and invalidates existing pins pending human validation.

This SPEC does **not** introduce:

* GIS coordinates
* latitude / longitude
* map projections
* multiple region coordinate spaces
* cross-map transformations

### 4.3 Published Work Map Asset

The single published visual map that Creator and Reader consume for a map-capable Work.

```text
PublishedWorkMapAsset {
  id: string    // opaque published asset identity
}
```

**A1:** `published_asset_id` is Asset identity. A URL is a **resolved runtime representation** of that id, not the identity itself. Work Map Authority MUST persist `published_asset_id`. It MUST NOT treat a URL as the published asset.

Runtime MAY resolve `published_asset_id` → URL (or another fetchable representation) for display. That resolution is Deployment / runtime, replaceable without changing geometry or pin validity.

A draft or AI-generated image is a **candidate**. It is not the Published Work Map Asset until human visual acceptance. Candidate ≠ Asset (same admission rule as ADR-010 published assets).

### 4.4 Location `map_focus`

Location Archive fields giving the Location's normalized position on the Work's canonical geometry.

`map_focus` is **not** relative to:

* a repository-local path
* a specific visual URL
* a default franchise map

### 4.5 Reader-visible Location

A Location Archive identity that Reader Runtime may need to place on the Work map.

Normative rule:

```text
Reader-visible Location
  = Location Archive tsid referenced by
    Scene Context.locationContext.archiveTsid
    on a Scene Context consumed via a Reading Route
    available to Reader Runtime
```

Consequences:

* Archive-only Locations (never referenced from Reader-consumed Scene Context) MAY omit `map_focus`.
* Scene Context location cues without `archiveTsid` do **not** create a pinning requirement.
* Duplicate Scene Context references to the same Location still require **one** Archive pin, not per-context coordinates.

Reader-visible is an identity predicate. It is **not** the v1 map-ready gate. The gate is the **current Reader consumption set** (§4.7).

### 4.7 Current Reader consumption set

The Location Archive identities referenced by Scene Contexts in the **currently consumed** Reading Route (or the equivalent current Reader map-translation request).

```text
current Reader consumption set
  = Location Archive tsid referenced by
    Scene Context.locationContext.archiveTsid
    on Scene Contexts in the current Reader consumption
```

This set is the architectural scope for Location map-ready during Reader translation.

The union of all Reader-reachable Locations across the Work is **not** a WMA architecture gate. Whole-Work pin completeness MAY be Creator / Product policy.

### 4.6 Map capability

Work-owned knob:

| Value | Meaning |
| ----- | ------- |
| `off` | This Work does not expose map functionality. Missing map is not an error. Reader MUST NOT present a map. |
| `required` | This Work exposes map functionality. Missing or invalid Work Map Authority is **not map-ready**. |

Default is `off`. Enabling `required` for a named work is a **Deployment / authoring** choice, not an architectural constant.

---

## 5. Persistence ownership (closes ADR-014 deferral)

### 5.1 Decision

ADR-014 left storage open (`work.map_asset_id` vs dedicated map table vs other).

**WMA-D1 — Dedicated Work-scoped map record.**

v1 persists Work Map Authority as a dedicated `work_maps` record:

```text
works.id  1 ── 0..1  work_maps.work_id     UNIQUE(work_id)
```

Rejected for v1:

| Option | Why rejected |
| ------ | ------------ |
| `works.map_asset_id` only | Collapses geometry identity into a visual asset pointer; visual replacement would look like geometry change |
| Coordinates or map URL on Scene Context | Violates ADR-012 / ADR-014 |
| Repository-local map path as authority | Restores the Westeros identity leak |
| Geometry stored as “whatever image MapPicker last showed” | Couples coordinates to a URL |

A single asset-id column on `works` is insufficient because geometry acceptance and visual acceptance are distinct.

**WMA-D2 — Map capability lives on Work**, not on Location and not on Scene Context.

Logical field: `Work.map_capability` (`off` \| `required`). Physical column MAY be `works.map_capability`. Implementation MUST NOT infer capability from a hard-coded work title.

**WMA-D3 — Pins remain on Location Archive**, with an explicit geometry binding.

Existing `locations.map_focus_x` / `map_focus_y` remain. v1 adds `locations.map_focus_geometry_id`, which MUST equal the current Work `geometry_id` for the pin to be valid.

### 5.2 Logical record: `work_maps`

Contract field names (SQL types are Implementation):

| Field | Required when `map_capability = required` | Meaning |
| ----- | ---------------------------------------- | ------- |
| `work_id` | yes | Owning Work (`works.id`) |
| `geometry_id` | yes | Stable opaque identity of the canonical spatial reference frame |
| `geometry_accepted_at` | yes | Human acceptance of geometry; null means geometry is not established |
| `published_asset_id` | yes | Opaque identity of the published visual registered to that geometry |
| `published_asset_accepted_at` | yes | Human acceptance of the published visual; null means not published |

`geometry_id` MUST change if and only if the canonical spatial reference frame is replaced. Replacing `published_asset_id` while keeping `geometry_id` is a visual replacement and does **not** by itself invalidate pins.

A resolved URL MUST NOT be stored as Work Map Authority identity. Runtime MAY resolve `published_asset_id` to a URL at consumption time.

### 5.3 Logical fields: Location pin

| Field | Meaning |
| ----- | ------- |
| `map_focus_x` | Normalized X in `[0, 1]`, or null |
| `map_focus_y` | Normalized Y in `[0, 1]`, or null |
| `map_focus_geometry_id` | Geometry identity this pin was authored against, or null |

Pairing rules:

* `x` and `y` are both null, or both present. Mixed presence is invalid.
* If `x`/`y` are present, `map_focus_geometry_id` MUST be present.
* If `x`/`y` are null, `map_focus_geometry_id` MUST be null.

`map_focus_*` remain `classification: asset` and Copilot-`excluded` (ADR-004 FC-03). Implementation that adds `map_focus_geometry_id` MUST register it in SPEC-CORE-001 with the same classification before it becomes a form field. This SPEC does not itself amend CORE-001.

### 5.4 What this SPEC still does not freeze

* Exact PostgreSQL types, indexes, RLS, or migration filenames
* Whether `map_capability` is an enum type or a text check
* API routes and TypeScript module layout
* Cloudinary folder conventions

Those belong to a later Implementation Grant.

---

## 6. Ownership contract

```text
Work
 ├── map_capability
 └── Work Map Authority          (work_maps)
       ├── canonical geometry
       └── Published Work Map Asset

Location Archive
 └── map_focus_x/y + map_focus_geometry_id

Scene Context
 └── Location identity join (archiveTsid) only

Creator Runtime
 └── maintains / consumes Published Work Map Asset

Reader Runtime
 └── consumes Published Work Map Asset only
```

| Concern | Owner |
| ------- | ----- |
| Whether this Work exposes a map | Work (`map_capability`) |
| Canonical geometry identity | Work Map Authority |
| Published map visual | Work Map Authority |
| Location position | Location Archive |
| Which Location this narrative moment uses | Scene Context |
| Map chrome / animation | Reader representation (not this SPEC) |

Scene Context MUST NOT store map URLs or coordinates. Reading Route MUST NOT own map authority.

---

## 7. Geometry ⊥ visual

Canonical geometry and visual presentation are separate acceptances.

```text
Human accepts geometry     → geometry_id + geometry_accepted_at
Human accepts visual       → published_asset_id + published_asset_accepted_at
```

Rules:

| ID | Rule |
| -- | ---- |
| WMA-GV-01 | AI MAY participate in visual styling / illustration / map skin generation as a candidate |
| WMA-GV-02 | AI output alone MUST NOT set `geometry_id` or `geometry_accepted_at` |
| WMA-GV-03 | Accepting a visual asset MUST NOT be treated as geometry acceptance |
| WMA-GV-04 | Visual replacement MAY preserve pins only when the human accepts the same `geometry_id` because the canonical spatial reference frame is unchanged |
| WMA-GV-05 | `geometry_id` change MUST treat existing pins as requiring human validation |
| WMA-GV-06 | No automatic reprojection is authorized |
| WMA-GV-07 | Visual resemblance MUST NOT justify retaining `geometry_id` |

For Works with independently verifiable spatial relationships, geometry SHOULD be established against those relationships. For fictional Works, geometry MAY be curated against the Work's world rules. In both cases a human must accept geometry. Same-frame acceptance is a spatial-identity judgment, not a “looks similar” judgment.

---

## 8. Coordinate validity

A Location pin is **valid** iff all of the following hold:

1. The owning Work has Work Map Authority with non-null `geometry_id` and `geometry_accepted_at`.
2. `map_focus_x` and `map_focus_y` are numbers in `[0, 1]`.
3. `map_focus_geometry_id` equals the current Work `geometry_id`.

A pin is **invalid** (not map-ready) if any of the following hold:

* missing `x`/`y` when the Location is in the current Reader consumption set
* `x`/`y` present but `map_focus_geometry_id` missing (includes all current Westeros-derived pins)
* `map_focus_geometry_id` ≠ current Work `geometry_id`
* values outside `[0, 1]`
* Work geometry not accepted

Runtime MUST NOT repair invalid pins with `(0.5, 0.5)` or any other default.

The only v1 spatial operation is visual translation on one Work plane:

```text
Location A.map_focus
        ↓
Work canonical geometry
        ↓
visual translation on Published Work Map Asset
        ↓
Location B.map_focus
```

---

## 9. Map-ready gates

### 9.1 Work map-ready

A Work with `map_capability = required` is map-ready iff:

* a `work_maps` row exists for that Work
* `geometry_id` is set and `geometry_accepted_at` is set
* `published_asset_id` is set
* `published_asset_accepted_at` is set

A Work with `map_capability = off` is not a map failure. Map surfaces MUST stay inactive.

### 9.2 Location map-ready

* Archive-only Location: pin MAY be absent.
* Location in the **current Reader consumption set** (§4.7): pin MUST be valid under §8.
* Other Reader-reachable Locations on the same Work: **not** a WMA gate. Product policy MAY still ask Creator to pin them.

### 9.3 Experience map-ready

Reader map translation MAY run only when:

* the Work is map-ready; and
* every Location in the **current Reader consumption set** is map-ready.

A missing pin on a Location that is Reader-reachable on another Route, but not in the current consumption set, MUST NOT by itself block the current translation.

Whole-Work pin completeness is **Runtime / Product policy**, not a WMA architecture invariant. Creator MAY use it as an editorial checklist. Runtime MUST NOT treat whole-Work completeness as a WMA gate.

### 9.4 Forbidden fallbacks

The runtime MUST NOT hide missing authority with:

```text
Westeros map
default map
repository-local map
hard-coded Cloudinary map URL as Work-independent authority
default coordinate such as (0.5, 0.5)
```

Missing authority remains missing.

The objective is **not** “always display some map.” The objective is: display a map that belongs to the current Work and position Locations against an explicit coordinate reference frame.

Current `MapPicker` hard-coded Westeros URL is **legacy non-authority**. It MUST NOT be treated as Work Map Authority. Removal requires a later Implementation Grant; this SPEC does not authorize that change by itself.

---

## 10. Resolve contract

Creator MapPicker and Reader map consumption MUST resolve through the same Work-scoped authority. Conceptual result:

```text
WorkMapResolution
  | { status: "not_applicable" }
  | { status: "not_map_ready", reasons: WorkMapNotReadyReason[] }
  | { status: "ready", geometry_id, published_asset_id }
```

| Work state | Result |
| ---------- | ------ |
| `map_capability = off` | `not_applicable` |
| `required` but geometry or published asset missing / unaccepted | `not_map_ready` |
| `required` and Work map-ready | `ready` |

When status is `ready`, Creator pinning UI MUST display the **resolved representation** of `published_asset_id` (typically a URL), not a draft candidate and not a repository-local default. The resolved URL is presentation only; `published_asset_id` remains the identity.

When status is `not_map_ready`, Creator MUST NOT silently pin against a fallback image. Reader MUST NOT render a substitute map.

Reader MUST NOT:

* generate a map locally
* generate a map at read time via Image Port
* select a map independently of Work Map Authority
* fall back to a repository-local map

Creator MAY invoke Image Port to produce **visual candidates** (ADR-010). Candidates do not become Published Work Map Asset, and do not establish geometry, without human acceptance (§7).

---

## 11. Producer / consumer

### 11.1 Creator

**May:**

* set `map_capability`
* establish and accept canonical geometry
* upload or generate visual candidates
* accept a visual as Published Work Map Asset against an accepted geometry
* author Location `map_focus` against the accepted geometry

**Must not:**

* treat visual acceptance as geometry acceptance
* pin against Westeros / any Work-independent map
* copy coordinates into Scene Context
* auto-reproject pins when `geometry_id` changes

### 11.2 Reader

**Consumes:**

* Published Work Map Asset (`published_asset_id`; URL only as resolved representation)
* valid Location pins for the current Reader consumption set
* Scene Context only as Location identity join (`archiveTsid`)

**Must not consume as authority:**

* Creator draft map candidates
* repository-local files
* Scene Context coordinates (they must not exist)
* Copilot-suggested coordinates (FC-03)

Reader map presentation is an RDX consumption concern. This SPEC authorizes **which asset and which coordinates** Reader may use; it does not specify map UI.

### 11.3 Discovery / Copilot

`map_focus_x` / `map_focus_y` / `map_focus_geometry_id` remain Asset and Copilot-excluded. Discovery MUST NOT enrich coordinates (ADR-004 FC-03 unchanged).

---

## 12. Migration

Existing `map_focus_x/y` values were authored against an implicit Westeros visual. They have no `geometry_id`.

Normative migration rules:

| Rule | Normative |
| ---- | --------- |
| Silently treat Westeros-derived `x/y` as valid on a new Work geometry | **MUST NOT** |
| Automatically reproject Westeros-derived coordinates | **MUST NOT** |
| Missing `map_focus_geometry_id` with present `x/y` | **invalid** until human re-pin / re-accept against the Work geometry |
| Complete every Archive Location for every Work | **MUST NOT** |
| Require valid pins only for Locations in the current Reader consumption set on map-required Works | **MUST** |

Human validation happens **after** the relevant Work Map Authority and canonical geometry exist. There is no proven transform from the old implicit frame to a new Work geometry; automatic migration would create false precision.

---

## 13. Invariants

| ID | Invariant |
| -- | --------- |
| WMA-INV-01 | Work owns Published Work Map Authority; Location Archive owns `map_focus` |
| WMA-INV-02 | `map_focus` is relative to Work `geometry_id`, never to a URL or `published_asset_id` |
| WMA-INV-03 | v1: at most one canonical coordinate space per Work, `[0,1] × [0,1]` |
| WMA-INV-04 | Scene Context remains a Location identity join and MUST NOT store map coordinates or map URLs |
| WMA-INV-05 | Creator and Reader consume the same Published Work Map Asset identity (`published_asset_id`) |
| WMA-INV-06 | Canonical geometry cannot be established solely by AI-generated output |
| WMA-INV-07 | Visual replacement preserves pins only while `geometry_id` is unchanged; unchanged `geometry_id` means the same canonical spatial reference frame, not visual resemblance |
| WMA-INV-08 | `geometry_id` change requires human validation of existing pins |
| WMA-INV-09 | Locations in the current Reader consumption set on a map-required Work require a valid pin |
| WMA-INV-10 | Missing Work Map or missing required pin MUST NOT fall back to Westeros, another default map, or a default coordinate |
| WMA-INV-11 | ADR-004 FC-03 remains unchanged |
| WMA-INV-12 | ADR-010 Creator ⊥ Reader and unified published assets remain unchanged |
| WMA-INV-13 | ADR-012 Location identity join remains unchanged |
| WMA-INV-14 | ADR-002 remains unchanged |

---

## 14. Forbidden patterns

| ID | Forbidden pattern |
| -- | ----------------- |
| WMA-FORB-01 | Work-independent hard-coded map (including current Westeros Cloudinary URL) used as authority |
| WMA-FORB-02 | `map_focus` defined relative to `published_asset_id` or a resolved URL rather than `geometry_id` |
| WMA-FORB-03 | Scene Context or Reading Route stores coordinates or map URLs |
| WMA-FORB-04 | Reader generates or independently selects a map |
| WMA-FORB-05 | Default coordinate fill `(0.5, 0.5)` or equivalent |
| WMA-FORB-06 | Automatic reprojection of Westeros-derived pins |
| WMA-FORB-07 | AI visual output treated as canonical geometry |
| WMA-FORB-08 | Requiring every Location Archive row to have `map_focus` |
| WMA-FORB-09 | Multiple region maps or cross-map transforms in v1 |
| WMA-FORB-10 | Copilot / Discovery writing `map_focus_*` |
| WMA-FORB-11 | Treating Contract Freeze as Implementation Authorization |
| WMA-FORB-12 | Freezing a showcase work title as the architectural map Work |
| WMA-FORB-13 | Treating a resolved URL as Published Work Map Asset identity (including persisting URL in place of `published_asset_id`) |
| WMA-FORB-14 | Retaining `geometry_id` because the new visual looks similar |
| WMA-FORB-15 | Treating whole-Work pin completeness as a WMA architecture gate |

---

## 15. Non-goals

Out of scope for SPEC-WMA-001:

* executing SQL migrations or Admin / Reader code
* MapPicker UX beyond the resolve/consume rules in §10
* Reader map animation, clustering, or routing
* GIS, lat/lng, projections, zoom pyramids
* multi-region maps and cross-map transitions
* automatic coordinate migration
* Image Port provider / model selection (ADR-010 / Deployment)
* amending SPEC-CORE-001 field rows (required later, not done here)
* RDX Reader Step redesign
* publication / Rollout rules for when a Reading Route is “available to Reader” (consumed as given)

---

## 16. Open questions

Architectural / contract-adjacent — **must not be closed by v0.1 Acceptance**:

1. **Draft visual preview:** Whether Creator MAY preview an unaccepted visual without pinning against it — presentation only; pinning against drafts remains forbidden.
2. **Whole-Work completeness as Product policy:** Whether Creator surfaces nudge or hard-block unpublished Routes when other Work Locations are unpinned. Not a WMA invariant; not closed here.
3. **Geometry evidence artifact:** Whether v2 stores an auditable geometry reference image or only `geometry_id` + timestamp. v1 requires human-auditable acceptance, not a second asset type.
4. **`map_capability` physical column** vs a row in `work_maps` as the sole capability signal. v0.1 prefers an explicit Work field so `required` can exist before the map row is complete.
5. **Multi-map v2** remains deferred until a cross-map contract exists (ADR-014 Alternative G).
6. **Asset registry shape** for `published_asset_id` (existing media identity vs map-specific id). Identity ≠ URL is frozen; physical asset table is Implementation.

---

## Review Gate (v0.1 — Accepted, A1–A3)

### Architecture

* [x] Work is the authority for the Published Work Map
* [x] Location Archive remains the authority for `map_focus`
* [x] `map_focus` is relative to Work canonical geometry, not a URL
* [x] Scene Context remains a Location identity join
* [x] Creator and Reader consume the same Published Work Map Asset identity (`published_asset_id`)
* [x] Dedicated `work_maps` record closes the ADR-014 storage deferral
* [x] Geometry binding makes Westeros-derived pins invalid until human revalidation
* [x] **A1:** Asset identity is `published_asset_id`; URL is resolved runtime representation
* [x] **A2:** Experience map-ready is the current Reader consumption set; whole-Work completeness is Product policy
* [x] **A3:** `same geometry_id` = same canonical spatial reference frame; visual resemblance is not geometry identity

### Governance

* [x] Contract Freeze ≠ Spike ≠ Production
* [x] Does not freeze vendors, showcase titles, UI, or SQL types
* [x] Does not grant implementation
* [x] ADR-004 / ADR-010 / ADR-012 / ADR-002 unchanged

### Product alignment

* [x] Map-required Work without authority fails closed
* [x] Archive-only Locations need not be pinned
* [x] Visual skins can change without coordinate churn only when the spatial reference frame is unchanged

---

## Refs

* `docs/adr/014-work-map-authority-and-location-map-focus-reference-frame.md`
* `docs/adr/004-source-of-canonical-truth.md`
* `docs/adr/010-image-runtime-and-policy.md`
* `docs/adr/012-scene-context-runtime-boundary.md`
* `docs/specs/spec-core-001-entity-schema-registry.md`
* `docs/specs/spec-scc-001-scene-context-contract.md`
* `docs/specs/spec-rdx-001-runtime-reading-experience.md`
* `docs/specs/spec-img-001-image-generation-port.md`
* `governance/specs/POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC.md`

---

## Legacy Alias Reference

This SPEC uses Runtime vocabulary and therefore retains the required alias reference.

| Normative Term  | Legacy Term | Classification       | Status |
| --------------- | ----------- | -------------------- | ------ |
| Reading Route   | Scene       | Implementation Alias | Active |
| Reading Frame   | Story Image | Implementation Alias | Active |
| Frame Narrative | caption     | Documentation Alias  | Active |
| Route Synopsis  | summary     | Documentation Alias  | Active |
