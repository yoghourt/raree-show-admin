# ADR-007 — Editorial → Runtime Rollout Architecture

**Status:** Accepted
**Type:** Rollout ADR
**Version:** 1.2
**Last Updated:** 2026-07-11
**Amendment:** A1 (Runtime Vocabulary Alignment — vocabulary only; Decision semantics and topology unchanged; Scene → Reading Route; Story Image → Reading Frame; normative vocabulary in `governance/vocabulary/runtime-lexicon.md`), A2 (Editorial Scene alignment with ADR-005 v2.0 — Story↔Reading Route projection unchanged; Editorial Scene ↔ Runtime mapping explicitly deferred; terminology and cross-references; **no** Decision semantics, Runtime topology, or projection architecture redesign). Prior amendment A1 preserved in substance.
**Owner:** Architect
**Related ADR:** ADR-004 (Source of Canonical Truth — Human Acceptance Gate and Runtime Truth v1); ADR-005 v2.0 (Narrative Information Model — Editorial Domain, Story and Scene ontology, Information Emergence); ADR-006 v1.3 (Discovery Copilot Architecture — Authority Emergence and Discovery boundary); ADR-D2-001 (Canonical Metadata Authority)

---

## What

This ADR establishes the **Editorial → Runtime Rollout Architecture** for Raree
 Show Runtime Truth v1.

It defines:

* **Rollout governance** — how accepted Editorial and Production capabilities
  integrate with the Runtime Domain without redesigning Runtime Truth v1.
* The **Story ↔ Reading Route architectural relationship** — orthogonal constructs
  linked by governed projection, not identity merge.
* The **Editorial narrative hierarchy** (Story → Scene per ADR-005 v2.0) and its
  relationship to Runtime Domain representation — domain-separated; **Editorial
  Scene ↔ Runtime mapping is not defined or authorized by this ADR** (deferred).
* The **Dual-Domain Coexistence Model** — how Editorial and Runtime domains operate
  during rollout.
* **Authority precedence and reconciliation** — how governance resolves divergence
  between Editorial semantics and Runtime enforcement.
* **Story runtime representation (architecture intent)** — projection-only; Story is
  not a Runtime routable entity in Runtime Truth v1.
* **Rollout phases (architectural intent only)** — coexistence and projection
  lifecycle at the governance layer.
* **Rollout Architectural Invariants (ROL-INV-*)** binding the rollout boundary.
* **Architecture Closure** — completion of the Runtime Truth v1 Architecture layer
  and authorization for downstream SPEC design.

The central architectural diagram of this ADR is the **Rollout Model**:

```text
Editorial Domain          Production Domain         Runtime Domain
─────────────────         ─────────────────         ──────────────

Approved Story unit  ──►  (no Entity promotion) ──►  governed projection ──► Reading Route
Approved Scene unit  ──►  (Editorial Domain only; Scene↔Runtime deferred)
Approved Entity      ──►  Enrichment → Persist  ──►  Reading Route (existing path)
                                                              │         [impl: Scene]
                                                              ▼
                                                         Reading Frame
                                                         [impl: Story Images]
                                                         (Runtime Truth v1)
```

This ADR explicitly does **not** govern:

* Canonical Truth ownership or Human Acceptance semantics (ADR-004)
* Story and Scene definition, Information Emergence, or ONE Rule (ADR-005)
* Discovery, Candidate lifecycle, or Authority Emergence (ADR-006)
* Runtime Truth v1 topology redesign
* Database schemas, API contracts, migration SQL, or UI
* Synchronization algorithms, deployment procedures, or persistence implementation
* Knowledge Graph, Relationship Graph, or Story Arc Runtime architecture (post-v1
  capabilities per Constitution capability roadmap)

---

## Why

After ADR-006, the remaining architectural gap is **not** another domain model,
authority model, or editorial capability. Those responsibilities are assigned:

* ADR-004 — Canonical Truth, Human Acceptance, Enrichment, Runtime Truth v1.
* ADR-005 — Editorial Domain, Story and Scene semantics, Information Emergence.
* ADR-006 — Discovery, Candidate semantics, Authority Emergence, Production Domain.

