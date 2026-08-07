# SPEC-RDX-001 — Runtime Reading Experience

## Metadata

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Title        | Runtime Reading Experience                                          |
| Status       | **Accepted** (v1.5 amendment — governance owner path confirmed)       |
| Version      | v1.5                                                                  |
| Base Accepted | v1.4 (2026-08-05)                                                   |
| Owner        | Architect                                                             |
| Last Updated | 2026-08-07                                                            |
| Derived From | ADR-004, ADR-005 v2.0, ADR-007 v1.2, ADR-009 v1.2, ADR-012, SPEC-SCC-001 v0.2 |
| Related      | SPEC-ROL-001, SPEC-ROL-002, SPEC-CORE-001, SPEC-SCC-001, Runtime Reading Governance RC1 |
| Amendment    | v1.1 — Architect Review minor revisions; v1.2 — capability boundary inlined, Accepted; v1.3 — rendering owner wording aligned with W-01 v2.1 (no semantic change); v1.4 — ADR-012 terminology correction; **v1.5 — Downstream Contract Alignment (Accepted):** Scene Context-aware Reading contractized with SPEC-SCC-001; ownership language (Route delivers / Context narrative / Frame visual); Reader Step preserved; no URL/addressing grant |

> **v1.5 Amendment — Accepted:** Aligns Reader contract with ADR-012 + SPEC-SCC-001. Does **not** authorize URL redesign, Route redesign, page identity change, Scene Context addressing, component design, or Scene Context production implementation (Spike Authorization is separate).

**Capability authority:** This SPEC is the **sole governance authority** for **Runtime Reading Experience**. **Reader Step** is the smallest architectural capability unit (§1.5). RDX MUST preserve **Editorial progression authority** without owning Editorial semantics. The accepted reading model is **Scene Context-aware Reading** (§1.5); the representation boundary model (Scene-aware Frame) is **not** the capability name.

**Authority boundary:** This SPEC is the **sole governance authority** for **Runtime Reading Experience** — the Layer 5 consumer capability that begins **after Projection Complete** and ends before implementation. It does **not** amend ADRs, redefine Editorial ontology, extend Rollout projection, alter Runtime topology, or specify database, API, UI, or component design.

---

## 1. Capability Definition

### 1.1 Purpose

Runtime Reading Experience (RDX) governs **how a Reader consumes already-projected Runtime content** at the capability layer.

RDX answers one governance question:

> **What does Runtime Reading Experience own — and exclusively own — once a Reading Route is available for consumption and before any implementation artifact is designed?**

RDX defines:

- The **Runtime Reading lifecycle** (semantic phases)
- The **Reader Step contract** (consumption behavior)
- **Capability and Representation responsibilities** (§3)
- **RDX-specific invariants** (governance constraints binding downstream specs)

### 1.2 Ownership

| Field | Value |
| ----- | ----- |
| **Capability name** | **Runtime Reading Experience** |
| **Namespace** | `RDX` |
| **Layer** | Layer 5 — Runtime consumer capability (ADR-009) |
| **Repository authority** | `docs/specs/spec-rdx-*` (raree-show-admin) |
| **Primary consumer** | raree-show-web (Reader, Assistant read path) |
| **Namespace rationale** | `RDX` distinct from `ROL` (Rollout); Layer 5 Runtime consumer bounded context |

RDX owns **consumption semantics** at Reader Step granularity within Reading Route scope. RDX does **not** own Editorial, Rollout, or Runtime Representation.

**Repository ownership:** normative RDX contracts live in `docs/specs/spec-rdx-*` (raree-show-admin); Reader implementation in raree-show-web; projection association production in Rollout (SPEC-ROL-001).

### 1.3 Capability boundary

**Starts at:**

```text
Projection Complete
        ↓
Reader opens Reading Route
        ↓
Runtime Reading Experience
```

**Projection Complete** means: a Reading Route is available for consumption and any upstream **StoryProjectionLink** / **SceneProjectionLink** associations from Rollout (SPEC-ROL-001, SPEC-ROL-002) may be present or absent — RDX does not create or mutate projection associations.

