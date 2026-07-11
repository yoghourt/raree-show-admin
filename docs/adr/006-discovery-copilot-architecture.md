# ADR-006 — Discovery Copilot Architecture

**Status:** Accepted
**Type:** Architecture ADR
**Version:** 1.3
**Last Updated:** 2026-07-11
**Owner:** Architect
**Related ADR:** ADR-004 (Source of Canonical Truth — Human Acceptance Gate and Enrichment Copilot authority); ADR-005 v2.0 (Narrative Information Model — Editorial Domain, Story and Scene ontology, Information Emergence); ADR-007 (Editorial → Runtime Rollout Architecture — Architecture Closure); ADR-D2-001 (Canonical Metadata Authority — Tier 1 / Tier 2 / Tier 3)
**Amendment:** Clarification only — A1 (Human Review outcome paths: Catalog Entity vs Story unit; ADR-D2-001 relationship), A2 (Relationship to ADR-007; cross-domain mapping and Story runtime representation deferral closed), A3 (Editorial Scene alignment with ADR-005 v2.0 — terminology, Human Review Scene unit path, Information Emergence and invariant cross-references; **no** Decisions, Discovery capability, Authority Emergence topology, Runtime topology, or projection architecture changes). Prior amendments A1–A2 preserved in substance.

---

## What

This ADR establishes the **Discovery Copilot Architecture** for the Raree Show
 **Editorial Domain**.

It defines:

* **Discovery** as a first-class architectural capability distinct from Enrichment,
  Production, and Runtime.
* The **Authority Emergence Model** — the required order in which canonical
  authority may be assigned.
* The **Glossary** of Discovery-domain terms for downstream ADRs and SPECs.
* **Discovery architectural responsibilities** and capability classes.
* **Discovery Architectural Invariants** binding the Discovery boundary.
* The relationship between Discovery, ADR-004 Enrichment Copilot, ADR-005
  Information Emergence, and current D2 implementation.
* **Future extension points** for downstream governance.

The central architectural diagram of this ADR is the **Authority Emergence**
 boundary model:

```text
Editorial Domain
────────────────────────────

Narrative
      │
      ▼
Discovery
      │
Candidate
      │
Human Review
────────────────────────────
Production Domain
      │
Approved Entity
      │
Enrichment
      │
Persist
────────────────────────────
Runtime Domain
      │
Reading Route          [impl: Scene]
      │
Reader
```

This ADR explicitly does **not** govern:

* Runtime schema, database design, API contracts, or UI
* Candidate persistence model or storage format
* Enrichment Copilot routing, field classification, or suggestion pipelines
  (ADR-004 / SPEC-D2-002 remain authoritative)
* AI orchestration implementation details

---

## Why

Raree Show requires a governed path from narrative understanding to editorial
 catalog objects without reviving rejected Bootstrap patterns or collapsing
 Discovery into Enrichment.

Four structural problems motivate this ADR:

**Problem 1 — Discovery has no architectural home.**

The current D2 implementation is an **Enrichment Architecture** only. The
 repository implements field suggestion for entities the operator has already
 decided to create (`hooks/useCopilotSession.ts`, `lib/ai/suggest-service.ts`).
 No Character Discovery, Location Discovery, Story Discovery, Scene Candidate
 Generation, or Candidate Generation capability exists. ADR-004 RT-INV-04 and AC-31 explicitly defer
 entity-discovery capabilities to ADR-006. This ADR closes that deferral at
 the **architecture layer**. ADR-006 introduces a **new architecture**, not a
 documentation exercise for existing Discovery code.

**Problem 2 — Enrichment and Discovery are conflated without a boundary.**

Enrichment answers: *"How should this existing entity be completed?"*

Discovery answers: *"What entities should exist?"*

These questions have different authority implications. Without an explicit
 Discovery domain, AI field suggestion on a human-scoped entity (Enrichment)
 and AI catalog proposal (Discovery) cannot be distinguished at the architecture
 layer. ADR-004 RT-INV-04 draws this boundary for the Copilot runtime; ADR-006
 formalises the Discovery side.

**Problem 3 — Historical Bootstrap mixed propose and persist.**

ADR-001 (Assisted Work Bootstrap Pipeline) combined Work metadata → AI generation
 → immediate persistence without per-entity human review. ADR-004 Decision 7
 rejected this as production architecture. Reviving Bootstrap patterns under a
 Discovery label would violate Human-Owned Canonical Truth (ADR-004 Decision 1)
 and the Human Acceptance Gate (ADR-004 Decision 2). Discovery MUST remain
 architecturally separate from batch catalog generation and persist.

**Problem 4 — Authority assignment lacks an emergence model.**