What remains unresolved is the **governed relationship** between the accepted
 Editorial Domain and the accepted Runtime Domain.

Four structural problems motivate this Rollout ADR:

**Problem 1 — Cross-domain mapping has no governance owner.**

ADR-004, ADR-005, and ADR-006 each defer Editorial Domain **Approved Story unit
 ↔ Runtime Domain Reading Route** governed projection to this Rollout ADR. Without
 ADR-007, operators and implementers cannot determine how approved Editorial Story
 artifacts relate to Reading Route records (implementation: Scene records) without
 conflating domains.

**Problem 2 — Story and Reading Route are conflated without a governed relationship.**

ADR-005 v2.0 rejects **Scene equated to Story** (Alternative B — editorial Story-only
 topology). ADR-005 defines **Editorial Scene** as the progression unit **within**
 Story. ADR-004 defines **Reading Route** (implementation alias: Scene) as the
 Runtime routable unit. Neither ADR-004 nor ADR-005 defines how an **Approved
 Story unit** (ADR-006 Story path) associates with Reading Route record(s). Without
 an explicit orthogonal + associative model, implementers may silently equate Story
 with Reading Route or treat editorial approval as automatic Runtime persistence.

**Editorial Scene** MUST NOT be conflated with **Reading Route** or **Reading Frame**.
 Editorial Scene ↔ Runtime governed mapping is **deferred** (ADR-005 Deferred Decisions;
 this ADR §Deferred Decisions) and is **not** closed by the Story ↔ Reading Route
 projection model below.

**Problem 3 — Dual-domain divergence lacks reconciliation rules.**

ADR-005 NIM-INV-04 states Editorial Domain truth precedes Runtime representation.
 FOUNDATION Runtime Supremacy states production-enforced Runtime behavior prevails
 when governance artifacts conflict. During rollout, Editorial and Runtime
 representations may temporarily differ. Without Rollout-level reconciliation
 rules, authority confusion blocks safe integration.

**Problem 4 — The Story path stops at the Editorial boundary.**

ADR-006 distinguishes Catalog Entity path (Character, Location → Production Entity
 → Runtime) from Story unit path (Approved Story unit remains Editorial) and Scene
 unit path (Approved Scene unit remains Editorial). Scene Candidate Generation
 outcomes are **Editorial Scene** artifacts — **Approved Scene units** — not
 Reading Route or Reading Frame records. Rollout governance is required before
 **Approved Story units** may enter Runtime influence through **governed projection**
 to Reading Route without violating Human Acceptance (ADR-004 Decision 2) or Story
 semantics (ADR-005).

This ADR resolves these problems at the **Rollout governance layer** without
 altering Runtime Truth v1 topology or redesigning Discovery or Enrichment.

---

## Foundational Principle

> **Editorial truth and Runtime execution coexist; they are linked by governed
> projection, not merged by default.**

Corollaries:

* **Story and Scene semantics** remain authoritative in the Editorial Domain
  (ADR-005 v2.0).
* **Runtime Truth v1 topology** remains authoritative in the Runtime Domain
  (ADR-004).
* **No silent mapping** — Editorial→Runtime association requires explicit,
  human-accepted governed projection (ADR-004 Decision 2).
* **Approved Story units** and **Approved Scene units** are not auto-promoted to
  Production Entities (ADR-006 Human Review outcome paths).
* **Governed projection at architecture layer** applies to **Approved Story unit ↔
  Reading Route** only. **Editorial Scene ↔ Runtime** association is **not**
  authorized here (deferred to downstream SPEC).
* **Catalog Entity path** (Character, Location → Enrichment → Persist → Runtime)
  remains unchanged.

---

## Rollout Model

Rollout governs **domain transition intent**, not implementation migration.