**Ends before:** database schema, API routes, UI components, persistence mechanisms, rendering policy, Assistant implementation, or Route authoring.

**Accepted boundary model** (§1.5): consumption is anchored on **Reader Step**; ordered Reader Steps within a Reading Route form the capability scope; Reader **MAY** consume narrative context scoped by **Scene Context** (**Scene Context-aware Reading**); RDX MUST preserve **Editorial progression authority** as a non-owned interpretive reference when upstream association provides it — without owning, redefining, or merging Editorial Scene identity.

**Rollout vs RDX disambiguation:**

| Question | Owner |
| -------- | ----- |
| How does Editorial Scene associate toward Scene Context and project to Reading Frame? | Rollout — SPEC-ROL-001, SPEC-ROL-002 (under ADR-012 / SPEC-SCC-001) |
| How does the Reader consume, advance, interpret, or complete reading? | RDX — this SPEC |

### 1.4 Authority sources

| Source | RDX relationship |
| ------ | ---------------- |
| **Constitution** | Reader Understanding First and Cognitive Cost First constrain capability scope — RDX preserves Editorial progression context without mandatory Editorial vocabulary at the consumption atom |
| **ADR-004** | Frozen Runtime topology; Human Acceptance Gate inherited for upstream projection only |
| **ADR-005 v2.0** | Editorial Story / Scene ontology; NIM-INV-06 progression authority at Editorial Scene — **preserved, not owned** |
| **ADR-007 v1.2** | Projection architecture; RDX MUST NOT extend Rollout |
| **ADR-009 v1.2** | Layer separation; Reader Step as Layer 5 progression unit |
| **ADR-012** | Scene Context Runtime Boundary — ownership authority for narrative moments |
| **SPEC-SCC-001** | Scene Context Contract — semantic ownership / consumer contract for Context-aware Reading |
| **SPEC-ROL-001** | Implemented operator projection — upstream input only |
| **SPEC-ROL-002** | Projection semantics — upstream input only |

### 1.5 Capability Boundary Decision

Architect accepted the following boundary decision (2026-07-11), with ADR-012 / SPEC-SCC-001 terminology alignment (v1.4–v1.5). It is **normative context** for this SPEC — not a separate governance artifact.

#### Evaluated candidates

| Candidate | Outcome | Rationale |
| --------- | ------- | --------- |
| **Frame-centric Reading** | Not selected | Correct atom (**Reader Step**), **insufficient scope** — excludes Editorial progression reference RDX must honor (NIM-INV-06) |
| **Editorial Scene-centric Reading** | **Rejected** | Editorial Scene as Runtime consumption unit / topology node violates layer separation (ADR-005 Decision 10; ADR-012). Rejected object is **Editorial Scene as Runtime consumption unit**, not Scene Context. |
| **Scene-centric Reading** (legacy shorthand) | **Rejected** — alias of **Editorial Scene-centric Reading** | MUST be read as Editorial Scene-centric. MUST NOT be reinterpreted as accepting Scene Context-aware Reading. |
| **Scene Context-aware Reading** | **Accepted** (ADR-012; SPEC-SCC-001) | Reader may consume narrative context scoped by Scene Context. Reading Frame remains visual representation. **Reader Step remains the consumption atom.** Scene Context ≠ URL/page routing identity. |
| **Scene-aware Frame** (boundary model) | **Selected model** (representation) | Reader Step atom; Editorial progression authority preserved without Editorial Scene as Runtime entity; aligns with Scene Context-aware Reading |

#### Ownership language (normative — ADR-012 / SPEC-SCC-001)

```text
Reading Route delivers Story.

Scene Context provides narrative context.

Reading Frame provides visual representation.
```

| Concern | Owner / role for RDX consumption |
| ------- | -------------------------------- |
| Delivery / session container | Reading Route delivers Story |
| Narrative moment / character appearance / location context | Scene Context provides (Runtime ownership boundary) |
| Visual representation / image asset | Reading Frame provides |
| Consumption atom | Reader Step (unchanged) |

RDX MUST NOT state or imply that Reading Route owns narrative-moment reader context (character appearance / location / beat).