ADR-005 defines **Information Emergence** — the dependency order in which
 editorial knowledge may be derived (Narrative → Story → Scene Sequence →
 Knowledge). It does not define **when canonical authority begins**. Without an Authority Emergence
 model, AI proposals and human-approved entities share no explicit architectural
 boundary. Operators and implementers cannot determine where Discovery ends and
 Production begins.

This ADR resolves these problems within the **Editorial and Production boundary
 model** without altering Runtime Truth v1 or redesigning D2 Enrichment.

---

## Foundational Principle

> **Discovery proposes; Production decides.**

Authority Emergence corollary:

> **Authority does not emerge when AI proposes; it emerges only after Human Review
> transitions a Candidate into an Approved Entity (catalog path), Approved Story
> unit, or Approved Scene unit (editorial paths).**

Further corollaries:

* **Candidates** have no canonical standing. A Candidate is a proposed editorial
  object awaiting review, not a fact and not an entity.
* **Canonical truth** begins only after explicit human acceptance (ADR-004
  Decision 2). Discovery never owns canonical truth.
* **Discovery never persists** entities. Persistence is a Production action
  occurring after authority has emerged.
* **Narrative precedes Knowledge** (ADR-005 Decision 6). Discovery operates on
  narrative understanding; it must not be driven by Runtime topology or storage
  structure.
* **Shared infrastructure is permitted; shared authority is forbidden.** Discovery
  and Enrichment MAY reuse LLM adapters, evidence retrieval, and similar
  implementation infrastructure. They MUST NOT share session semantics, authority
  boundaries, or persist gates.

---

## Authority Emergence Model

If ADR-005's core is **Information Emergence** (which editorial knowledge may
 depend on which upstream artifacts), then ADR-006's core is **Authority
 Emergence** (at which step canonical authority is assigned):

```text
ADR-005   Information Emergence  —  knowledge dependency order
ADR-006   Authority Emergence    —  authority assignment order
```

Authority MUST emerge in the following **assignment order**. Implementations
 MUST preserve this order and MUST NOT assign canonical standing upstream of
 Human Review.

```text
Editorial Domain
────────────────────────────

Narrative
      │
      ▼
Discovery
      │
Candidate
      │
Human Review
────────────────────────────
Production Domain
      │
Approved Entity
      │
Enrichment
      │
Persist
────────────────────────────
Runtime Domain
      │
Reading Route          [impl: Scene]
      │
Reader
```

This model describes **authority assignment order** — at which architectural
 step an artifact gains canonical standing. It is **not** a strict step-by-step
 **workflow execution order**. Editorial and Production workflow steps MAY
 interleave or iterate as long as no step treats a downstream artifact as
 authoritative before its upstream authority gate is satisfied.

Governing rule:

> **Authority must emerge in this order.**

### Domain boundaries

**Editorial Domain (upper segment)**

Discovery responsibility begins at **Narrative** — human-provided or
 human-approved editorial narrative input (e.g., chapter text, Story unit
 content, or equivalent narrative understanding). Discovery **proposes**
 **Candidates**. **Human Review** is the final step of Discovery: the operator
 accepts, edits, or discards each Candidate. Discovery **ends** at Human Review.
 No step in this segment assigns canonical authority.

**Production Domain (middle segment)**

The first horizontal boundary marks the transition from Discovery to Production.
 **Approved Entity** is the first artifact with canonical standing — the
 Production outcome of Human Review when a Candidate is accepted or edited into
 existence. **Enrichment** (ADR-004 Copilot) operates on Approved Entities to
 complete field values; it does not propose which entities should exist.
 **Persist** writes approved data through Production paths (e.g., CRUD). Persist
 is not a Discovery action.

**Runtime Domain (lower segment)**

The second horizontal boundary separates Production from Runtime. **Reading Route**
 (normative; implementation alias: Scene) is the current Runtime Truth v1
 routable reading unit. **Reader** consumes persisted, approved content. Runtime
 **never performs Discovery**. Runtime serves data that has already passed through
 Production authority gates.

**Editorial Scene** (ADR-005 Canonical Definition — Scene) is an **Editorial Domain**
 object within Story. It MUST NOT be conflated with **Reading Route** (Runtime Domain)
 or **Reading Frame** (Runtime representation).

### Node semantics

| Node | Domain | Authority | Role |
| ---- | ------ | --------- | ---- |
| **Narrative** | Editorial | None | Input to Discovery; narrative understanding, not storage topology |
| **Discovery** | Editorial | None | Capability that proposes Candidates from Narrative |
| **Candidate** | Editorial | None | Proposed editorial object awaiting Human Review |
| **Human Review** | Editorial | None | Operator accept, edit, or discard; last Discovery step |
| **Approved Story unit** | Editorial | **First editorial authority** | Human-approved Story per ADR-005; not an Entity |
| **Approved Scene unit** | Editorial | **Editorial authority** | Human-approved Scene within Story per ADR-005; not an Entity |
| **Approved Entity** | Production | **First catalog authority** | Human-approved catalog object (Character, Location, etc.) |
| **Enrichment** | Production | Inherited | Field completion on Approved Entity (ADR-004) |
| **Persist** | Production | Inherited | Production write to durable storage |
| **Reading Route** | Runtime | Served | Runtime Truth v1 routable unit (implementation alias: Scene) |
| **Reader** | Runtime | Served | Reading and serving approved data |

