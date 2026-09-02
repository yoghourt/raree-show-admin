# SPEC-ROL-002 — Editorial Scene Projection Semantics

## Amendment (v1.2) — Scene Context Projection Alignment

**Status:** **Accepted** (governance owner path confirmed)  
**Aligns with:** ADR-012 · SPEC-SCC-001 v0.2  
**Does not:** freeze schema, migration, cardinality, persistence implementation, or projection table design; does **not** authorize Scene Context production implementation (Spike-only until separate grant)

### Normative projection chain (ADR-012 / SPEC-SCC-001)

```text
Editorial Scene
        |
        | association
        ↓
Scene Context
        |
        | projection
        ↓
Reading Frame
```

| Rule | Normative |
| ---- | --------- |
| Reading Frame is projection target for **visual representation** | **MUST** |
| Reading Frame is Scene Context | **MUST NOT** |
| Association ≠ identity merge | **MUST** |
| Projection ≠ identity merge / narrative ownership transfer | **MUST** |
| Ambiguous `Scene → Frame` when Scene means Editorial Scene ownership transfer | **Forbidden** |
| Discovery candidate → Frame as Runtime truth without human gate | **Forbidden** |

### Authority path (semantic)

```text
Discovery candidate
        ↓
Human acceptance
        ↓
Runtime-authoritative Scene Context
        ↓
Projection (visual → Reading Frame)
```

Operational materialization of Scene Context remains a downstream SPEC. This amendment freezes **projection semantics only**.

---

## Hotfix amendment (2026-07-12) — Product Target Recovery (historical)

**Historical product endpoint:** Editorial staging materializes visual content onto **Reading Frame** within parent **Reading Route** delivery (not Editorial Scene → Route identity association via `approved_scene_units` as happy path).

| Construct | Hotfix operational role (historical) | v1.2 semantic clarification |
| --------- | -------------------------------------- | --------------------------- |
| Story staging | Source for Reading Route materialization | Story ↔ Route delivery association unchanged |
| Editorial Scene staging | Source toward Frame materialization | **Association** toward Scene Context; **not** identity merge into Frame |
| Reading Route | Parent delivery container for Frames | Story delivery runtime projection only |
| Reading Frame | Visual persist / presentation target | Visual representation only — **not** Scene Context |
| `approved_scene_units` / `scene_projection_links` | Soft-deprecated (not happy-path authority) | Unchanged as non-happy-path; not Reader authority |

**v1.2 rule:** Hotfix Frame materialization remains a **visual projection surface**. It does **not** authorize `Editorial Scene = Reading Frame` or skip Scene Context ownership (ADR-012). Forbidden shorthand: bare `Scene → Frame` when Scene means Editorial Scene.

Reader behavior remains SPEC-RDX-001. Sections below that define Approved Scene → Reading Route container association describe **pre-Hotfix / container-link** contract history; **ownership mapping** is closed by ADR-012 as association → Scene Context → projection → Reading Frame.

---

## Metadata

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Title        | Editorial Scene Projection Semantics                                  |
| Status       | **Accepted** (v1.2 amendment — governance owner path confirmed)       |
| Version      | v1.2                                                                  |
| Base Accepted | v1.1 (Hotfix 2026-07-12)                                           |
| Owner        | Architect                                                             |
| Last Updated | 2026-08-07                                                            |
| Derived From | ADR-007 v1.2; ADR-012; SPEC-SCC-001 v0.2                              |
| Related      | ADR-004, ADR-005 v2.0, ADR-006 v1.3, SPEC-ROL-001, SPEC-D3-002, SPEC-RDX-001, SPEC-SCC-001, Runtime Reading Governance RC1 |
| Supersedes   | SPEC-ROL-002 v0.1 (withdrawn — capability drift; see Architect Review 2026-07-11) |
| Amendment    | v1.1 — Hotfix Product Recovery; **v1.2 — Scene Context Projection Alignment (Accepted):** Editorial Scene association → Scene Context → Reading Frame projection; Frame ≠ Context; human gate preserved; no schema/cardinality freeze |