#### Smallest architectural capability unit — **Reader Step**

| Alternative rejected | Reason |
| -------------------- | ------ |
| **Reading Frame alone** | Frame is Runtime **Representation** (RV-04); Reader Step is the **consumption act** (RV-06). Frame does **not** own narrative context (ADR-012). |
| **Editorial Scene** | Layer 3 progression authority (NIM-INV-06); not a Runtime entity (ADR-005 Decision 10). **Prohibited** as runtime consumption unit. |
| **Reading Route** | Story delivery runtime projection (ADR-012); RDX operates within Route delivery scope at Step granularity; Route does **not** own narrative-moment character/location context |
| **Scene Context as Reader Step substitute** | Scene Context is ownership boundary (ADR-012 / SPEC-SCC-001); **Reader Step remains the consumption atom**. ADR-012 does **not** authorize addressing/navigation change. |

#### Accepted boundary model (not the capability name)

```text
Reading model:       Scene Context-aware Reading (Accepted)
Capability unit:     Reader Step (Runtime) — remains consumption atom
Capability scope:    ordered Reader Steps within Reading Route delivery
Narrative context:   scoped by Scene Context when available via Runtime delivery projections
Boundary obligation: preserve Editorial progression authority as non-owned
                     interpretive reference when upstream association provides it —
                     MUST NOT own, redefine, or merge Editorial Scene identity
                     MUST NOT treat Scene Context as URL/page routing identity
```

---

## 2. Runtime Reading Lifecycle

Normative lifecycle phases. **No implementation** of session storage, navigation mechanics, rendering, or UI is defined here.

Every RDX-owned behavior MUST map to exactly one lifecycle phase (RDX-AC-11).

```text
┌─────────────────────────────────────────────────────────────────┐
│ UPSTREAM (not RDX-owned)                                        │
│ Projection Complete — Reading Route available; projection       │
│ associations may exist (SPEC-ROL-001 / SPEC-ROL-002)             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ RDX-1  Reading Session Start                                    │
│ Reader enters a Work-scoped Reading Route consumption context.  │
│ RDX scope begins.                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ RDX-2  Reader Step Consumption                                  │
│ Reader engages the current Reader Step within the Route.        │
│ Minimum atomic consumption act under RDX.                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ RDX-3  Progress Update                                          │
│ Runtime Reading Experience advances reader progression state    │
│ at Reader Step granularity within Route scope.                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │ more Steps in Route?        │
              └──────────────┬──────────────┘
                    yes │           │ no
                        ▼           ▼
              (return to RDX-2)   ┌─────────────────────────────┐
                                  │ RDX-4  Route Completion       │
                                  │ Final Reader Step in Route    │
                                  │ consumed; Route boundary      │
                                  │ reached.                      │
                                  └──────────────┬────────────────┘
                                                 │
                                                 ▼
                                  ┌─────────────────────────────┐
                                  │ RDX-5  Session Complete       │
                                  │ Reading Session ends or       │
                                  │ continues at next Route         │
                                  │ (cross-Route policy deferred).│
                                  └─────────────────────────────┘
```

### Phase responsibilities

| Phase | RDX responsibility | MUST NOT |
| ----- | ------------------ | -------- |
| **Projection Complete** | **Recognize** as entry precondition only | Create projection associations; mutate Rollout state |
| **Reading Session Start** | **Complete** session entry for one Work + Reading Route context | Redefine Route or Work identity |
| **Reader Step Consumption** | **Consume** the current Reader Step | Introduce consumption unit other than Reader Step |
| **Progress Update** | **Advance** reader progression state at Step granularity within Route | Assign progression authority to Frame or Route alone |
| **Route Completion** | **Complete** consumption at Route container boundary | Treat Route completion as Editorial Scene completion |
| **Session Complete** | **Complete** or hand off RDX scope | Own cross-session persistence design |

---

## 3. Capability and Representation Responsibilities

Responsibilities are split into **Capability** (semantic behavior) and **Representation** (persistence and production), following the Editorial / Runtime separation model in ADR-005.

No overlap. RDX verbs are limited to: **Consumes**, **Preserves**, **Advances**, **Interprets**, **Completes**, **Recognizes**.