```text
                    ROLLOUT BOUNDARY (this ADR)
                    ═══════════════════════════

Editorial Domain          Production Domain         Runtime Domain
─────────────────         ─────────────────         ──────────────

Narrative / Story         Catalog Entity path       Work
Discovery / Candidates          │                    └─ Reading Route
Human Review                  Enrichment                 └─ Reading Frame
Approved Story unit      Persist (existing)            Reader
Approved Scene unit      (Editorial only)              [impl: Scene / Story Images]
        │                       │
        └──── governed projection (human-accepted) ──► Reading Route association
              [Approved Story unit only]               (implementation: Scene)
```

**Catalog Entity path** — unchanged from ADR-004 and ADR-006. Approved Entities
 enter Runtime through existing Production persist paths.

**Story unit path** — Approved Story units remain Editorial Domain artifacts.
 Entry into Runtime influence is **only** through **governed projection** to existing
 Reading Route records (implementation: Scene). Story does **not** become a new
 routable Runtime node.

**Scene unit path** — Approved Scene units remain Editorial Domain artifacts within
 their parent Approved Story unit (ADR-005). **No Scene → Reading Route or Scene →
 Reading Frame governed mapping is defined or authorized by this ADR.** Cross-domain
 association for Editorial Scene is **deferred** (see §Deferred Decisions).

---

## Domain Transition Model

This section answers the architectural questions deferred by ADR-004, ADR-005,
 and ADR-006 for **Approved Story unit ↔ Reading Route** governed projection.
 **Editorial Scene ↔ Runtime** mapping is explicitly **not** answered here (deferred).
 Governance intent only. Implementation belongs to downstream SPECs.

| Question | Rollout decision |
| -------- | ---------------- |
| Story ↔ Reading Route relationship | **Orthogonal and associative** — related but not equivalent; **N:M** permitted (one Reading Route may relate to multiple Stories; one Story may relate to multiple Reading Routes); **identity merge prohibited** |
| Story runtime representation | **Projection-only** — Story is **not** a routable Runtime entity in Runtime Truth v1; association is governed projection onto **Reading Route** (implementation: Scene) |
| Editorial Scene ↔ Runtime Reading Route / Reading Frame | **Deferred** — Editorial Scene (ADR-005) is distinct from Reading Route and Reading Frame; **no** Scene → Runtime governed mapping is defined or authorized by this ADR; expected governance home: downstream SPEC (ADR-005 Deferred Decisions) |
| Scene Candidate (Discovery) vs Runtime Reading Route | Scene Candidate Generation produces **Editorial Scene** Candidates; Human Review yields **Approved Scene units** — Editorial Domain artifacts **within** Story. They are **not** Reading Route records (implementation: Scene records) or Reading Frame records |
| Dual-domain coexistence | **Coexistence without conflation** — Editorial may lead Runtime representation; domains remain distinct |
| Authority when domains diverge | **Split precedence** (Decision 6) |
| Rollout vs SPEC boundary | ADR defines principles, phases, invariants; SPEC defines schema, API, validation, sync |

---

## Glossary

Terms **Story**, **Scene**, **Approved Story unit**, **Approved Scene unit**,
 **Narrative Progression Step**, **Editorial Domain**, **Runtime Domain**, **Entity**,
 and **Human Acceptance Gate** are defined in ADR-005 Glossary and Canonical
 Definitions (and ADR-004 / ADR-006 where applicable). This ADR references those
 definitions and MUST NOT redefine them with conflicting semantics.

**Editorial Scene** (ADR-005) MUST NOT be conflated with **Reading Route**
 (implementation alias: Scene) or **Reading Frame**.

**Reading Route** (normative; implementation alias: Scene) — The routable reading
 container in Runtime Truth v1. See `governance/vocabulary/runtime-lexicon.md` RV-02.

**Reading Frame** (normative; implementation alias: Story Image) — One ordered
 narrative-visual unit inside a Reading Route. See `governance/vocabulary/runtime-lexicon.md` RV-04.

**Governed Projection**

A **human-accepted** architectural association between an Editorial Domain
 artifact and Runtime Domain representation without identity merge or silent
 conflation.

At the architecture layer, governed projection **closes** for **Approved Story
 unit ↔ Reading Route** (implementation: Scene record(s)). **Editorial Scene ↔
 Runtime** association is **not** defined or authorized by this ADR (deferred).

