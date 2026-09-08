# ADR — Work Map Authority and Location Map Focus Reference Frame

- **Status:** Accepted
- **Date:** 2026-09-08
- **Decision Type:** Architecture
- **Scope:** Work Map Authority / Location `map_focus` / Published Map Asset / Reader / Creator
- **Supersedes:** None
- **Related:** ADR-004, ADR-010, ADR-012
- **Explicitly Unchanged:** ADR-002

## What

Raree Show introduces a Work-scoped **Work Map Authority**.

A Work that exposes map functionality owns the authority for its published map. The Work Map Authority defines:

- the Work's canonical map geometry reference frame; and
- the published visual map asset consumed by both Creator and Reader.

`Location.map_focus_x/y` remains owned by the Location Archive and is defined as normalized coordinates relative to the canonical map geometry of the relevant Work.

The coordinate contract is therefore:

```text
Location.map_focus_x/y
        │
        │ relative to
        ▼
Work canonical map geometry
```

and not:

```text
Location.map_focus_x/y
        │
        │ relative to
        ▼
repository-local URL
specific image URL
default Westeros map
```

Scene Context remains a Location identity join and does not become a map or coordinate authority.

The architecture adopts the following authority split:

```text
Work
    = Published Work Map Authority

Location Archive
    = map_focus authority

Scene Context
    = Location identity join

Creator
    = Work Map maintainer / consumer

Reader
    = Published Work Map consumer
```

Creator and Reader must consume the same Published Work Map Asset.

This ADR does not freeze the concrete storage representation of Work Map Authority. Whether the implementation uses `work.map_asset_id`, a dedicated map table, or another representation remains a subsequent specification decision.

## Why

The current runtime can resolve a Location through the existing Scene Context → Location Archive join, but it has no Work-scoped map asset authority.

Reader and Admin/Creator currently rely on a repository-local Westeros map selection. This creates a broken identity path:

```text
Three Kingdoms Work
        ↓
Three Kingdoms Location
        ↓
Westeros map
```

The issue is therefore not merely a wrong URL. The missing architectural boundary is:

> Work Map Authority and the coordinate reference frame of `Location.map_focus`.

Raree Show currently needs map functionality only for a Reader experience in which the visible map translates between locations. It does not require a GIS, a general spatial graph, or cross-map coordinate transformation.

The architecture must therefore solve the actual product requirement without introducing an unnecessary spatial model:

```text
Location A
    ↓
stable position on one Work map plane
    ↓
visual translation
    ↓
Location B
```

At the same time, a large number of Location coordinates should not require re-authoring merely because the visual appearance of a map changes.

The governing principle is therefore:

> **Canonical geometry must remain stable independently of replaceable visual map presentation.**

This also preserves existing architectural boundaries:

- ADR-004 FC-03 remains unchanged: this ADR does not introduce hidden Copilot coordinate enrichment.
- ADR-010 remains unchanged: Creator and Reader stay separated while consuming unified published assets.
- ADR-012 remains unchanged: Scene Context continues to join Location identity and does not acquire coordinate authority.
- ADR-002 remains unchanged.



## How



### 1. Work-scoped Map Authority

Each Work requiring map functionality has one explicit Work Map Authority in v1.

Conceptually:

```text
Work
└── Work Map Authority
    ├── canonical map geometry
    └── Published Work Map Asset
```

v1 uses one canonical coordinate space per Work.

The coordinate space is normalized:

```text
[0,1] × [0,1]
```

This ADR does not introduce:

- GIS coordinates;
- latitude / longitude;
- map projections;
- multiple region coordinate spaces;
- cross-map transformations.

Multiple maps or multiple coordinate spaces are deferred. They require a separate spatial contract before they can be introduced.

### 2. Location `map_focus` Contract

`map_focus_x/y` remains Location Archive data.

Its normative meaning is:

> The normalized position of a Location within the canonical map geometry of its relevant Work.

Location does not become relative to a particular asset URL.

A visual replacement may therefore preserve all existing coordinates when the canonical geometry remains unchanged:

```text
Canonical Geometry G1
        │
        ├── Visual Map A
        ├── Visual Map B
        └── Visual Map C

Location.map_focus_x/y
        └── remains valid
```

If canonical geometry changes:

```text
Canonical Geometry G1
        ↓
Canonical Geometry G2
```

existing coordinates must be treated as requiring human validation.

No automatic reprojection is implied or authorized by this ADR.

### 3. Geometry and Visual Style Separation

Canonical geometry and visual map presentation are separate architectural concerns.

AI may participate in:

- visual styling;
- illustration;
- visual transformation;
- map skin generation.

AI-generated imagery alone must not establish canonical geometry authority.

Canonical geometry must be independently established and human-auditable.

For Works with independently verifiable spatial relationships, geometry should be established against those relationships.

For fictional Works, geometry may be independently curated against the Work's world rules and accepted spatial relationships.

The rule is:

> **AI may participate in map presentation, but AI output alone is not canonical spatial authority.**

Human acceptance of a visual asset does not automatically prove geometry correctness. Geometry acceptance and visual asset acceptance remain distinct concerns.

### 4. Published Asset Topology

Creator and Reader consume the same Published Work Map Asset:

```text
                    Published Work Map Asset
                   /                        \
                  ▼                          ▼
              Creator                      Reader
```

Creator may maintain and publish the asset.

Reader only consumes the published asset.

Reader must not perform:

- local map generation;
- runtime AI map generation;
- independent map selection;
- repository-local map fallback.



### 5. Scene Context Boundary

ADR-012 remains unchanged.

The existing topology remains:

```text
Reader
  ↓
Scene Context
  ↓
Location identity
  ↓
Location Archive
  ↓
map_focus
```

Scene Context owns neither Work Map Authority nor `map_focus`.

No map coordinate is duplicated into Scene Context.

### 6. Pinning Requirement

Not every Location Archive entry must have map coordinates.

The requirement is visibility-based:

```text
Archive-only Location
    → map_focus may be absent

Reader-visible Location
    → valid map_focus is required
```

Migration and authoring therefore follow Reader-visible requirements rather than Archive completeness.

### 7. Migration

Existing coordinates derived from the current Westeros map must not be:

- silently migrated;
- automatically reprojected; or
- automatically trusted against a newly established canonical geometry.

They require human validation once the relevant Work Map Authority and canonical geometry are established.

Three Kingdoms and other Works do not require Archive-wide coordinate completion. Only Reader-visible Locations require valid coordinates.

### 8. Failure and Publication Gate

A Work requiring map functionality without a valid Published Work Map is not map-ready.

A Reader-visible Location without valid `map_focus` is not map-ready.

The runtime must not hide either condition through:

```text
Westeros fallback
default map
repository-local map
default coordinate such as (0.5, 0.5)
```

Missing authority remains missing.

The architectural objective is not:

> Always display some map.

The objective is:

> Display a map that belongs to the current Work and position Locations against an explicit coordinate reference frame.



## Validation

Executed commands:

```bash
# No implementation commands executed.
# This ADR is validated at the architecture decision level before execution.
```

Invariant checks:

- [x] Work is the authority for the Published Work Map.
- [x] Location Archive remains the authority for `map_focus_x/y`.
- [x] `map_focus_x/y` is relative to Work canonical map geometry, not a URL.
- [x] Scene Context remains a Location identity join.
- [x] Creator and Reader consume the same Published Work Map Asset.
- [x] Canonical geometry cannot be established solely by AI-generated output.
- [x] Visual replacement may preserve coordinates only when canonical geometry remains stable.
- [x] Canonical geometry change requires human validation of existing coordinates.
- [x] Reader-visible Locations require valid `map_focus`.
- [x] Missing Work Map must not fall back to Westeros or another default map.
- [x] Missing required `map_focus` must not fall back to a default coordinate.
- [x] ADR-004 FC-03 remains unchanged.
- [x] ADR-010 Creator ⊥ Reader and published asset unification remain unchanged.
- [x] ADR-012 Location identity join remains unchanged.
- [x] ADR-002 remains unchanged.