### 3.1 Capability Responsibility

| Concern | Editorial | Rollout (Projection) | Runtime Reading Experience |
| ------- | --------- | -------------------- | -------------------------- |
| **Story definition** | **Owns** (ADR-005) | — | **Consumes** as optional interpretive reference |
| **Scene definition** | **Owns** (ADR-005) | — | **Consumes** as optional interpretive reference |
| **Editorial progression authority** | **Owns** (NIM-INV-06) | — | **Preserves** — MUST NOT own or redefine |
| **Discovery / Review Accept** | **Owns** (ADR-006) | — | — |
| **Story ↔ Route association** | Source unit | **Owns** accept + association semantics (ROL-001, ROL-002) | **Consumes** — read-only |
| **Editorial Scene ↔ Scene Context association** | Source unit | **Owns** association semantics (ROL under ADR-012 / SCC-001) | **Consumes** — read-only via Runtime delivery; not Editorial production objects |
| **Scene Context → Reading Frame projection** | — | **Owns** projection semantics (visual endpoint) | **Consumes** Frame representation; narrative context from Scene Context |
| **Projection lifecycle** | — | **Owns** through Projection Complete | **Recognizes** entry precondition only |
| **Reading Route (delivery)** | — | Story delivery projection | **Consumes** as delivery scope; **Completes** at Route boundary — does **not** own narrative-moment context |
| **Scene Context (narrative context)** | — | Runtime ownership boundary (SCC-001) | **Consumes** scoped narrative context when delivered — not as URL/page identity |
| **Reader Step consumption** | — | — | **Consumes** — owns atomic consumption behavior |
| **Editorial progression interpretation** | — | — | **Interprets** when association reference present |
| **Reader progression state** | — | — | **Advances** at Step granularity (RDX-3) |
| **Reading Session lifecycle** | — | — | **Completes** semantic phases (§2) |
| **Route authoring** | — | Projection Accept path | — |

### 3.2 Representation Responsibility

| Concern | Rollout (Projection) | Runtime Representation | Authority |
| ------- | -------------------- | ---------------------- | --------- |
| **Story ↔ Route association persistence** | Produces association on Accept | Persists association | SPEC-ROL-001, SPEC-CORE-001 |
| **Scene ↔ Route association persistence** | Produces association on Accept | Persists association | SPEC-ROL-001, SPEC-ROL-002, SPEC-CORE-001 |
| **Reading Route entity** | Create/link target on Projection Accept | Persists Route | ADR-004, SPEC-CORE-001 |
| **Reading Frame entity** | — | Persists ordered Frames within Route | ADR-004, SPEC-CORE-001 |
| **Frame Narrative / Route Synopsis** | — | Persists text on Route and Frame | SPEC-CORE-001 |
| **Route / Frame authoring CRUD** | Projection Accept path only | Production persist path | Admin Production |

Runtime Reading Experience **MUST NOT** own any row in §3.2. RDX **Consumes** Representation output; it does not define persistence shape.

### 3.3 Separation rules

- **RDX-SEP-01** — Editorial MUST NOT delegate Story, Scene, or progression authority definition to RDX.
- **RDX-SEP-02** — Rollout MUST NOT delegate projection accept, association creation, or Projection Complete semantics to RDX.
- **RDX-SEP-03** — RDX MUST NOT delegate Reader Step consumption behavior to Rollout or Editorial.
- **RDX-SEP-04** — Runtime Representation MUST NOT define Reading Session or Reader Step behavior; RDX MUST NOT define Representation persistence (§3.2).

---

## 4. Reader Step Contract

The Reader Step Contract defines **behavior** — what Runtime Reading Experience does at the consumption atom. Governance constraints on downstream specs appear in §5 only.

### 4.1 Normative definition (capability-first order)

**Reader Step** is defined in capability order — behavior before representation:

```text
Reader Step
     ↓
minimum Runtime consumption unit        ← RDX behavior boundary
     ↓
represented by Reading Frame            ← Runtime Representation (RV-04)
     ↓
persisted by Runtime Representation     ← ADR-004 / SPEC-CORE-001
```