**Orthogonal Coexistence**

The operational state in which Editorial Domain and Runtime Domain artifacts
 coexist as distinct constructs. Editorial approval does not automatically create
 or modify Runtime records.

**Runtime Projection**

The architectural association of Editorial **Story** content to Reading Route(s)
 (implementation: Scene(s)) under Rollout governance. Projection is **not** a
 new Runtime entity type and does not alter the
 `Work → Reading Route → Reading Frame` topology.

**Editorial Scene** progression semantics (ADR-005 NIM-INV-06) MUST NOT be
 redefined as Reading Frame identity. Scene-level Runtime representation — if
 any — is **deferred** to downstream SPEC; this ADR does not authorize it.

**Rollout Phase**

An architectural lifecycle stage describing domain coexistence and projection
 readiness. Rollout phases are **not** deployment procedures or migration scripts.

---

## Decision

### Decision 1 — Rollout Is Domain Transition Governance

**Rollout governs how accepted domains coexist and integrate.**

Rollout extends the architecture by defining cross-domain transition principles.
 It does **not** redefine Canonical Truth, Story semantics, Discovery, Enrichment,
 or Runtime Truth v1 topology.

---

### Decision 2 — Story and Reading Route Are Orthogonal

**Story and Reading Route are orthogonal constructs in different domains.**

| Construct | Domain | Role |
| --------- | ------ | ---- |
| **Story** | Editorial Domain | Cognitive narrative unit (ADR-005 Canonical Definition — Story) |
| **Scene** | Editorial Domain | Progression unit within Story (ADR-005 Canonical Definition — Scene) |
| **Reading Route** (implementation: Scene) | Runtime Domain | Routable reading container (ADR-004 Runtime Truth v1) |
| **Reading Frame** | Runtime Domain | Ordered narrative-visual unit within Reading Route (ADR-004) |

Story and Reading Route MAY be **associated** through governed projection. **Editorial
 Scene** and **Reading Route** / **Reading Frame** MUST NOT be treated as equivalent
 or merged by identity. Editorial Scene ↔ Runtime association is **deferred** (see
 §Deferred Decisions).

Story and Reading Route MUST NOT be treated as equivalent, interchangeable, or
 merged by identity.

One Reading Route MAY relate to multiple Stories. One Story MAY relate to
 multiple Reading Routes. Forced 1:1 equivalence is prohibited.

---

### Decision 3 — Story Is Not a Runtime Routable Entity in Runtime Truth v1

**Story does not become a first-class routable Runtime entity in Runtime Truth v1.**

Runtime Truth v1 topology remains:

```text
Work
 └─ Reading Route          (implementation: Scene)
      └─ Reading Frame      (implementation: Story Images / story_images_v2[])
```

Editorial Story units enter Runtime influence **only** through **governed
 projection** onto existing Reading Route records (implementation: Scene). No
 new routable layer is introduced between Work and Reading Route.

---

### Decision 4 — Editorial↔Runtime Association Requires Governed Projection

**No Editorial artifact silently becomes Runtime truth.**

Any association between an Editorial Domain artifact and Runtime Domain
 representation MUST:

* be **explicit** — not inferred from persist, Discovery, or Enrichment alone;
* be **human-accepted** — ADR-004 Decision 2 applies to projection decisions;
* preserve **domain separation** — projection links artifacts; it does not merge
  Story into Reading Route identity (implementation: Scene identity).

At the architecture layer, the **closed** governed projection is **Approved Story
 unit ↔ Reading Route**. **Editorial Scene ↔ Runtime** mapping is **not**
 authorized by this ADR (deferred).

Implicit mapping on entity persist, batch sync, or AI suggestion is prohibited.

---

### Decision 5 — Dual-Domain Coexistence Preserves Runtime Truth v1

**Rollout MUST NOT redesign Runtime Truth v1.**

During rollout:

* Runtime Domain routing, persistence topology, and production enforcement remain
  governed by ADR-004.
* Editorial capabilities MAY evolve in the Editorial Domain without forcing Runtime
  schema or routing redesign.