**Architect Review (2026-07-11):** v0.1 incorrectly owned **Runtime Reading Experience** semantics under the Rollout namespace. v0.2 restores **Projection-only** scope. Reader progression, navigation, caption rendering, session, and Assistant consumption belong to **SPEC-RDX-001** (Accepted — separate capability).

**Authority boundary:** This SPEC defines **Governed Projection semantics** for Editorial Scene association toward Runtime Scene Context and visual projection to Reading Frame — **identity, mapping, integrity, lifecycle, and acceptance** — stopping **before** any Reader interaction begins. It does **not** amend ADRs or Runtime topology, and does **not** freeze persistence representation.

---

## 1. Purpose

ADR-012 **closes** Editorial Scene ↔ Runtime ownership mapping as:

```text
Editorial Scene —association→ Scene Context —projection→ Reading Frame
```

ADR-007 retains Story ↔ Reading Route delivery association. SPEC-ROL-001 (Implemented) closes operator Projection Accept paths. SPEC-SCC-001 freezes Scene Context ownership semantics.

SPEC-ROL-002 closes the **semantic projection contract** that Rollout operationalizes:

> **What does it mean — at the Rollout / Projection layer — for an Approved Editorial Scene unit to be governably associated toward Runtime-authoritative Scene Context and projected to Reading Frame visual representation, without identity merge and without extending into Reader behavior?**

**Projection (visual) ends when:** a human-gated path yields Runtime-authoritative Scene Context with governed projection to **Reading Frame** (visual representation only), while Story delivery remains via **Reading Route**. **Everything after a Reader consumes Runtime objects is out of scope** (SPEC-RDX-001).

Historical container-link wording (Approved Scene ↔ Reading Route) remains descriptive of pre-ADR-012 / Hotfix operational paths; it MUST NOT be read as Narrative ownership on Route or as `Editorial Scene = Frame`.

---

## 2. Scope

### In Scope

- Projection responsibility matrix (**Projection layer only**)
- Editorial Scene **association** and Scene Context → Reading Frame **projection** semantics
- Story ↔ Reading Route delivery association semantics (orthogonal)
- Projection metadata contract (abstract shapes — not storage)
- Projection integrity and acceptance semantics
- Runtime **metadata produced by Projection** (association / projection relations, provenance pointers)
- Projection invariants (ROL2-PR-*)
- Open Questions **limited to projection semantics** (not cardinality freeze in this amendment)

### Out of Scope

| Topic | Owner |
| ----- | ----- |
| Reader progression, navigation, resume | **SPEC-RDX-001** |
| Scene Context-aware Reading consumption | **SPEC-RDX-001** (+ SPEC-SCC-001) |
| Scene Context ownership contract | **SPEC-SCC-001** |
| Frame Narrative / `caption` rendering semantics | **SPEC-RDX-001** + RV-05 |
| Assistant context, spoiler gates, session commit | **SPEC-RDX-001** + web specs |
| Rollout operator UX, API routes, persistence implementation | SPEC-ROL-001 / Implementation |
| Discovery, Review Accept workflows | SPEC-D3-002 |
| Database schema, migrations, projection table design | Implementation (post-SPEC) |
| Association / projection cardinality freeze | Deferred (SPEC-SCC-001 Open Questions) |
| Scene Context materialization algorithm | Downstream SPEC |
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
| Editorial Scene ≠ Scene Context ≠ Reading Route ≠ Reading Frame | ADR-005 Decision 10; ADR-012; SPEC-SCC-001 |
| Editorial Scene ↔ Runtime ownership mapping closed as association → Scene Context → Frame | ADR-012; ADR-007 A3 |
| No new Runtime routable entity; Scene Context ≠ URL/page identity | ADR-007 Decision 3; ADR-012; ROL-INV-01 |
| Discovery Accept ≠ Projection Accept | SPEC-ROL-001 ROL-RC-02 |
| Human Acceptance Gate on every projection decision | ADR-004 Decision 2; ROL-INV-03 |
| Discovery candidate ≠ Runtime-authoritative Scene Context | SPEC-SCC-001 |
| Scene MUST NOT define Story boundaries | NIM-INV-07 |