**Discarded Candidates** never cross the first boundary. They never gain
 canonical standing and never enter Production or Runtime as entities.

### Human Review outcome paths (Catalog Entity vs Story unit vs Scene unit)

Human Review is the last step of Discovery for **all** Candidate types. The
 **outcome artifact class** after acceptance differs by Candidate type. Downstream
 SPECs and implementations MUST NOT treat every accepted Candidate as a
 Production **Entity**.

**Catalog Entity path** (Character, Location, and catalog-scoped editorial objects
 governed as Production catalog objects):

```text
Character / Location Candidate
        ↓
Human Review (accept, edit, or discard)
        ↓
Approved Entity          ← first catalog authority (Production Domain)
        ↓
Enrichment (ADR-004) → Persist → Runtime
```

**Story unit path** (Story Discovery; ADR-005 Story semantics):

```text
Story Candidate
        ↓
Human Review (accept, edit, or discard)
        ↓
Approved Story unit      ← Editorial Domain artifact (ADR-005); NOT an Entity
        ↓
Knowledge Extraction …   ← per ADR-005 Information Emergence Model
```

An **Approved Story unit** is an editorial narrative unit satisfying ADR-005
 Canonical Definition — Story and NIM-INV-05. It is **not** an **Entity** as defined in
 this ADR's Glossary. Story units do not cross the Production Domain boundary as
 catalog Entities until governed projection per ADR-007 (Accepted).

**Scene unit path** (Scene Candidate Generation; ADR-005 Scene semantics):

```text
Scene Candidate
        ↓
Human Review (accept, edit, or discard)
        ↓
Approved Scene unit      ← Editorial Domain artifact (ADR-005); NOT an Entity
        ↓
Scene Completion …       ← per ADR-005 Information Emergence Model
```

An **Approved Scene unit** is an editorial progression unit within an Approved
 Story unit, satisfying ADR-005 Canonical Definition — Scene and NIM-INV-05. It is
 **not** an **Entity**, **not** a **Reading Route** (implementation: Scene record),
 and **not** a **Reading Frame**. Scene units do not cross the Production Domain
 boundary as catalog Entities.

**Scene Candidate Generation** proposes **Editorial Scene** Candidates from narrative
 understanding within Story scope. Cross-domain association with Runtime **Reading Route**
 records (implementation: Scene records) is governed by **ADR-007** and is **not**
 defined or authorized by this ADR. Human Review outcomes for Scene Candidates MUST
 NOT be assumed to be Reading Route or Reading Frame records without human-accepted
 governed projection per ADR-007.

### Relationship to Information Emergence

Discovery sits on the **upstream side** of ADR-005's Information Emergence chain:
 it proposes editorial knowledge objects (Character, Location, Story, Scene, and
 related candidates) from Narrative understanding. Discovery **does not define Story
 boundaries** (ADR-005 NIM-INV-02) and **does not define Scene boundaries as Story
 boundary substitutes** (ADR-005 NIM-INV-07). Story Discovery candidates MUST respect
 ADR-005 Story semantics and the ONE Rule when proposed for human review. Scene
 Candidate proposals MUST respect ADR-005 Scene semantics and MUST NOT treat
 **Reading Frame** as the authoritative definition of editorial progression
 (ADR-005 NIM-INV-06).

Information Emergence governs **what may depend on what**. Authority Emergence
 governs **when authority is assigned**. Both models MUST be satisfied; neither
 replaces the other.

---

## Glossary

The following terms are **canonical for the Discovery architecture** defined by
 this ADR. Downstream ADRs and SPECs MUST use these definitions and MUST NOT
 redefine them with conflicting semantics.

Terms **Story**, **Scene**, **Approved Story unit**, **Approved Scene unit**,
 **Narrative Progression Step**, **Knowledge Artifact**, **Editorial Domain**,
 **Runtime Domain**, **Chapter**, and **Human Acceptance Gate** are defined in
 ADR-005 Glossary and Canonical Definitions (and ADR-004 for Human Acceptance Gate).
 This ADR references those definitions and MUST NOT redefine them.

**Editorial Scene** (ADR-005) MUST NOT be conflated with Runtime **Reading Route**
 (implementation alias: Scene) or **Reading Frame**.

**Discovery**