Within RDX, Reader Step is:

1. The **minimum Runtime consumption unit** — the smallest governed act of Reading Experience.
2. The **Runtime behavior boundary** — all RDX-owned consumption semantics attach at Reader Step granularity or above (Route container scope); none attach below it.
3. The **navigation commit unit** — reader progression state advances at Reader Step resolution within a Reading Route.

Reader Step is **not identical** to Reading Frame. Reading Frame is the **representation** through which a Reader Step is consumed. Capability is never derived from persistence.

### 4.2 Construct distinction matrix

| Construct | Domain / Layer | Role relative to RDX | Identity merge with Reader Step? |
| --------- | -------------- | -------------------- | -------------------------------- |
| **Reader Step** | Layer 5 — RDX capability atom | **Owned by RDX** — minimum consumption unit | — (self) |
| **Reading Frame** | Layer 5 — Runtime Representation (RV-04) | **Represents** a Reader Step; ordered within Route | **Prohibited** — Frame is representation; Step is consumption act |
| **Reading Route** | Layer 5 — Runtime (RV-02) | Container and navigation boundary; scopes ordered Reader Steps | **Prohibited** — Route is container, not atomic consumption unit |
| **Editorial Scene** | Layer 3 — Editorial (ADR-005) | Non-owned progression authority reference; NIM-INV-06 | **Prohibited** — Editorial Scene MUST NOT become a Runtime consumption unit |
| **Scene Context** | Runtime ownership boundary (ADR-012 / SPEC-SCC-001) | Provides narrative context; projects to Reading Frame | **Not** a Reader Step substitute; **≠** URL/page identity; Context-aware Reading authorized |
| **Story** | Layer 3 — Editorial (ADR-005) | Non-owned grouping / mental-model reference | **Prohibited** — Story MUST NOT become a Runtime routable node |

### 4.3 Runtime topology (persistence / delivery order — unchanged by this amendment)

ADR-004 delivery topology is a **Representation / delivery** concern. It does not define Scene Context as a page identity:

```text
Work
 └── Reading Route          ← delivers Story (delivery projection)
      └── Reading Frame     ← visual representation
```

Ownership / narrative context (ADR-012 — **not** a URL topology change):

```text
Story
 └── Scene Context          ← narrative context ownership
      └── projects → Reading Frame
```

Editorial hierarchy (Layer 3 — **not** in Runtime topology):

```text
Story
 └── Editorial Scene        ← Editorial progression authority (NIM-INV-06)
```

**Cross-layer rule:** Editorial Scene and Story MAY inform RDX **Interpretation** when association exists. They MUST NOT appear as nodes in the Runtime delivery topology above. Web Reader consumes Scene Context through **Runtime delivery projections**, not by depending on Editorial production objects.

### 4.4 Reader Step behavior contracts

**RDX-RS-01 — Atomic consumption**

RDX **Consumes** Reading Experience one **Reader Step** at a time. Consumption advancement occurs at Step granularity only.

**RDX-RS-02 — Route-scoped ordering**

RDX **Consumes** Reader Steps within a Reading Route in Route-defined order. RDX MUST NOT reorder Steps outside Route scope.

**RDX-RS-03 — Container vs atom**

Route-level lifecycle phases (§2) **Complete** container boundaries. They MUST NOT substitute for Reader Step **Consumption**. Route phases are lifecycle containers, not consumption atoms.

**RDX-RS-04 — Representation correspondence**

Each Reader Step **Consumption** act corresponds to exactly one Reading Frame **representation** within the same Reading Route.

**RDX-RS-05 — Editorial progression interpretation**

When upstream association provides Editorial reference, RDX **Interprets** progression relative to Editorial authority and **Preserves** Editorial Scene boundaries — without collapsing Editorial Scene into a single Step or equating Step with Editorial Scene or Scene Context.

**RDX-RS-06 — Graceful absence**

When no Editorial association / Scene Context narrative context is available, RDX **Consumes** Reader Steps within the Route alone. Absence MUST NOT invalidate consumption.

**RDX-RS-07 — Scene Context-aware narrative context**