**Note:** NIM-INV-06 (progression authority at Editorial Scene) governs **Editorial** semantics. It informs **why** association exists but does **not** authorize this SPEC to define Reader progression — that is **SPEC-RDX-001**. Editorial Scene does **not** become Runtime Scene.

---

## 4. Projection Responsibility Matrix

| Construct | Projection role | In scope for ROL-002? | Owner after projection completes |
| --------- | --------------- | --------------------- | -------------------------------- |
| **Approved Story unit** | Editorial source for optional Story ↔ Route **delivery association** | Partial (link semantics only) | Editorial + link metadata (ROL-001) |
| **Approved Scene unit** (Editorial Scene) | Editorial **association source** toward Scene Context | **Yes** (association semantics) | Editorial record + association metadata |
| **Scene Context** | Runtime ownership boundary; narrative context; **projects** to Frame | **Yes** (semantic — not persistence design) | Runtime Domain (ADR-012 / SPEC-SCC-001) |
| **Story Projection** | N:M **association metadata**: Approved Story unit ↔ Reading Route identity | **Yes** | Rollout metadata (ROL-001) |
| **Scene / Context Projection** | **Association** Editorial Scene → Scene Context; **projection** Scene Context → Reading Frame | **Yes** (semantic chain) | Rollout metadata + Runtime Context/Frame relations |
| **Reading Route** | Story **delivery** projection (container) | **Yes** (delivery target only) | Runtime Domain (ADR-004) — **not** narrative ownership |
| **Reading Frame** | **Visual projection target** / representation inside Route delivery | **Yes** (as visual endpoint only) | Visual representation — **≠ Scene Context** |
| **Frame Narrative (`caption`)** | — | **No** | **SPEC-RDX-001** |

### Normative identities (Projection layer)

```text
Story Projection     = governed association: Approved Story unit ↔ Reading Route ID (N:M; delivery)
Editorial association = governed relation: Editorial Scene → Scene Context (≠ identity merge)
Context projection    = governed relation: Scene Context → Reading Frame (visual; ≠ ownership transfer)
Reading Route         = Story delivery runtime projection
Reading Frame         = visual representation only
```

**Prohibited:**

- `Editorial Scene = Scene Context` (identity merge)
- `Scene Context = Reading Frame` (identity merge)
- `Approved Scene unit = Reading Route` (identity merge)
- `Approved Scene unit = Reading Frame` (identity merge)
- Ambiguous `Scene → Frame` meaning Editorial Scene ownership transfer into Frame
- Silent projection (without Human Acceptance)
- Discovery candidate → Frame as Runtime truth
- Discovery Review Accept substituting for Projection Accept / Runtime-authoritative Scene Context

---

## 5. Projection Lifecycle

Projection lifecycle (v1.2 semantic) **ends** when governed association / visual projection relations required for Runtime delivery are human-accepted. Reader consumption is **not** Rollout Projection (SPEC-RDX-001).

```text
┌──────────────────────────────────────────────────────────────┐
│ EDITORIAL DOMAIN                                              │
├──────────────────────────────────────────────────────────────┤
│ P1  Narrative → Story / Editorial Scene Candidates            │
│ P2  Human Review → Approved Story / Approved Editorial Scene  │
│     Owner: ADR-005, ADR-006, SPEC-D3-002                      │
│     Note: candidate ≠ Runtime-authoritative Scene Context     │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ PROJECTION DOMAIN (this SPEC + SPEC-ROL-001)                  │
├──────────────────────────────────────────────────────────────┤
│ P3  Staging handoff                                           │
│ P4  Story Projection Accept (optional)                        │
│     Output: Story ↔ Reading Route delivery association        │
│ P5  Context association / visual projection Accept            │
│     Semantic output:                                          │
│       Editorial Scene —association→ Scene Context             │
│       Scene Context —projection→ Reading Frame                │
│     Delivery remains via Reading Route                        │
│     Owner: ROL-001 implements; ROL-002 defines semantics      │
│     Persistence shapes: NOT frozen here                       │
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
│ P6+ Reader serve, progression, Assistant                      │
│     Owner: SPEC-RDX-001, raree-show-web                       │
│     Consumes Scene Context via Runtime delivery projections   │
└──────────────────────────────────────────────────────────────┘
```