A capability that **proposes candidate editorial knowledge** — suggesting which
 Characters, Locations, Stories, Scenes, or related editorial objects may exist
 based on narrative understanding. Discovery answers: *"What entities should exist?"*
 (catalog path) and *"What editorial narrative units should exist?"* (Story and
 Scene paths).

**Candidate**

A **proposed editorial object** awaiting human review. A Candidate has **no
 canonical standing**. It is not an Entity, not Runtime Truth, and not
 pre-approved knowledge.

**Entity**

A **human-approved catalog object** — the Production outcome when Human Review
 accepts or edits a **catalog-scoped** Candidate (Character, Location, or equivalent
 catalog object) into existence. An Entity is the first artifact in the Authority
 Emergence chain with **catalog** canonical standing. An **Approved Story unit** or **Approved Scene unit** (Story or Scene Candidate
 paths) is not an Entity; see **Human Review outcome paths**.

**Enrichment**

The completion of fields on an **Approved Entity** already in Production scope.
 Enrichment answers: *"How should this entity be completed?"* Enrichment is
 governed by ADR-004 and SPEC-D2-002. It is not Discovery.

**Production**

The architectural domain where **human acceptance and persistence decisions**
 occur for **catalog objects**. Production begins when Human Review transitions a
 catalog-scoped Candidate into an Approved Entity. Production includes Enrichment
 and Persist. Story and Scene unit acceptance remains in the Editorial Domain
 (Approved Story unit and Approved Scene unit paths); see **Human Review outcome paths**.

**Runtime**

The architectural domain where **approved data is read and served**. Current
 Runtime Truth v1 (`Work → Reading Route → Reading Frame`; implementation:
 `Work → Scene → Story Images`) belongs to the Runtime Domain. Runtime never
 performs Discovery.

---

## Decision

### Decision 1 — Discovery Is a Distinct Architectural Domain

**Discovery is a distinct architectural domain from Enrichment, Production, and
 Runtime.**

Each domain answers a different architectural question:

```text
Discovery:   What entities should exist?
Enrichment:  How should this entity be completed?
Production:  What has human authority to be persisted?
Runtime:     What is served to the reader?
```

Discovery occupies the **Editorial Domain upper segment** of the Authority
 Emergence Model. It MUST NOT be implemented as an extension of Enrichment
 Copilot session semantics (ADR-004 RT-INV-04).

---

### Decision 2 — Discovery Produces Candidates Only

**Discovery produces Candidates only.**

Discovery output types are limited to proposed editorial objects awaiting Human
 Review. Discovery MUST NOT:

* Output catalog-level canonical datasets
* Present Candidates as production-ready entities
* Assign confidence or authority that bypasses Human Review

Candidates remain in the Editorial Domain until Human Review completes.

---

### Decision 3 — Discovery Never Persists Canonical Entities

**Discovery never persists canonical entities.**

No Discovery operation — including Candidate generation, batch proposal, or
 automated review assistance — MAY write Approved Entities or catalog records
 to durable storage. **Persist** appears only in the Production Domain segment
 of the Authority Emergence Model.

This decision preserves ADR-004 Decision 1 (Human owns Canonical Truth) and
 Decision 2 (Human Acceptance Gate).

---

### Decision 4 — Human Review Separates Discovery from Production

**Human Review is the architectural boundary between Discovery and Production.**

Human Review is the **last step of Discovery**. The operator accepts, edits, or
 discards each Candidate. Discovery **ends** when Human Review completes for a
 given Candidate.

**Candidate acceptance or edit into an Approved Entity** is a **Production**
 entry action, not a Discovery action. It occurs **below** the first horizontal
 boundary in the Authority Emergence Model.

**Candidate acceptance into an Approved Story unit or Approved Scene unit** is an
 **Editorial Domain** outcome, not a Production Entity promotion. It occurs in the
 Editorial segment of the Authority Emergence Model.

Production MUST NOT begin without Human Review. Discovery MUST NOT bypass Human
 Review.

---

### Decision 5 — Discovery Is Narrative-First

**Discovery is narrative-first.**

Discovery MUST operate on **narrative understanding** — human-provided or
 human-approved editorial narrative input. Discovery MUST NOT use Runtime storage
 topology, Reading Route records (implementation: Scene records), or database
 structure as primary inputs for proposing Candidates.

This decision aligns with ADR-005 Decision 6 (Narrative Precedes Knowledge) and
 NIM-INV-02 (Knowledge does not define boundaries). Discovery proposes knowledge
 objects from Narrative; it does not define Story boundaries from catalog structure.

Story Discovery candidates MUST respect ADR-005 Story semantics, Narrative
 Closure, and the ONE Rule when proposed for operator review.

---

### Decision 6 — Infrastructure Reuse Without Authority Merge

**Discovery and Enrichment MAY reuse infrastructure while remaining
 architecturally independent.**