* Governed projection MAY be enabled in Phase 2; Runtime topology is unchanged.

---

### Decision 6 — Authority Reconciliation When Domains Diverge

**When Editorial and Runtime representations differ, precedence is split by concern.**

| Concern | Authoritative source |
| ------- | -------------------- |
| Production-enforced Runtime behavior | Runtime Domain — FOUNDATION Runtime Supremacy; ADR-004 Runtime Truth v1 |
| Editorial Story and Scene semantics and boundaries | Editorial Domain — ADR-005 v2.0 |
| Catalog Entity canonical truth and Enrichment | ADR-004 |
| Discovery and Candidate lifecycle | ADR-006 |
| Editorial↔Runtime projection intent (Story ↔ Reading Route) | Rollout governance (this ADR) + Human Acceptance (ADR-004 Decision 2) |
| Editorial Scene ↔ Runtime representation | **Deferred** — downstream SPEC (ADR-005 Deferred Decisions); not authorized here |

**Reconciliation rules:**

* Runtime MUST NOT **silently redefine** editorially approved Story or Scene
  boundaries (NIM-INV-04).
* Editorial Domain MUST NOT **override** production-enforced Runtime routing or
  persistence behavior.
* Editorial Domain MUST NOT treat **Reading Frame** as the authoritative definition
  of editorial progression (NIM-INV-06).
* Temporary divergence during rollout is permitted. Resolution requires
  human-governed projection update — not automatic Runtime overwrite of Editorial
  truth and not silent Editorial bypass of Runtime enforcement.

---

### Decision 7 — Rollout Phases Are Architectural Intent

**Rollout proceeds in architectural phases. Phases are not implementation schedules.**

```text
Phase 0 — Orthogonal Coexistence (current baseline)
  Editorial Domain and Runtime Domain operate independently.
  Runtime Supremacy applies to all production behavior.
  No governed projection is required for Runtime operation.

Phase 1 — Editorial Production Without Runtime Projection
  Approved Story units, Approved Scene units, and Approved Entities may exist in
  Editorial/Production. Story and Scene units are NOT auto-projected to Runtime.
  Catalog Entity path continues through Enrichment → Persist → Runtime.

Phase 2 — Governed Projection Enabled
  Human-accepted **Approved Story unit ↔ Reading Route** associations are
  permitted (implementation: Scene records). **Editorial Scene ↔ Runtime**
  governed mapping is **not** authorized by this ADR (deferred to SPEC).
  Runtime Truth v1 topology unchanged; Story projection is association metadata at
  the architectural layer — implementation deferred to SPEC.
```

Phases describe **architectural readiness**, not deployment commands, migration
 scripts, or feature flags.

---

### Decision 8 — Architecture Closure and SPEC Authorization

**ADR-007 completes the Runtime Truth v1 Architecture layer.**

Upon acceptance of this ADR:

* The Architecture and Rollout decision chain for Runtime Truth v1 is **complete**.
* **No additional Architecture or Rollout ADR is required** before downstream
  SPEC design begins.
* All remaining work MUST follow **ADR → SPEC → Implementation**
  (`governance/ADR_RULES.md` §13, `governance/SPEC_RULES.md` §4).
* SPEC design for Enrichment, Discovery, **Approved Story unit ↔ Reading Route**
  governed projection, and related Runtime Truth v1 capabilities **MAY begin**.

Post-v1 capabilities named in the Constitution capability roadmap (Character
 Relationships, Knowledge Graph, Complete Story Understanding, and similar) are
 **intentionally outside** Runtime Truth v1 Architecture Freeze. They do not
 create a prerequisite Architecture ADR chain before SPEC work authorized here.

---

## Rollout Architectural Invariants

The following invariants are **Rollout constraints**. They are not Runtime
 Domain-enforced production constraints until implemented under downstream SPEC
 governance (`governance/ADR_RULES.md` §7).

**ROL-INV-01 — Runtime Truth v1 topology unchanged**

Rollout MUST NOT alter the `Work → Reading Route → Reading Frame` topology
 defined by ADR-004 (implementation: `Work → Scene → Story Images`).