When Runtime delivery projections provide Scene Context–scoped narrative context, RDX **MAY** **Consume** that context for Scene Context-aware Reading. This does **not** make Scene Context a Reader Step, URL, or page routing identity.

---

## 5. Runtime Reading Invariants

RDX-specific **governance constraints**. These bind downstream specs and implementations. They do **not** restate ADR or Rollout invariants. Behavioral rules live in §4 only — no duplicated normative sentences.

**RDX-INV-01 — Downstream atom prohibition**

Downstream Runtime specifications authorized by RDX MUST NOT introduce a consumption unit other than **Reader Step**.

**RDX-INV-02 — No Editorial ownership**

RDX MUST NOT own, define, or mutate Editorial Story, Editorial Scene, Narrative Progression Step semantics, or ONE Rule adjudication. ADR-005 remains authoritative.

**RDX-INV-03 — No Projection ownership**

RDX MUST NOT create, accept, modify, or delete StoryProjectionLink, SceneProjectionLink, or any governed projection association. SPEC-ROL-001 and SPEC-ROL-002 remain authoritative through Projection Complete.

**RDX-INV-04 — Topology preservation**

RDX and downstream specs MUST NOT introduce Runtime entities, routable nodes, or URL segments other than `Work → Reading Route → Reading Frame` (ADR-004 binding). Scene Context-aware Reading does **not** authorize Scene Context as a URL/page routing identity (ADR-012; SPEC-SCC-001).

**RDX-INV-05 — Progression authority non-assignment**

Governance artifacts for RDX or downstream specs MUST NOT assign **Editorial progression authority** to Reading Frame, Reading Route, Reader Step, or Scene Context (NIM-INV-06). Scene Context owns Runtime narrative-moment context; it does **not** become Editorial progression authority.

**RDX-INV-06 — Identity separation**

RDX and downstream specs MUST NOT state or imply identity merge among:

```text
Editorial Scene ≠ Scene Context ≠ Reading Frame ≠ Story ≠ Reading Route ≠ Reader Step
```

**RDX-INV-06a — No Route narrative ownership recovery**

RDX and downstream specs MUST NOT assign character appearance, location context, or narrative-moment ownership to Reading Route.

**RDX-INV-07 — Post-projection entry**

RDX lifecycle MUST begin only after **Projection Complete**. RDX MUST NOT participate in Discovery Accept, Review Accept, or Projection Accept.

**RDX-INV-08 — Lifecycle phase closure**

Every Runtime Reading behavior introduced by downstream specs MUST map to exactly one lifecycle phase in §2. Specs MUST NOT define behavior outside the RDX lifecycle.

**RDX-INV-09 — Implementation deferral**

RDX MUST NOT embed database, API, UI, persistence, rendering, Assistant, or metadata schema decisions. Such decisions belong to downstream specs authorized after RDX acceptance.

**RDX-INV-10 — Upstream read-only**

Editorial units and projection associations are read-only inputs to RDX. RDX MUST NOT write back to Editorial or Rollout domains.

---

## 6. Dependency Model

```text
Constitution
     │
     ├── ADR-004 (Runtime topology)
     ├── ADR-005 v2.0 (Story / Scene ontology)
     ├── ADR-007 v1.2 (Projection architecture)
     └── ADR-009 v1.2 (Layer separation)
              │
              ▼
         ADR-005 ──► Editorial progression authority (NIM-INV-06)
              │
              ▼
         ADR-007 ──► Projection closure at Reading Route
              │
              ▼
    SPEC-ROL-001 (Implemented) ──► operator projection
              │
              ▼
    SPEC-ROL-002 (Accepted) ──► projection semantics
              │
              ▼
    ┌─────────────────────┐
    │  SPEC-RDX-001       │  ◄── this document (Accepted)
    │  (Runtime Reading   │
    │   Experience)       │
    └─────────┬───────────┘
              │
              ▼
    raree-show-web W-01
    (Visibility-Synchronized Navigation — redesign authorized)
              │
              ▼
    raree-show-web runtime-architecture.md (redesign authorized)
              │
              ▼
    Reader implementation SPECs and code
```