Permitted shared infrastructure includes, without limitation:

* LLM text generation adapters
* Evidence retrieval and Source Connector orchestration (SPEC-D2-003)
* Normalization utilities

Forbidden merges include:

* Sharing Enrichment session semantics (entity-scoped suggest, scope-field gate,
  RT-INV-01 through RT-INV-13) as the Discovery session model
* Treating Discovery Candidates as Enrichment suggestions
* Allowing Enrichment Copilot to propose which entities should exist (RT-INV-04)

Shared services are allowed. Shared authority is forbidden.

---

### Decision 7 — Discovery Is Independent from Runtime Representation

**Discovery is independent from Runtime representation.**

This ADR does not modify, endorse, or implement Runtime Truth v1 topology:

```text
Work
 └─ Reading Route       (normative; implementation alias: Scene)
      └─ Reading Frame  (normative; implementation: Story Images)
```

Scene Candidate Generation (a Discovery capability class) proposes **Editorial Scene**
 Candidates derived from narrative understanding within Story scope. It does not
 equate Editorial Story or Scene units with Reading Route records (implementation:
 Scene records) or Reading Frame records. Cross-domain association is governed by
 **ADR-007**. **No Scene → Runtime mapping is defined or authorized by this ADR.**

Until that Rollout ADR is Accepted and implemented, Runtime Domain supremacy
 applies unchanged (`governance/FOUNDATION.md` §1).

---

### Decision 8 — Discovery Is Multi-Pass, Not Bootstrap Generation

**Discovery is multi-pass, not single-pass bootstrap generation.**

Discovery MUST NOT reproduce the ADR-001 Bootstrap pattern:

```text
Work → AI generation → Persist   (REJECTED)
```

Valid Discovery architecture preserves Human Review between Candidate proposal
 and Approved Entity creation. Single-pass generation of a full catalog with
 immediate or bulk persistence is rejected.

This aligns with ADR-005 Decision 7 (multi-pass editorial philosophy) and
 ADR-004 Decision 8 (catalog-level acceptance rejected).

---

## Discovery Capability Classes

The following capability classes define Discovery **architectural
 responsibilities**. They are not implementation commitments. Each MUST conform
 to the Authority Emergence Model and Discovery invariants below.

```text
Character Discovery
Location Discovery
Story Discovery
Scene Candidate Generation
Candidate Review workflows
```

**Character Discovery** — Proposes Character Candidates from narrative understanding.

**Location Discovery** — Proposes Location Candidates from narrative understanding.

**Story Discovery** — Proposes Story unit Candidates respecting ADR-005 Story
 semantics and the ONE Rule.

**Scene Candidate Generation** — Proposes **Editorial Scene** Candidates within
 Story scope, respecting ADR-005 Scene semantics and NIM-INV-06/07. MUST NOT
 equate Editorial Scene with Reading Route (implementation: Scene) or Reading Frame.
 MUST NOT treat Runtime topology as the editorial Story or Scene definition
 (ADR-005 Alternative B rejection scope: Scene **equated to** Story — not Scene
 **within** Story).

**Candidate Review workflows** — Human Review interfaces and processes for accept,
 edit, and discard decisions. Architecturally part of the Discovery boundary;
 implementation deferred to future SPECs.

---

## Discovery Architectural Invariants

The following invariants are **Discovery architectural constraints**. They are
 Editorial-domain and Production-boundary constraints. They are not Runtime
 Domain-enforced constraints and MUST NOT be classified as constitutional
 invariants or Runtime-Enforced status (`governance/ADR_RULES.md` §7).

Each invariant references the **Authority Emergence Model** diagram.

**DISC-INV-01 — Discovery never persists**

Discovery operations MUST NOT persist Approved Entities, Candidates, or catalog
 records. Persist occurs only in the Production Domain segment.

**DISC-INV-02 — Discovery never bypasses Human Acceptance**

No Discovery path MAY assign canonical standing without Human Review. ADR-004
 Decision 2 applies without exception.

**DISC-INV-03 — Candidates have no canonical standing**

Candidates MUST NOT be treated as Entities, Runtime Truth, or pre-approved
 Knowledge Artifacts at any layer — API, UI, or persistence design.

**DISC-INV-04 — Discovery must not define Story or Scene boundaries**

Discovery MUST NOT use Character, Location, or catalog Candidates to define or
 redefine Story boundaries. Discovery MUST NOT use Scene Candidates to define,
 replace, or substitute for Story boundary adjudication. Aligns with ADR-005
 NIM-INV-02 and NIM-INV-07.

**DISC-INV-05 — Runtime never performs Discovery**

The Runtime Domain MUST NOT initiate, host, or expose Discovery capabilities.
 Runtime serves persisted approved data only (Reading Route → Reader segment).