**ROL-INV-02 — No silent Editorial→Runtime conflation**

Editorial approval MUST NOT silently create, modify, or equate Runtime Reading
 Route records (implementation: Scene records). Association requires governed
 projection (Decision 4).

**ROL-INV-03 — Projection requires Human Acceptance**

Governed projection decisions MUST satisfy ADR-004 Decision 2 (Human Acceptance
 Gate).

**ROL-INV-04 — Story and Scene semantics not redefined**

Rollout MUST NOT publish alternate Story or Scene definitions or Story boundary
 rules. ADR-005 v2.0 remains authoritative for Story and Scene semantics.
 Rollout MUST NOT treat Reading Frame as the authoritative definition of editorial
 progression (NIM-INV-06).

**ROL-INV-05 — Approved Story and Scene units not auto-promoted to Entity**

Approved Story units and Approved Scene units MUST NOT be treated as Production
 Entities or catalog objects without explicit separate governance (ADR-006 Human
 Review outcome paths).

**ROL-INV-06 — Discovery and Enrichment boundaries preserved**

Rollout MUST NOT collapse Discovery (ADR-006) or Enrichment (ADR-004) authority
 boundaries. RT-INV-04 Enrichment scope remains in force for Copilot sessions.

**ROL-INV-07 — Runtime never defines Editorial Story or Scene boundaries**

Runtime topology, routing, or storage convenience MUST NOT define Editorial Story
 or Scene boundaries (ADR-005 NIM-INV-02, NIM-INV-07). Reading Frame MUST NOT
 be treated as the authoritative definition of editorial progression (NIM-INV-06).

---

## Architecture Closure

Upon **Accepted** status of ADR-007, Raree Show achieves **Runtime Truth v1
 Architecture Freeze**:

```text
Constitution
        │
FOUNDATION
        │
ADR-004
        │
ADR-005
        │
ADR-006
        │
ADR-007  ← Architecture / Rollout layer complete
        │
──────────────────────
Architecture Freeze
──────────────────────
        │
SPEC
        │
Implementation
        │
Review
```

**Closure statements:**

* Every architectural deferral recorded by ADR-004, ADR-005, and ADR-006 for
  **Approved Story unit ↔ Reading Route** governed projection is **closed at the
  architecture layer**.
* **Editorial Scene ↔ Runtime Reading Route / Reading Frame** governed mapping
  remains **deferred** to downstream SPEC (ADR-005 v2.0 Deferred Decisions). This
  deferral does **not** block Architecture Freeze or SPEC design for closed
  projection paths.
* **SPEC design is authorized** for all capabilities whose parent ADRs are Accepted,
  including Enrichment, Discovery, and **Approved Story unit ↔ Reading Route**
  governed projection.
* Implementation MUST NOT begin from ADR text alone; Approved SPEC is required
  (`governance/SPEC_RULES.md` §4).
* Post-v1 capabilities deferred by this ADR belong to **SPEC**, **Implementation**,
  or the **Constitution capability roadmap** — not to a mandatory next Architecture
  ADR before SPEC work may start.

---

## Relationship to ADR-004

This ADR closes the cross-domain mapping deferral referenced by ADR-004 §15 and
 Follow-up Roadmap. It does **not** supersede ADR-004.

ADR-004 remains authoritative for:

* Human-Owned Canonical Truth (Decision 1)
* Human Acceptance Gate (Decision 2)
* Runtime Truth v1 topology and Enrichment Copilot architecture
* Copilot Runtime Invariants RT-INV-01 through RT-INV-13

ADR-007 owns:

* Editorial↔Runtime rollout governance
* **Approved Story unit ↔ Reading Route** orthogonal association model
  (implementation: Scene)
* Explicit deferral of **Editorial Scene ↔ Runtime** governed mapping
* Governed projection principles
* Dual-domain coexistence and authority reconciliation
* Architecture Closure for Runtime Truth v1

ADR-007 MUST NOT weaken any ADR-004 decision or invariant.

---

