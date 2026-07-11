# SPEC-ROL-002 — Editorial Scene Projection Semantics

## Metadata

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Title        | Editorial Scene Projection Semantics                                  |
| Status       | **Draft** (Design Only) — **Changes Requested revision**              |
| Version      | v0.2                                                                  |
| Owner        | Architect                                                             |
| Last Updated | 2026-07-11                                                            |
| Derived From | ADR-007 v1.2 (`docs/adr/007-rollout-architecture.md`)                 |
| Related      | ADR-004, ADR-005 v2.0, ADR-006 v1.3, SPEC-ROL-001, SPEC-D3-002        |
| Supersedes   | SPEC-ROL-002 v0.1 (withdrawn — capability drift; see Architect Review 2026-07-11) |

**Architect Review (2026-07-11):** v0.1 incorrectly owned **Runtime Reading Experience** semantics under the Rollout namespace. v0.2 restores **Projection-only** scope. Reader progression, navigation, caption rendering, session, and Assistant consumption belong to **SPEC-RDX-001** (Accepted — separate capability).

**Authority boundary:** This SPEC defines **Governed Projection semantics** for Editorial **Approved Scene unit → Reading Route** association — **identity, mapping, integrity, lifecycle, and acceptance** — stopping **before** any Reader interaction begins. It does **not** amend ADRs or Runtime topology.

---

## 1. Purpose

ADR-007 v1.2 defers **Editorial Scene ↔ Runtime Reading Route / Reading Frame** governed mapping to downstream SPEC (architecture layer). SPEC-ROL-001 (Implemented) closes the **operator Projection Accept** path: Approved Scene staging → Reading Route record create or link.

SPEC-ROL-002 closes the **semantic projection contract** that ROL-001 operationalizes:

> **What does it mean — at the Rollout / Projection layer — for an Approved Editorial Scene unit to be governably associated with a Runtime Reading Route, without identity merge and without extending into Reader behavior?**

**Projection ends when:** a human-accepted association exists between an **Approved Scene unit** (Editorial) and a **Reading Route** (Runtime container), plus optional **Story ↔ Reading Route** link metadata per ADR-007. **Everything after a Reader consumes Runtime objects is out of scope.**

---

## 2. Scope

### In Scope

- Projection responsibility matrix (**Projection layer only**)
- Editorial Scene → Reading Route projection lifecycle (phases 1–6 below)
- Projection metadata contract (abstract shapes — not storage)
- Projection integrity and acceptance semantics
- Runtime **metadata produced by Projection** (association records, provenance pointers)
- Projection invariants (ROL2-PR-*)
- Open Questions **limited to projection** (mapping, integrity, lifecycle)

### Out of Scope

| Topic | Owner |
| ----- | ----- |
| Reader progression, navigation, resume | **SPEC-RDX-001** (Accepted) |
| Scene-aware frame grouping, Reader Step traversal | **SPEC-RDX-001** |
| Frame Narrative / `caption` rendering semantics | **SPEC-RDX-001** + RV-05 |
| Assistant context, spoiler gates, session commit | **SPEC-RDX-001** + web specs |
| Rollout operator UX, API routes, persistence implementation | SPEC-ROL-001 (Implemented) |
| Discovery, Review Accept | SPEC-D3-002 |
| Database schema, migrations | Implementation (post-SPEC) |
| ADR amendment | Architecture ADR chain |

### Boundary with SPEC-ROL-001

| SPEC-ROL-001 | SPEC-ROL-002 |
| -------------- | -------------- |
| **How** operators perform Projection Accept (workflows, routes, validation hooks) | **What** Scene projection **means** as a governed semantic contract |
| Implemented operator behaviors | Abstract projection metadata + integrity rules |
| Story unit persist, link CRUD | Projection lifecycle + acceptance semantics |

ROL-001 MUST remain consistent with ROL-002 semantics. ROL-002 MUST NOT contradict ROL-001 Implemented behavior.

---

## 3. Foundational Constraints (Inherited)

| Constraint | Source |
| ---------- | ------ |
| Story ↔ Reading Route: orthogonal, N:M, identity merge prohibited | ADR-007 Decision 2 |
| Editorial Scene ≠ Reading Route; ≠ Reading Frame | ADR-005 Decision 10; NIM-INV-06 |
| Editorial Scene ↔ Runtime mapping deferred at architecture layer to SPEC | ADR-007 §Deferred Decisions |
| No new Runtime routable entity | ADR-007 Decision 3; ROL-INV-01 |
| Discovery Accept ≠ Projection Accept | SPEC-ROL-001 ROL-RC-02 |
| Human Acceptance Gate on every projection decision | ADR-004 Decision 2; ROL-INV-03 |
| Scene MUST NOT define Story boundaries | NIM-INV-07 |