**DISC-INV-06 — Discovery must not operate within Enrichment authority**

Discovery MUST NOT be implemented under ADR-004 Enrichment Copilot framing alone.
 RT-INV-04 (Entity discovery prohibited under Copilot architecture) remains in
 force until Discovery is implemented under ADR-006 governance and downstream SPECs.

**DISC-INV-07 — Shared infrastructure does not merge authority**

Reuse of LLM adapters, evidence retrieval, or other shared services MUST NOT
 collapse Discovery and Enrichment authority boundaries. Infrastructure sharing
 does not permit shared persist gates or shared session semantics.

---

## Relationship to ADR-004

This ADR formalises the Discovery architecture deferred by ADR-004. It does not
 supersede ADR-004.

ADR-004 remains authoritative for:

* Human-Owned Canonical Truth (Decision 1)
* Human Acceptance Gate (Decision 2)
* Enrichment Copilot workflow, field classification, and suggestion pipelines
* Copilot Runtime Invariants RT-INV-01 through RT-INV-13
* Scope Definition Model and duplicate prevention for Enrichment sessions

ADR-006 owns:

* Discovery architecture and capability classes
* Authority Emergence Model
* Candidate lifecycle semantics (architectural, not persistence)
* Discovery Architectural Invariants (DISC-INV-*)

ADR-006 MUST preserve:

* Human Acceptance Gate (ADR-004 Decision 2)
* Human Owns Canonical Truth (ADR-004 Decision 1)
* RT-INV-04 Discovery boundary intent
* NIM-INV-05 (ADR-005 — human acceptance final)

**Enrichment vs Discovery:**

| Question | Domain | ADR |
| -------- | ------ | --- |
| *What entities should exist?* | Discovery | ADR-006 |
| *How should this entity be completed?* | Enrichment | ADR-004 |

Any implementation that introduces Discovery capabilities under ADR-004 Enrichment
 framing alone is non-conformant and requires ADR-006 downstream SPEC governance
 before implementation.

---

## Relationship to ADR-005

ADR-006 **depends on** ADR-005 v2.0 (Accepted).

ADR-005 provides:

* Editorial Domain Story and Scene model, Canonical Definitions, and Glossary
* Information Emergence Model (knowledge dependency order, including Scene Sequence
  and Scene Completion)
* ONE Rule and Narrative Closure principles
* Multi-pass editorial philosophy
* Editorial Architectural Invariants NIM-INV-01 through NIM-INV-07

ADR-006 adds:

* Authority Emergence Model (authority assignment order)
* Discovery capability classes and boundary
* Candidate semantics

**Information Emergence vs Authority Emergence:**

| Model | ADR | Governs |
| ----- | --- | ------- |
| Information Emergence | ADR-005 | Which artifacts may depend on which |
| Authority Emergence | ADR-006 | When canonical authority is assigned |

Discovery operates against the **Editorial Domain Story and Scene model** when
 proposing Story and Scene Candidates. Discovery MUST NOT bypass ADR-005 editorial
 boundary principles. Discovery MUST NOT use Knowledge Artifacts or catalog structure
 to define Story boundaries (NIM-INV-02) or Scene boundaries as Story boundary
 substitutes (NIM-INV-07). Discovery MUST NOT treat Reading Frame as the authoritative
 definition of editorial progression (NIM-INV-06).

This ADR MUST NOT weaken any ADR-005 decision or invariant.

---

## Relationship to ADR-D2-001 — Source Extraction vs Discovery

ADR-D2-001 governs **where structural metadata evidence comes from** (Tier 1
 user-supplied extraction, Tier 2 bibliographic APIs, Tier 3 manual fallback).
 ADR-006 governs **how editorial catalog objects are proposed from narrative**
 (Discovery → Candidate → Human Review).

These are **complementary architectural paths**, not competing authority sources.

| Path | ADR | Question | Typical output |
| ---- | --- | -------- | ---------------- |
| Source extraction | ADR-D2-001 | What does the source file or bibliographic record structurally contain? | Chapter Catalog spine; optional NER name lists as **evidence** |
| Discovery proposal | ADR-006 | What editorial catalog objects and narrative units should exist from narrative understanding? | Character, Location, Story, **Editorial Scene** **Candidates** |

**Precedence and combination rules (architectural):**

* Tier 1 / Tier 2 outputs are **evidence ingress**. They do NOT automatically
  create Approved Entities or Approved Story units. Human Acceptance (ADR-004
  Decision 2) remains mandatory.
* Discovery MUST NOT bypass ADR-D2-001 Tier authority when Tier-1 evidence exists
  for Fact Suggestion fields (ADR-004 SC-04). Source extraction informs evidence;
  Discovery proposes editorial Candidates — separate authority boundaries.