## Refs

- Constitution: `Constitution.md`
- Governance:
  - `ADR-004`
  - `ADR-010`
  - `ADR-012`
- ADR:
  - `ADR-002` — explicitly unchanged

---



## Decision

**Accepted.**

Raree Show adopts a Work-scoped Work Map Authority.

The authoritative ownership model is:

```text
Work
 └── Published Work Map Authority
       ├── canonical map geometry
       └── Published Work Map Asset

Location Archive
 └── map_focus_x/y
       └── relative to Work canonical map geometry

Scene Context
 └── Location identity join

Creator
 └── maintains / consumes Published Work Map Asset

Reader
 └── consumes Published Work Map Asset
```

The primary architectural rule is:

> **Stable canonical geometry first; replaceable visual map presentation second.**

`Location.map_focus_x/y` is not relative to a repository-local URL or a globally assumed map.

v1 uses one canonical coordinate space per Work.

Concrete schema representation is intentionally deferred.

---



## Alternatives Considered



### A. Keep the repository-local Westeros map and replace the URL per implementation site

**Rejected.**

This treats the symptom rather than establishing authority.

It preserves duplicated map selection and allows Reader and Creator to diverge.

### B. Make `map_focus_x/y` relative to the current visual asset URL

**Rejected.**

Coordinates would become implicitly coupled to a particular asset representation.

Visual replacement would unnecessarily invalidate Location coordinates.

### C. Introduce `Location → Map Node → Geometry` as the v1 spatial model

**Deferred.**

This provides a richer spatial abstraction, but it does not remove the need for geometry. It moves coordinate ownership into an additional geometry layer.

Raree Show's current Reader requirement is only visual translation between known Locations. Introducing a node graph, spatial lookup layer, or cross-map model would add complexity without satisfying a current requirement.

This remains a possible future evolution if Raree Show develops a genuine Work spatial model.

### D. Let AI-generated maps establish canonical geometry directly

**Rejected.**

Generated visual plausibility is not sufficient spatial authority.

AI-generated output may participate in presentation, but geometry must remain independently established and human-auditable.

### E. Automatically reproject existing Westeros-derived coordinates

**Rejected.**

No proven transformation exists between the old implicit reference frame and a new Work canonical geometry.

Automatic migration would create false precision.

### F. Require every Location Archive entry to have `map_focus`

**Rejected.**

Archive completeness is not required for the current Reader experience.

Only Reader-visible Locations require valid coordinates.

### G. Introduce multiple region maps in v1

**Deferred.**

Multiple coordinate spaces require an explicit cross-map transformation contract.

The current Reader experience does not require this complexity.

## Trade-offs



### Accepted costs

- Each Work requiring map functionality must establish a canonical geometry.
- Reader-visible Locations must be manually validated or authored against that geometry.
- Geometry changes may require large-scale coordinate revalidation.
- Geometry acceptance and visual asset acceptance are separate review concerns.
- Works cannot use an implicit global fallback map.



### Deliberately accepted limitation

v1 does not optimize for:

- GIS-grade spatial accuracy;
- arbitrary geographic zoom hierarchies;
- multi-region maps;
- automatic coordinate migration;
- cross-map visual transitions.



### Benefit

The architecture gains:

- explicit Work Map Authority;
- a stable reference frame for Location coordinates;
- visual asset replaceability without unnecessary coordinate churn;
- unified Creator and Reader map consumption;
- no Work identity leakage into a hard-coded Westeros map;
- no silent fallback that masks missing authority;
- no unnecessary spatial model complexity.

---



## Legacy Alias Reference

This ADR uses Runtime vocabulary and therefore retains the required alias reference.


| Normative Term  | Legacy Term | Classification       | Status |
| --------------- | ----------- | -------------------- | ------ |
| Reading Route   | Scene       | Implementation Alias | Active |
| Reading Frame   | Story Image | Implementation Alias | Active |
| Frame Narrative | caption     | Documentation Alias  | Active |
| Route Synopsis  | summary     | Documentation Alias  | Active |