### Phase table

| Phase | Trigger | Projection output (semantic) | Human Accept |
| ----- | ------- | ---------------------------- | ------------ |
| P3 | Rollout import of staging | Eligible Editorial Scene unit for association | Prior Review Accept |
| P4 | Link Accept | Story ↔ Reading Route delivery association metadata | Yes |
| P5 | Projection Accept | Editorial Scene → Scene Context association; Scene Context → Frame projection (visual); Route remains delivery | Yes |

Historical field names such as `SceneProjectionLink` / Route ID references describe **Implemented** ROL-001 transport history. v1.2 does **not** re-authorize those shapes as Scene Context ownership; operational rematerialization is downstream.

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

Every Story ↔ Route delivery association and every Editorial Scene → Scene Context association / Context → Frame projection decision MUST be created only through an explicit operator action satisfying ADR-004 Decision 2. Discovery Accept MUST NOT create projection links or establish Runtime-authoritative Scene Context.

**ROL2-PR-02 — Work scope integrity**

Projection links MUST be scoped to a single `workId`. Cross-work Route references MUST be rejected.

**ROL2-PR-03 — Editorial source integrity**

`approvedSceneUnitId` MUST reference a valid Approved Scene unit within an Approved Story unit (ADR-005 parent-child). Scene projection MUST NOT substitute for Story boundary adjudication (NIM-INV-07).

**ROL2-PR-04 — Target integrity**

Reading Route references MUST stay within the same Work when used as delivery targets. Visual projection targets Reading Frame representation — **not** as Scene Context identity. Projection Accept MUST NOT treat Frame as narrative ownership boundary.

**ROL2-PR-05 — Idempotence class**

Duplicate association pairs for the same Editorial source and delivery/context target MUST be rejected at the association-metadata layer (not by inventing duplicate Routes). Exact key shapes are Implementation — not frozen here.

**ROL2-PR-06 — Unlink semantics (projection layer)**

Removing a projection / association relation MUST NOT silently delete the Reading Route, Reading Frame, Approved Editorial Scene unit, or Scene Context unless a separate explicit operator delete is performed (ROL-INV-02 spirit).

**ROL2-PR-07 — Topology preservation**

Projection MUST NOT introduce routable Runtime nodes or alter `Work → Reading Route → Reading Frame` delivery topology (ROL-INV-01). Scene Context is **not** a new URL/page entity.

**ROL2-PR-08 — ROL-001 precedence**

Where operational behavior is defined, SPEC-ROL-001 **Implemented** prevails for current operator paths. ROL-002 governs **semantic meaning**. Semantic conflict with ADR-012 / SPEC-SCC-001 MUST be resolved toward those authorities; operational rematerialization remains downstream.

**ROL2-PR-09 — Frame is not Scene Context**

Reading Frame remains visual representation only. Projection to Frame MUST NOT transfer narrative-moment ownership (character appearance, location context, beat) into Frame.

**ROL2-PR-10 — No Discovery-to-Frame Runtime shortcut**

```text
Discovery scene candidate
        ↓
Frame
```

as Runtime truth is **forbidden**. Required semantic path:

```text
Discovery candidate → Human acceptance → Runtime-authoritative Scene Context → Projection
```

---

## 7. Relationship to ADR-007 / ADR-012 Closure Model

| Closure | ROL-002 role |
| ------- | ------------ |
| **Approved Story unit ↔ Reading Route** (ADR-007 closed) | Delivery association semantics; ROL-001 implements |
| **Editorial Scene ↔ Runtime** (ADR-012 closed) | Association → **Scene Context**; Projection → **Reading Frame** |
| **Reading Frame** | Visual projection target only — **≠ Scene Context** |
| **Reading Route** | Story delivery projection only — **≠ narrative ownership** |

ROL-002 **does** close the **semantic** Editorial Scene → Scene Context → Reading Frame chain under ADR-012. It does **not** freeze persistence, cardinality, or materialization algorithms. Runtime Reading consumption remains **SPEC-RDX-001**.