* **Chapter Catalog** structural truth is owned by ADR-D2-001 Tier 1/2 scope.
  **Story boundaries** are owned by ADR-005 Editorial Domain semantics. Tier
  chapter metadata MUST NOT define Story boundaries (ADR-005 Decision 2).
* When both paths surface names for the same work, implementations MAY present
  them in the same Human Review context. They MUST NOT merge Discovery and
  Enrichment session semantics or auto-persist either path without Human Review.

ADR-D2-001 does not supersede ADR-006. ADR-006 does not supersede ADR-D2-001.
 Downstream SPECs MUST declare which path(s) they implement.

---


## Relationship to ADR-007

ADR-007 (Accepted) governs **Editorial → Runtime Rollout** and **Architecture
 Closure**. This ADR governs **Discovery** and **Authority Emergence**.

Cross-domain mapping and Story runtime representation (architecture intent) deferrals
 from this ADR are **closed** by ADR-007 for **Approved Story unit ↔ Reading Route**
 governed projection. **Approved Scene unit** cross-domain association with Runtime
 **Reading Route** or **Reading Frame** remains governed by **ADR-007** and downstream
 SPEC — not by this ADR. Editorial artifacts reach Runtime only through **governed
 projection** — not Entity promotion or silent persist.

This ADR MUST NOT weaken ADR-007 rollout boundaries or introduce Scene → Runtime
 mapping not authorized by ADR-007.

---

## Relationship to D2 Enrichment


Current D2 implementation is **Enrichment only**.

The repository implements SPEC-D2-002 Enrichment Copilot and SPEC-D2-003 Source
 Connector evidence architecture. SPEC-D2-002 §2 explicitly excludes Entity
 Discovery of any kind (→ ADR-006; RT-INV-04, AC-31). No Discovery code path
 exists in the current runtime.

**Architectural disposition (not a redesign mandate):**

* **Enrichment stack remains valid** under ADR-004. ADR-006 does not require
  refactoring, replacing, or retiring D2 Enrichment.
* **Discovery is greenfield** at the architecture layer. Future Discovery SPECs
  implement ADR-006; they do not extend Enrichment session semantics.
* **Infrastructure reuse is permitted** (Decision 6). Shared LLM and evidence
  components MAY serve both domains with separate authority boundaries.

Implementation anchors for Enrichment boundary (read-only reference):

* `hooks/useCopilotSession.ts` — Enrichment client session; scope-first, entity-scoped
* `lib/ai/field-registry.ts` — Enrichment field routing; scope fields excluded from AI
* `lib/ai/suggest-service.ts` — Enrichment suggest pipeline; candidates only, no persist

---

## Relationship to Runtime Truth v1

Current Runtime Truth v1 topology in the **Runtime Domain** is unchanged by this ADR.

This ADR governs the **Discovery and Production boundary model** in the Editorial
 and Production layers. Runtime Truth v1 governs the **Runtime Domain** enforced
 reading topology. Editorial↔Runtime association is governed by **ADR-007**;
 governed projection implementation is deferred to downstream SPEC.

When Editorial Domain and Runtime Domain descriptions diverge, **Runtime Domain
 enforcement prevails** for production behavior; **ADR-005 and ADR-006 prevail**
 for Editorial Domain authority and Discovery boundary respectively
 (`governance/FOUNDATION.md` §1).

---

## Future Extension Points

The following are **architectural extension points** for downstream governance.
 This ADR defines intent only. No implementation path is authorized here.

* Character Discovery SPEC
* Location Discovery SPEC
* Story Discovery SPEC
* Scene Candidate Generation SPEC
* Candidate Review UX SPEC
* Candidate staging or persistence SPEC (explicitly deferred — see Deferred Decisions)
* Knowledge Graph extraction (deferred by ADR-005)

All downstream implementation MUST follow **ADR → SPEC → Implementation**
 (`governance/ADR_RULES.md` §13).

---

## Deferred Decisions

The following are explicitly deferred. They MUST NOT be inferred from this ADR.

| Deferred item | Expected governance home |
| ------------- | ------------------------ |
| Candidate persistence model | Future SPEC |
| Discovery session implementation | Future SPEC |
| Discovery API contracts | Future SPEC |
| Candidate review UI | Future UI Spec |
| Batch or Work-level Discovery workflow | Future SPEC |
| AI orchestration details | Implementation layer |
| Database schema for Candidates or Discovery sessions | SPEC |
| Knowledge Graph integration | post-v1 capability (Constitution roadmap) |

---

## Out of Scope

This ADR explicitly excludes:

* Runtime schema and database design
* Candidate persistence format or storage topology
* API and UI design
* Migration strategy
* AI orchestration and LLM provider selection
* Enrichment Copilot redesign (ADR-004 / SPEC-D2-002 unchanged)
* Bootstrap revival (ADR-001 remains superseded)
* Runtime Domain reading flow redesign
* Copilot UI visualization for Discovery