**Note:** NIM-INV-06 (progression authority at Editorial Scene) governs **Editorial** semantics. It informs **why** Scene projection exists but does **not** authorize this SPEC to define Reader progression — that is **SPEC-RDX-001**.

---

## 4. Projection Responsibility Matrix

| Construct | Projection role | In scope for ROL-002? | Owner after projection completes |
| --------- | --------------- | --------------------- | -------------------------------- |
| **Approved Story unit** | Editorial source for optional Story ↔ Route **link** projection | Partial (link semantics only) | Editorial + link metadata (ROL-001) |
| **Approved Scene unit** | Editorial **source** of Scene projection | **Yes** | Editorial record + projection metadata |
| **Story Projection** | N:M **association metadata**: Approved Story unit ↔ Reading Route identity | **Yes** | Rollout metadata (ROL-001) |
| **Scene Projection** | **Association metadata**: Approved Scene unit ↔ Reading Route identity (container target) | **Yes** | Rollout metadata + Route record reference |
| **Reading Route** | **Projection target** (Runtime container identity) | **Yes** (as target only) | Runtime Domain (ADR-004) |
| **Reading Frame** | Content representation inside Route | **No** — not a projection mapping endpoint for Scene in this SPEC | Production / CORE-001; consumed by Reader |
| **Frame Narrative (`caption`)** | — | **No** | **SPEC-RDX-001** |

### Normative identities (Projection layer)

```text
Story Projection   = governed link:  Approved Story unit  ↔  Reading Route ID   (N:M)
Scene Projection   = governed link:  Approved Scene unit  ↔  Reading Route ID   (operator-accepted target)
Reading Route ID   = Runtime container business identity (implementation: scene tsid)
```

**Prohibited:**

- `Approved Scene unit = Reading Route` (identity merge)
- `Approved Scene unit = Reading Frame` (identity merge)
- Silent projection (without Human Acceptance)
- Discovery Review Accept substituting for Projection Accept

---

## 5. Projection Lifecycle

Projection lifecycle **ends** at Reading Route association. Phases 7+ belong to Production authoring and Runtime Reading — **not** Rollout Projection.

```text
┌──────────────────────────────────────────────────────────────┐
│ EDITORIAL DOMAIN                                              │
├──────────────────────────────────────────────────────────────┤
│ P1  Narrative → Story / Scene Candidates                      │
│ P2  Human Review → Approved Story unit / Approved Scene unit  │
│     Owner: ADR-005, ADR-006, SPEC-D3-002                      │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ PROJECTION DOMAIN (this SPEC + SPEC-ROL-001)                  │
├──────────────────────────────────────────────────────────────┤
│ P3  Staging handoff (AcceptedSceneCandidateStaging)           │
│ P4  Story Projection Accept (optional)                        │
│     Output: Story ↔ Reading Route link metadata               │
│ P5  Scene Projection Accept                                   │
│     Output: Scene ↔ Reading Route association metadata        │
│     Operator action: create new Route OR link existing Route  │
│     Owner: ROL-001 implements; ROL-002 defines semantics      │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ PROJECTION COMPLETE BOUNDARY ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ RUNTIME DOMAIN (downstream — NOT ROL-002)                     │
├──────────────────────────────────────────────────────────────┤
│ P6+ Frame authoring, Reader serve, progression, Assistant     │
│     Owner: Production, SPEC-RDX-001, raree-show-web           │
└──────────────────────────────────────────────────────────────┘
```

### Phase table

| Phase | Trigger | Projection output | Human Accept |
| ----- | ------- | ----------------- | ------------ |
| P3 | Rollout import of staging | Eligible Scene unit for projection | Prior Review Accept |
| P4 | Link Accept | `StoryProjectionLink` metadata | Yes |
| P5 | Projection Accept | `SceneProjectionLink` metadata + Route ID reference | Yes |

### Abstract metadata contract (Projection outputs)

These are **semantic shapes** — not database designs.

**StoryProjectionLink**

- `workId`
- `approvedStoryUnitId` (Editorial)
- `readingRouteId` (Runtime container; implementation: scene tsid)
- `acceptedAt`, `acceptedBy` (provenance)
- **MUST NOT** imply 1:1 identity merge

**SceneProjectionLink**

- `workId`
- `approvedSceneUnitId` (Editorial; parent Story reference required)
- `readingRouteId` (Runtime container target)
- `projectionMode`: `create_route` | `link_existing_route`
- `acceptedAt`, `acceptedBy` (provenance)
- **MUST NOT** imply Editorial Scene = Reading Route

**ProjectionProvenance** (optional cross-cutting)

- `sourceStagingId` / staging snapshot reference (from SPEC-D3-002)
- `rol001OperationId` (trace to operator action)

---

## 6. Projection Integrity & Acceptance Semantics

**ROL2-PR-01 — Projection requires explicit acceptance**