**One-way authority:** Downstream Runtime specifications MAY extend Runtime Reading Experience, but MUST NOT redefine **Reader Step**, **Lifecycle** (§2), **Capability ownership** (§3.1), or **Runtime Reading invariants** (§5). This rule is the SPEC-layer equivalent of ADR authority precedence.

### Precedence

```text
ADR-004, ADR-007, ADR-012  > SPEC-RDX-001   (topology; projection; Scene Context boundary)
ADR-005, ADR-009            > SPEC-RDX-001   (Editorial semantics; layer model)
SPEC-SCC-001                > SPEC-RDX-001   (Scene Context ownership contract — upstream for Context-aware Reading)
SPEC-ROL-001                > SPEC-RDX-001   (implemented Rollout operator behavior — upstream)
SPEC-ROL-002                > SPEC-RDX-001   (projection semantics — upstream)
SPEC-RDX-001                > W-01, web runtime specs, implementation
```

---

## 7. Out of Scope

Explicitly excluded from SPEC-RDX-001:

| Topic | Owner |
| ----- | ----- |
| Governed Projection, Projection Accept, link CRUD | SPEC-ROL-001, SPEC-ROL-002 |
| Discovery, Candidates, Human Review Accept | ADR-006, SPEC-D3-* |
| Editorial Story / Scene ontology, ONE Rule, Information Emergence | ADR-005 |
| Scene Context ownership contract (semantic) | SPEC-SCC-001 |
| **URL redesign / Route redesign / page identity change** | **Not authorized** by ADR-012 or this amendment |
| **Scene Context addressing** | **Not authorized** (ADR-012 Open Question; remains deferred) |
| Database schema, tables, columns, migrations | Implementation |
| Projection association persistence design | SPEC-ROL-002 / SPEC-CORE-001 |
| HTTP / API route design | Implementation |
| UI layout, component structure | UI Spec (post-RDX) |
| **Rendering policy** | Implementation / Presentation |
| **Visual composition** | Implementation / Presentation |
| **Animation** | Implementation / Presentation |
| **Media presentation** (image display, reveal gates, layout) | Implementation / Presentation |
| Assistant implementation, RAG oracle, chat UX | Web Assistant specs (Implementation) |
| Progress persistence mechanism, session storage | Implementation (post-RDX) |
| Browser navigation orchestration (commit order, URL) | W-01 (raree-show-web) |
| Frame Narrative text rendering policy, caption fallback rules | Implementation / Presentation (downstream web SPEC) |
| Reading Route authoring, Frame CRUD, Cloudinary upload | Admin Production / CORE-001 |
| Cross-Route session continuation policy | Downstream web SPEC |
| Vocabulary registry changes | ADR-008, ADR-009, runtime-lexicon |

Rendering and presentation are **Implementation / Presentation** responsibilities — not Runtime Reading capability. RDX governs consumption semantics only. W-01 (browser orchestration) MUST NOT absorb rendering into RDX ownership.

---

## 8. Downstream Authorization

The following downstream work is **authorized** by **SPEC-RDX-001 Accepted** (2026-07-11):

| Downstream artifact | Repository | Authorization condition |
| ------------------- | ---------- | ----------------------- |
| **W-01** redesign (Visibility-Synchronized Navigation) | raree-show-web | MUST conform to §4, §5, §6 one-way authority |
| **runtime-architecture.md** redesign | raree-show-web | MUST align §3.1 / §3.2 separation |
| **Reader implementation** (components, services, progress) | raree-show-web | Subject to W-01 and RDX contracts |
| **Assistant read-path** amendments | raree-show-web | MUST NOT violate RDX-INV-05, RDX-INV-06 |
| **Implementation SPECs** (persistence, API if any) | either repo | MUST NOT contradict RDX |

**Authorization condition:** Downstream specs MUST cite SPEC-RDX-001 as governance authority for Runtime Reading Experience. They MUST NOT redefine Reader Step, RDX lifecycle phases, capability ownership (§3.1), or RDX invariants (§5).

---

## 9. Acceptance Criteria (SPEC approval)

SPEC-RDX-001 is **Accepted** (2026-07-11; v1.4 terminology 2026-08-05; **v1.5 Accepted** 2026-08-07):