---

## 8. Closed Questions (v1 — Sprint #1 / ACA-004)

| ID | Decision (v1) |
| -- | ------------- |
| OQ-ROL2-P01 | **Closed:** One Approved Scene unit → **at most one** Reading Route until Unproject. Second Projection Accept rejected (`ALREADY_PROJECTED`). |
| OQ-ROL2-P02 | **Closed:** Multiple Approved Scene units **may** `link_existing` to the same Reading Route. |
| OQ-ROL2-P03 | **Closed:** Minimum fields = staging-mapper (`title` non-empty, `chapter_number` ≥ 0; 0 = prologue) **plus** required `parentStorySourceReviewId` and matching **persisted active** `story_units` row. |
| OQ-ROL2-P04 | **Closed (deferred versioning):** No version column; Unproject + re-project is the edit path for projection metadata. |
| OQ-ROL2-P05 | **Closed:** `StoryProjectionLink` and `SceneProjectionLink` remain distinct. Projection Accept auto-creates Story↔Route link to parent Story when missing; Unproject removes companion Story link only when recorded as projection-owned. |
| OQ-ROL2-P06 | **Closed:** Remain distinct tables/models; do not collapse. |

**Explicitly deferred to SPEC-RDX-001:** frame grouping, progression, caption, navigation, Assistant, session, resume.

---

## 9. Acceptance Criteria

SPEC-ROL-002 is **Accepted** (2026-07-11; Hotfix v1.1; **v1.2 Accepted** 2026-08-07):

- [x] **ROL2-DAC-01** — Scope limited to Projection; Reader semantics removed
- [x] **ROL2-DAC-02** — Projection lifecycle ends at governed association / visual projection boundary (not Reader)
- [x] **ROL2-DAC-03** — Abstract association / projection relations defined (shapes not storage-frozen)
- [x] **ROL2-DAC-04** — Projection integrity rules (ROL2-PR-*)
- [x] **ROL2-DAC-05** — Architect / governance owner Approved (incl. v1.2)
- [x] **ROL2-DAC-06** — ROL-001 alignment confirmed for Implemented paths; semantic conflict resolves to ADR-012
- [x] **ROL2-DAC-07** — Chain is Editorial Scene → Scene Context → Reading Frame
- [x] **ROL2-DAC-08** — Frame ≠ Scene Context; Route ≠ narrative ownership
- [x] **ROL2-DAC-09** — No schema / cardinality / materialization freeze in this amendment

### Review Gate (v1.2 — Accepted)

#### Projection

- [x] ROL chain passes through Scene Context
- [x] Frame remains visual representation only
- [x] Human acceptance preserved; Discovery → Frame shortcut forbidden

#### Governance

- [x] Semantic contract only
- [x] No projection table / schema / migration / cardinality freeze

---

## 10. Refs

```text
docs/adr/007-rollout-architecture.md               Projection architecture
docs/adr/012-scene-context-runtime-boundary.md     Scene Context Runtime Boundary
docs/specs/spec-scc-001-scene-context-contract.md  Scene Context Contract (Accepted v0.2)
docs/specs/spec-rol-001-governed-projection.md     Implemented operator projection
docs/specs/spec-rdx-001-runtime-reading-experience.md   Runtime Reading
docs/specs/runtime-reading-governance-rc1.md       Governance RC1 baseline
docs/adr/005-narrative-information-model.md        Approved Scene unit semantics
docs/adr/006-discovery-copilot-architecture.md     Scene unit path
```

---

## 11. Precedence

```text
ADR-004, ADR-007, ADR-012 > SPEC-ROL-002 (topology & projection architecture; Scene Context boundary)
ADR-005, ADR-006           > SPEC-ROL-002 (Editorial source semantics)
SPEC-SCC-001               > SPEC-ROL-002 (Scene Context ownership contract)
SPEC-ROL-001               > SPEC-ROL-002 (implemented operator behavior — operational)
SPEC-ROL-002 ⊥ SPEC-RDX-001 (Projection vs Runtime Reading — adjacent, non-overlapping)
```