## Relationship to ADR-005

ADR-007 **depends on** ADR-005 v2.0 (Accepted).

ADR-005 provides:

* Editorial Domain Story and Scene model (Canonical Definitions, Glossary)
* Information Emergence Model (including Scene Sequence and Scene Completion)
* ONE Rule and NIM-INV-01 through NIM-INV-07

ADR-007 adds:

* Governed projection from Approved Story units to Runtime Reading Route
  (implementation: Scene) association — **architecture layer closed**
* Explicit deferral of Editorial Scene ↔ Runtime mapping to downstream SPEC
* Rollout phases and ROL-INV-* invariants
* Architecture Closure

Rollout MUST respect ADR-005 Story and Scene boundaries. Governed Story projection
 MUST NOT use Runtime topology to define Story boundaries (NIM-INV-02). Scene
 Candidates MUST NOT substitute for Story boundary adjudication (NIM-INV-07).
 Reading Frame MUST NOT be treated as editorial progression authority (NIM-INV-06).

This ADR MUST NOT weaken any ADR-005 decision or invariant.

---

## Relationship to ADR-006

ADR-007 **depends on** ADR-006 v1.3 (Accepted).

ADR-006 provides:

* Authority Emergence Model and Discovery boundary
* Human Review outcome paths (Catalog Entity vs Story unit vs Scene unit)
* Scene Candidate Generation as editorial capability class producing **Editorial
  Scene** Candidates

ADR-007 clarifies:

* Approved Story units reach Runtime influence only via **Approved Story unit ↔
  Reading Route** governed projection — not Entity promotion or silent persist
* Approved Scene units remain Editorial Domain artifacts; **no** Scene → Runtime
  governed mapping is defined or authorized by this ADR (deferred)
* Scene Candidate outcomes yield **Approved Scene units** — not Reading Route or
  Reading Frame records

Discovery and Enrichment authority boundaries remain unchanged (DISC-INV-06,
 ROL-INV-06).

This ADR MUST NOT weaken any ADR-006 decision or invariant.

---

## Relationship to Runtime Truth v1

Current Runtime Truth v1 topology in the **Runtime Domain** is unchanged by this
 Rollout ADR.

```text
Work
 └─ Reading Route              (routable reading container)
      └─ Reading Frame         (ordered narrative-visual units; JSONB)
```

*Implementation symbols: Reading Route → `scenes`; Reading Frame → `story_images_v2[]` element.*

This ADR governs **how Editorial Domain artifacts may associate** with that
 topology through governed projection. It does not add Story as a routable node,
 replace Reading Route (implementation: Scene), or redesign the reading flow.

When Editorial Domain and Runtime Domain descriptions diverge, **split precedence**
 (Decision 6) applies.

---

## Deferred Decisions

The following are explicitly deferred. They MUST NOT be inferred from this ADR.

| Deferred item | Expected governance home |
| ------------- | ------------------------ |
| **Editorial Scene ↔ Runtime Reading Route / Reading Frame governed mapping** | **SPEC** (architecture deferral acknowledged; ADR-005 v2.0 Deferred Decisions) |
| Projection schema, link model, or API (Story ↔ Reading Route) | SPEC |
| Synchronization algorithms or batch migration | SPEC or Implementation |
| Scene Candidate → Runtime Reading Route review UI | SPEC |
| Candidate persistence / Discovery session (Discovery) | SPEC (ADR-006) |
| Relationship delta persistence | SPEC (post-v1 capability) |
| Story Arc visibility in Runtime | SPEC or post-v1 capability |
| Knowledge Graph integration | post-v1 capability (Constitution roadmap) |
| Alias merge / cross-reference resolution | post-v1 capability |

Implementation of any deferred item MUST follow **ADR → SPEC → Implementation**
 (`governance/ADR_RULES.md` §13).

---

## Out of Scope

This Rollout ADR explicitly excludes:

* Runtime Truth v1 topology redesign
* Runtime Truth v1 Reading Route or Reading Frame semantic redefinition
* Editorial Scene → Reading Route or Editorial Scene → Reading Frame governed
  mapping (deferred to SPEC)