---

## Alternatives Considered

**Alternative A — Bootstrap generation as Discovery.**

Rejected. ADR-001 Bootstrap combined AI generation with immediate persistence
 without per-entity Human Review. ADR-004 Decision 7 rejected this architecture.
 Conflicts with Authority Emergence, Human Acceptance Gate, and ADR-005
 Narrative Precedes Knowledge.

**Alternative B — Discovery inside Enrichment (Copilot extension).**

Rejected. Extending Enrichment Copilot sessions to propose new entities violates
 ADR-004 RT-INV-04 (Entity discovery prohibited under Copilot architecture).
 Enrichment is entity-scoped and scope-first; Discovery is catalog-proposal-scoped
 and narrative-first. Shared infrastructure does not justify merged authority.

**Alternative C — Runtime-driven Discovery (Reading Route topology as input).**

Rejected. Using Reading Route records (implementation: Scene records) or storage
 structure as Discovery input conflates Runtime Domain with Editorial Domain
 cognition (ADR-005 Problem 2). Inverts Narrative-first Discovery (Decision 5) and
 NIM-INV-02.

**Alternative D — Single-pass catalog generation.**

Rejected. Generating a full entity catalog in one undifferentiated pass without
 Human Review per Candidate reproduces Bootstrap failure modes. Conflicts with
 ADR-005 Decision 7 (multi-pass editorial philosophy) and ADR-004 Decision 8
 (catalog-level acceptance rejected).

---

## Trade-offs

**Positive**

* Clear Discovery / Production / Runtime boundary via Authority Emergence Model
* Narrative-first Discovery aligned with ADR-005 Information Emergence
* Preserves ADR-004 Human Acceptance Gate and Enrichment architecture without redesign
* Infrastructure reuse permitted without authority merge
* Closes ADR-004 Discovery deferral with explicit capability classes and invariants
* Greenfield Discovery architecture avoids conflating with rejected Bootstrap

**Costs**

* Discovery is new architecture — downstream SPECs and implementation remain ahead
* Multi-pass Discovery and Review is slower than single-pass Bootstrap generation
* Candidate persistence model deferred — Discovery cannot be runtime-enforced until
  downstream SPECs define staging behavior
* Editorial Domain / Runtime Domain dual model persists until Rollout governs
  **Approved Story unit ↔ Reading Route** projection per ADR-007; Editorial Scene
  ↔ Runtime association remains deferred to ADR-007 / SPEC
* Operator training burden — Discovery, Enrichment, and Production are three distinct
  architectural questions

---

## Refs

### Evidence Chain

Evidence supporting Discovery architecture and Bootstrap rejection is documented
 in the following **accepted ADRs** within this repository:

```text
docs/adr/004-source-of-canonical-truth.md
  — RT-INV-04; Follow-up §ADR-006; Decision 1, 2, 7, 8;
    Evidence Chain (EAR-D2-013–015 cited therein); AC-31
docs/adr/005-narrative-information-model.md
  — v2.0 Editorial Scene ontology; Information Emergence Model; NIM-INV-*;
    Editorial Domain; ONE Rule
docs/adr/001-assisted-work-bootstrap-pipeline.md
  — Historical; Bootstrap rejection context (Superseded by ADR-004)
docs/adr/ADR-D2-001-canonical-metadata-authority.md
  — Tier authority model; external metadata evidence architecture
docs/adr/007-rollout-architecture.md
  — Rollout governance; governed projection; Architecture Closure
```

### Governance

```text
governance/Constitution.md                     Reader principles; capability roadmap
governance/FOUNDATION.md                       Runtime Supremacy Law; authority hierarchy
governance/ADR_RULES.md                        ADR lifecycle; ADR → SPEC → Implementation
governance/SPEC_RULES.md                       ADR/SPEC division of responsibility
governance/specs/AUTHORITY_BOUNDARY_AND_PRECEDENCE_SPEC.md
```

### Related ADRs

```text
ADR-004 — Source of Canonical Truth (parent; Enrichment authority)
ADR-005 v2.0 — Narrative Information Model (parent; Editorial Domain Story and Scene)
ADR-001 — Assisted Work Bootstrap Pipeline (Historical; Superseded)
ADR-D2-001 — Canonical Metadata Authority (Tier 1 / Tier 2 / Tier 3)
ADR-007 — Editorial → Runtime Rollout Architecture (Architecture Closure)
```

### Specs (implementation anchors; not ADR scope)

```text
docs/specs/spec-d2-002-enrichment-copilot.md   Enrichment boundary; Discovery excluded §2
docs/specs/spec-d2-003-source-connector-v1.md  Evidence architecture; infrastructure reuse
```