- [x] **RDX-AC-01** — Runtime Reading owns no Editorial semantics (RDX-INV-02)
- [x] **RDX-AC-02** — Runtime Reading owns no Projection semantics (RDX-INV-03)
- [x] **RDX-AC-03** — Reader Step is the only Runtime capability atom (RDX-RS-01, RDX-INV-01)
- [x] **RDX-AC-04** — Editorial Scene remains Layer 3 authority; RDX preserves, not owns (RDX-RS-05, RDX-INV-05)
- [x] **RDX-AC-05** — Runtime delivery topology unchanged (RDX-INV-04)
- [x] **RDX-AC-06** — No new Runtime URL/page entities; Scene Context ≠ page identity (RDX-INV-04)
- [x] **RDX-AC-07** — No implementation decisions in document body (RDX-INV-09)
- [x] **RDX-AC-08** — Capability / Representation ownership unambiguous (§3.1 / §3.2)
- [x] **RDX-AC-09** — Architect / governance owner Approved (incl. v1.5)
- [x] **RDX-AC-10** — Capability boundary decision incorporated (§1.5)
- [x] **RDX-AC-11** — Every Runtime Reading behavior maps to exactly one lifecycle phase (§2; RDX-INV-08)
- [x] **RDX-AC-12** — Scene Context-aware Reading Accepted; Editorial Scene-centric Reading Rejected (§1.5)
- [x] **RDX-AC-13** — Ownership language: Route delivers / Context narrative / Frame visual (§1.5)

### Review Gate (v1.5 — Accepted)

#### Architecture

- [x] RDX supports Scene Context-aware Reading
- [x] Editorial Scene-centric Reading remains Rejected
- [x] Reader Step remains consumption atom

#### Governance

- [x] No URL / Route / page identity redesign authorized
- [x] No Scene Context addressing authorized
- [x] No component / schema / API freeze

---

## 10. Refs

```text
docs/adr/004-source-of-canonical-truth.md                Runtime Truth v1 topology
docs/adr/005-narrative-information-model.md              Story / Scene; NIM-INV-06
docs/adr/007-rollout-architecture.md                     Projection architecture
docs/adr/009-vocabulary-architecture.md                  Layer 5; Reader Step
docs/adr/012-scene-context-runtime-boundary.md           Scene Context Runtime Boundary
docs/specs/spec-scc-001-scene-context-contract.md        Scene Context Contract (Accepted v0.2)
docs/specs/spec-rol-001-governed-projection.md           Rollout operator (Implemented)
docs/specs/spec-rol-002-projection-semantics.md           Projection semantics
docs/specs/runtime-reading-governance-rc1.md              Governance release baseline
docs/specs/spec-core-001-entity-schema-registry.md         Runtime Representation (§3.2)
governance/vocabulary/runtime-lexicon.md                   RV-02, RV-04, RV-06
raree-show-web/docs/specs/w-01-visibility-synchronized-navigation.md   Downstream (authorized)
raree-show-web/docs/runtime-architecture.md                            Downstream (authorized)
```

---

## 11. Summary

**Runtime Reading Experience** is the Layer 5 capability that governs Reader consumption **after Projection Complete**.

- **Reading model:** Scene Context-aware Reading (**Accepted**); Editorial Scene-centric Reading (**Rejected**)
- **Capability atom:** Reader Step (behavior first; represented by Reading Frame; persisted by Runtime Representation)
- **Capability scope:** ordered Reader Steps within Reading Route delivery
- **Ownership language:** Route delivers Story; Scene Context provides narrative context; Frame provides visual representation
- **Boundary obligation:** preserve Editorial progression authority without owning Editorial or Projection semantics; Scene Context ≠ URL/page identity
- **Lifecycle:** Reading Session Start → Reader Step Consumption → Progress Update → Route Completion → Session Complete
- **Downstream:** W-01, runtime architecture, and Reader implementation **authorized** (§8)
- **Status:** Accepted v1.5 (2026-08-07)

No Scene Context page identity. No addressing grant. No implementation or rendering decisions.