* Discovery or Enrichment architecture changes
* Knowledge Graph or Relationship Graph architecture
* Database schema, API contracts, migration SQL, or UI design
* Deployment procedures, feature flags, or operational runbooks
* Synchronization or replication implementation
* Bootstrap revival (ADR-001 remains Superseded)

---

## Alternatives Considered

**Alternative A — Story replaces Scene as the routable Runtime unit.**

Rejected. Redesigns Runtime Truth v1. Violates ADR-004 Runtime topology and
 Rollout non-goals.

**Alternative B — Reading Route subsumes Story (1:1 identity merge).**

Rejected. ADR-005 Alternative B rejects **Scene equated to Story** — not Editorial
 Scene **within** Story. Identity merge of Story with Reading Route conflates
 domains and violates ROL-INV-02.

**Alternative C — Story as a first-class Runtime routable entity.**

Rejected. Introduces a new Runtime node between Work and Scene. Redesigns routing
 layer beyond Runtime Truth v1 scope.

**Alternative D — Implicit mapping on persist or Discovery acceptance.**

Rejected. Violates Human Acceptance Gate for projection decisions and reproduces
 silent conflation rejected by ADR-004 and ADR-006.

**Approved — Alternative E: Orthogonal coexistence with governed projection.**

Story and Reading Route (implementation: Scene) remain domain-distinct.
 Editorial→Runtime association requires explicit, human-accepted governed
 projection onto existing Reading Route records (implementation: Scene records)
 without topology redesign.

---

## Trade-offs

**Positive**

* Closes the final Runtime Truth v1 architecture deferral from ADR-004, ADR-005,
  and ADR-006
* Enables Architecture Freeze and authorized downstream SPEC design
* Preserves Runtime Truth v1 stability while allowing Editorial evolution
* Clear Story path, Scene path, and Catalog Entity path through Runtime boundary
* Split precedence reconciles Editorial truth with Runtime Supremacy

**Costs**

* Dual-domain model with governed projection increases governance and SPEC complexity
* Story has no independent Runtime route — reader navigation remains Reading Route-centric (implementation: Scene)
* Operator must understand projection vs persist vs Enrichment vs Discovery
* Editorial Scene ↔ Runtime mapping deferred — additional SPEC work when authorized
* Phase 2 Story projection implementation remains entirely downstream in SPEC

---

## Refs

### Governance

```text
governance/Constitution.md                     Reader principles; Story Structure roadmap
governance/FOUNDATION.md                       Runtime Supremacy Law; authority hierarchy
governance/ADR_RULES.md                        ADR lifecycle; ADR → SPEC → Implementation
governance/SPEC_RULES.md                       ADR/SPEC division of responsibility
governance/specs/AUTHORITY_BOUNDARY_AND_PRECEDENCE_SPEC.md
```

### Related ADRs

```text
ADR-004 — Source of Canonical Truth (parent; Runtime Truth v1 and Enrichment)
ADR-005 v2.0 — Narrative Information Model (parent; Editorial Domain Story and Scene)
ADR-006 v1.3 — Discovery Copilot Architecture (parent; Authority Emergence and Discovery)
ADR-D2-001 — Canonical Metadata Authority (Tier metadata ingress)
ADR-001 — Assisted Work Bootstrap Pipeline (Historical; Superseded)
```

---

## Legacy Alias Reference (A1)

*Added by Amendment A1 — Runtime Vocabulary Alignment. See `governance/vocabulary/runtime-lexicon.md` for the complete normative registry.*

| Normative Term | Legacy Term | Classification | Status |
| -------------- | ----------- | -------------- | ------ |
| Reading Route | Scene | Implementation Alias | Active — appears as `(implementation: Scene)` |
| Reading Frame | Story Image | Implementation Alias | Active — appears as `(implementation: Story Image)` |

**Layer disambiguation (A2):** **Editorial Scene** (ADR-005 Layer 3) is **not** the
 Reading Route implementation alias Scene (Runtime Layer 5). Governance artifacts
 MUST NOT conflate them.