Every `StoryProjectionLink` and `SceneProjectionLink` MUST be created only through an explicit operator action satisfying ADR-004 Decision 2. Discovery Accept MUST NOT create projection links.

**ROL2-PR-02 — Work scope integrity**

Projection links MUST be scoped to a single `workId`. Cross-work Route references MUST be rejected.

**ROL2-PR-03 — Editorial source integrity**

`approvedSceneUnitId` MUST reference a valid Approved Scene unit within an Approved Story unit (ADR-005 parent-child). Scene projection MUST NOT substitute for Story boundary adjudication (NIM-INV-07).

**ROL2-PR-04 — Target integrity**

`readingRouteId` MUST reference an existing or concurrently-created Reading Route within the same Work. Projection Accept MUST NOT target Reading Frame ordinals or Frame-level identities as projection endpoints.

**ROL2-PR-05 — Idempotence class**

Duplicate `(approvedSceneUnitId, readingRouteId)` pairs MUST be rejected (association metadata only — not duplicate Routes).

**ROL2-PR-06 — Unlink semantics (projection layer)**

Removing a SceneProjectionLink MUST NOT silently delete the Reading Route or Approved Scene unit unless a separate explicit operator delete is performed (ROL-INV-02 spirit).

**ROL2-PR-07 — Topology preservation**

Scene projection MUST NOT introduce routable Runtime nodes or alter `Work → Reading Route → Reading Frame` topology (ROL-INV-01).

**ROL2-PR-08 — ROL-001 precedence**

Where operational behavior is defined, SPEC-ROL-001 **Implemented** prevails. ROL-002 governs **semantic meaning** of projection metadata only.

---

## 7. Relationship to ADR-007 Closure Model

| ADR-007 closure | ROL-002 role |
| --------------- | ------------ |
| **Approved Story unit ↔ Reading Route** (architecture closed) | ROL-002 defines **StoryProjectionLink** semantics; ROL-001 implements |
| **Editorial Scene ↔ Runtime** (architecture deferred to SPEC) | ROL-002 closes **Scene ↔ Reading Route container** projection semantics at SPEC layer |
| **Editorial Scene ↔ Reading Frame** | **Out of scope** — not a projection mapping in Rollout; deferred to **SPEC-RDX-001** if needed at Reading layer |

ROL-002 **does not** close Scene ↔ Reading Frame mapping. Architecture explicitly separates container projection (Rollout) from representation consumption (Runtime Reading).

---

## 8. Open Questions (Projection-only)

| ID | Question |
| -- | -------- |
| OQ-ROL2-P01 | May one Approved Scene unit project to **multiple** Reading Routes (N:M at container level)? |
| OQ-ROL2-P02 | May multiple Approved Scene units project to the **same** Reading Route? |
| OQ-ROL2-P03 | Required minimum fields on Approved Scene unit before Projection Accept is valid? |
| OQ-ROL2-P04 | Versioning when Approved Scene unit is edited after SceneProjectionLink exists |
| OQ-ROL2-P05 | Relationship between StoryProjectionLink and SceneProjectionLink when Story and Scene share one Route target |
| OQ-ROL2-P06 | Whether `SceneProjectionLink` and ROL-001 `StorySceneProjectionLink` converge to one metadata model or remain distinct |

**Explicitly deferred to SPEC-RDX-001:** frame grouping, progression, caption, navigation, Assistant, session, resume.

---

## 9. Acceptance Criteria (Design Phase)

- [x] **ROL2-DAC-01** — Scope limited to Projection; Reader semantics removed
- [x] **ROL2-DAC-02** — Projection lifecycle ends at Reading Route association boundary
- [x] **ROL2-DAC-03** — Abstract metadata contract defined (StoryProjectionLink, SceneProjectionLink)
- [x] **ROL2-DAC-04** — Projection integrity rules (ROL2-PR-*)
- [ ] **ROL2-DAC-05** — Architect review Approved (pending re-review)
- [ ] **ROL2-DAC-06** — ROL-001 alignment review (pending)

---

## 10. Refs

```text
docs/adr/007-rollout-architecture.md               Projection architecture; deferral table
docs/specs/spec-rol-001-governed-projection.md     Implemented operator projection
docs/specs/spec-rdx-001-runtime-reading-experience.md              Runtime Reading (Accepted)
docs/adr/005-narrative-information-model.md        Approved Scene unit semantics
docs/adr/006-discovery-copilot-architecture.md   Scene unit path
```

---

## 11. Precedence

```text
ADR-004, ADR-007 > SPEC-ROL-002 (topology & projection architecture)
ADR-005, ADR-006 > SPEC-ROL-002 (Editorial source semantics)
SPEC-ROL-001 > SPEC-ROL-002 (implemented operator behavior)
SPEC-ROL-002 ⊥ SPEC-RDX-001 (Projection vs Runtime Reading — adjacent, non-overlapping)
```
