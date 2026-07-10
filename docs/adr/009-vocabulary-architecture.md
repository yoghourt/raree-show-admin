# ADR-009 — Vocabulary Architecture

**Status:** Accepted  
**Type:** Architecture ADR  
**Version:** 1.1  
**Date:** 2026-07-10  
**Owner:** Architect  
**Related ADR:** ADR-004 (Source of Canonical Truth — Runtime Truth v1 topology);
ADR-005 (Narrative Information Model — Editorial Domain glossary);
ADR-006 (Discovery Copilot Architecture — Authority Emergence and workflow vocabulary);
ADR-007 (Editorial → Runtime Rollout Architecture — governed projection and cross-domain mapping);
ADR-008 (Runtime Vocabulary Convergence — Runtime vocabulary policy within Runtime scope)  
**Supersedes:** None  
**Amendment:** A1 (Architect review — consolidate vocabulary layers to five; classify
Implementation and Surface as Runtime Representation, not vocabulary layers; add
Semantic Contract sole-owner lifecycle rule; add mapping-follows-concept-ownership
principle in Decision 5)

---

## What

This ADR establishes the **Vocabulary Architecture** for Raree Show.

It answers one governance question:

> **How can multiple architectural vocabularies coexist without introducing semantic drift?**

This ADR defines:

* **Vocabulary scope** — the boundary between Domain vocabulary governance and
  Runtime vocabulary governance, including the clarified scope of ADR-008.
* **Layered Vocabulary Architecture** — five vocabulary layers supported by
  repository evidence, plus Runtime Representation (implementation and surface
  forms — not vocabulary layers).
* **Semantic Contracts** — the normative mechanism by which meaning is preserved
  across layers when surface terminology differs.
* **Mapping Authority** — who owns cross-layer vocabulary mappings, where they
  are defined, and how they evolve.
* **Vocabulary Governance Rules (VOC-GOV-*)** — implementation-independent rules
  for ownership, bounded-context independence, reuse, mapping, and precedence.

This ADR does **not** govern:

* Discovery workflow, Candidate lifecycle, or Human Review semantics (ADR-006 and
  downstream SPECs remain authoritative).
* Runtime Truth v1 topology, database schema, or routing (ADR-004).
* Editorial Story semantics, Information Emergence, or the ONE Rule (ADR-005).
* Governed projection behavior, Rollout phases, or Story ↔ Reading Route
  association rules (ADR-007 and SPEC-ROL-001).
* Runtime normative term selection, IP-01, Alias Acceptance Rule, or Vocabulary
  Debt classification within Runtime scope (ADR-008 and `runtime-lexicon.md`).
* Specific rename targets, migration sequences, localization strings, or
  implementation identifiers.
* Introduction of a Canonical Concept Registry, Knowledge Graph, or Product
  behavior specification.

---

## Why

### The Evidence Base

Two Executor Alignment Reviews (EARs) conducted in 2026-07-10 produced the
following validated findings:

**EAR — Domain Vocabulary Audit**

1. **Runtime Lexicon (RV-01 ~ RV-07) is suitable within Runtime scope** but
   **not sufficient as full-project Domain vocabulary**.
2. **Editorial and Runtime represent different bounded contexts** with legitimately
   different primary terms — notably **Story** (Editorial cognitive unit) and
   **Reading Route** (Runtime routable container).
3. **High cognitive cost** arises primarily from **concept collision and missing
   cross-layer contracts**, not from the absence of a single surface term alone.
4. Constitution capability roadmap language anchors on **Story Structure**, not
   Runtime routing vocabulary — evidence that mission-level language is not
   identical to Runtime vocabulary.

**EAR — Vocabulary Architecture Validation**

1. The repository **already operates a layered vocabulary model** in practice:
   Editorial glossary (ADR-005), Discovery/Production vocabulary (ADR-006),
   Rollout cross-domain vocabulary (ADR-007), Runtime Lexicon, and Implementation
   aliases — but this architecture is **implicit and unnamed**.
2. **Semantic drift** is introduced primarily by:
   * legitimately different concepts across bounded contexts;
   * incomplete or dispersed cross-layer mapping artifacts;
   * historical implementation symbols;
   * ambiguous authority at domain boundaries —
   not merely by synonym use.
3. **Semantic contracts already exist** in accepted governance: governed projection
   (ADR-007), Human Review outcome paths (ADR-006), field mapping tables
   (SPEC-ROL-001), Legacy Alias Reference (runtime-lexicon §3, ADR-008),
   `(implementation: X)` notation (runtime-lexicon DR-02), and invariant
   boundaries (DISC-INV-*, NIM-INV-*, ROL-INV-*).
4. A **single ubiquitous vocabulary across all architectural layers** conflicts
   with ADR-005 Decision 8 (Editorial Domain independence) and ADR-007
   Decision 2 (Story and Reading Route orthogonality) when interpreted as
   requiring identical terms for non-equivalent concepts.

### Why This Is Architecture, Not Naming

The Constitution states: *Cognitive Cost First.* Mandatory translation at every
boundary is cognitive cost. The prior response — ADR-008 — correctly reduced
translation cost **within Runtime scope**. The remaining cost is **architectural**:
participants must know **which vocabulary layer applies**, **which concept is
authoritative**, and **which contract governs a boundary crossing**.

Without a Vocabulary Architecture ADR:

* Discovery SPECs must either redefine vocabulary or inherit ambiguous scope from
  Runtime convergence policy.
* Cross-domain work re-litigates whether Story and Reading Route "should use the
  same word" instead of referencing an accepted mapping contract.
* New contributors and AI participants cannot determine whether terminology
  divergence is **intentional bounded-context separation** or **unresolved debt**.

This ADR closes the governance deferral opened by ADR-008 Non-Goals
("Address Editorial Domain vocabulary (ADR-005 governs that independently)") by
making the **multi-vocabulary architecture explicit and normative**.

---

## How

### Decision 1 — Semantic Identity Is the Primary Governance Unit

**Architectural meaning is authoritative. Surface terminology is context-dependent.**

A governance artifact MUST preserve **semantic identity** — the stable concept,
its bounded context, its authority owner, and its invariants — even when
different layers use different terms.

> **Vocabulary similarity SHALL NOT substitute for semantic mapping.**

Corollaries:

* Two terms MAY refer to the same concept only when an explicit semantic contract
  says so.
* Two identical terms MUST NOT be assumed to refer to the same concept across
  bounded contexts without contract evidence.
* SPECs and ADRs MUST NOT resolve cross-layer ambiguity by informal synonymy.

**Rationale.** ADR-007 establishes Story and Reading Route as **orthogonal**
constructs. ADR-005 defines Story as a **reader cognitive unit**, not a Runtime
routable record. Forcing terminological identity would obscure legitimately
different concepts and increase silent conflation risk.

---

### Decision 2 — Layered Vocabulary Architecture

**Raree Show adopts a Layered Vocabulary Architecture of five vocabulary layers.**

Each vocabulary layer has its own authoritative glossary for its responsibility.
Layers MAY reuse terms from other layers only when a semantic contract explicitly
authorizes the reuse or mapping.

**Layer count discipline.** Vocabulary layers are a learning aid, not a taxonomy
to maximize. This ADR defines **five** vocabulary layers only. Downstream SPECs
MUST NOT introduce additional normative vocabulary layers without Architecture
ADR amendment.

The following layers are **supported by repository evidence**. Layers without
governance evidence MUST NOT be introduced by downstream SPECs as normative
vocabulary authorities.

#### Layer 1 — Constitutional Vocabulary

| Field | Value |
| ----- | ----- |
| **Responsibility** | Stable mission principles and reader-understanding north star |
| **Audience** | All participants |
| **Authority** | `governance/Constitution.md` |
| **Representative terminology** | Cognitive Cost First, Reader Understanding First, Story Structure (capability roadmap stage), Core Experience |

Constitutional vocabulary expresses **intent and evidence criteria**. It is not
a substitute for bounded-context glossaries.

#### Layer 2 — Architecture Vocabulary

| Field | Value |
| ----- | ----- |
| **Responsibility** | Bounded contexts, authority boundaries, cross-domain relationships |
| **Audience** | Architects, ADR/SPEC authors, senior engineering |
| **Authority** | ADR-004, ADR-005, ADR-006, ADR-007; `governance/FOUNDATION.md` |
| **Representative terminology** | Editorial Domain, Runtime Domain, Production Domain, Authority Emergence, Information Emergence, Human Acceptance Gate |

#### Layer 3 — Editorial and Discovery Vocabulary

| Field | Value |
| ----- | ----- |
| **Responsibility** | Narrative cognition, Story semantics, Discovery proposal and review, Production workflow boundaries |
| **Audience** | Editorial workflow, Discovery/Enrichment implementers, operator workflow designers |
| **Authority** | ADR-005 Glossary and Canonical Definition; ADR-006 Glossary; SPEC-D3-*; SPEC-D2-* where applicable |
| **Representative terminology** | Story, Chapter, Narrative, Mental Model Transition, Approved Story unit, Knowledge Artifact, ONE Rule; Discovery, Candidate, Human Review, Entity, Enrichment, Production, Catalog Entity path, Story unit path |

Editorial and Discovery vocabulary MUST NOT be redefined by Runtime SPECs or
Runtime Lexicon entries.

#### Layer 4 — Rollout Vocabulary

| Field | Value |
| ----- | ----- |
| **Responsibility** | Editorial↔Runtime integration without identity merge |
| **Audience** | Rollout governance, projection operators, cross-domain SPEC authors |
| **Authority** | ADR-007 Glossary; SPEC-ROL-001 |
| **Representative terminology** | Rollout, Governed Projection, Orthogonal Coexistence, Runtime Projection, Story ↔ Reading Route association |

#### Layer 5 — Runtime Vocabulary

| Field | Value |
| ----- | ----- |
| **Responsibility** | Runtime Truth v1 topology, routable containers, reader progression units |
| **Audience** | Runtime services, Runtime CRUD, reader consumer repositories |
| **Authority** | `governance/vocabulary/runtime-lexicon.md` (RV-01 ~ RV-07); ADR-004 §Runtime Truth v1 Topology; ADR-008 within Runtime scope |
| **Representative terminology** | Work, Reading Route, Reading Frame, Frame Narrative, Route Synopsis, Reader Step, Chapter Metadata |

Runtime vocabulary MUST NOT redefine Editorial Story semantics.

#### Runtime Representation (not a vocabulary layer)

**Implementation symbols** (`scenes`, `story_images_v2`, `scene_` TSID) and
**surface forms** (locale strings, operator labels) are **Runtime Representation**
— how Runtime vocabulary is expressed in code and human-readable UI. They are
**not** separate vocabulary layers.

| Field | Value |
| ----- | ----- |
| **Responsibility** | Executable and human-readable expression of Runtime concepts |
| **Audience** | Engineering implementation; admin operators; reader-facing apps where authorized |
| **Authority** | runtime-lexicon §3 Legacy Alias Reference; ADR-008; authorized implementation SPECs (e.g. SPEC-VDC-001 §Frozen Symbols, §Chinese Localization Register) |
| **Representative forms** | `scenes`, `caption`, `summary`; locale keys (e.g. `domain.readingRoute`); registered Chinese equivalents |

Representation forms MUST carry Runtime meaning only through authorized semantic
contracts (Decision 3). They MUST NOT be treated as independent glossaries.

**Evidence note.** A standalone **Product Vocabulary** layer is **not**
established by repository evidence. Mission-level reader language remains
Constitutional until a future ADR authorizes a separate Product glossary.

---

### Decision 3 — Semantic Contracts

**Cross-layer communication MUST occur through explicit semantic contracts.**

A **Semantic Contract** is a governance artifact that preserves concept identity
across vocabulary layers. Semantic contracts are authoritative for **meaning
preservation**. They do not require identical terminology.

> **Every Semantic Contract SHALL have exactly one owning governance artifact.**

The owning artifact is either an **ADR** (for architectural, stable contracts)
or an **Authorized SPEC** derived from that ADR (for operational, testable
contracts). A contract MUST NOT have split ownership across multiple ADRs or
SPECs at the same authority level. Operational SPECs derive contract authority
from their parent ADR; they do not independently own architectural contracts.

The following contract **patterns** are already accepted in repository evidence
and constitute normative contract classes under this ADR:

| Contract class | Purpose | Authority examples |
| -------------- | ------- | ------------------ |
| **Notation contract** | Bind normative term to implementation symbol | runtime-lexicon DR-02 — owner: `runtime-lexicon.md` |
| **Alias classification contract** | Declare whether a legacy term preserves inferability | runtime-lexicon §3; ADR-008 — owner: ADR-008 |
| **Lifecycle outcome contract** | Define semantic state transition at authority boundary | ADR-006 Human Review outcome paths — owner: ADR-006 |
| **Projection contract** | Associate orthogonal constructs without identity merge | ADR-007 Governed Projection — owner: ADR-007 |
| **Field mapping contract** | Specify structured field-level meaning transfer | SPEC-ROL-001 §4.6 — owner: SPEC-ROL-001 (under ADR-007) |
| **Invariant boundary contract** | Forbid class of semantic drift | DISC-INV-*, NIM-INV-*, ROL-INV-* — owners: respective ADRs |
| **Localization contract** | Map normative concept to surface string with non-contradiction rule | SPEC-VDC-001 §Deliverable 12 — owner: SPEC-VDC-001 (under ADR-008) |

Rules:

* **VOC-SC-01** — A cross-layer relationship MUST be backed by at least one
  semantic contract class above. Informal synonymy is prohibited.
* **VOC-SC-02** — Semantic contracts MUST identify source concept, target
  concept, bounded context of each, and **sole owning governance artifact**.
* **VOC-SC-03** — Semantic contracts MUST NOT imply identity merge unless the
  owning ADR explicitly authorizes equivalence (none do for Story ↔ Reading Route).
* **VOC-SC-04** — Implementation field names (`caption`, `summary`) MAY serve
  as Documentation Aliases when satisfying ADR-008 IP-01 within their declaration
  context; they are not automatic cross-domain synonyms.
* **VOC-SC-05** — Every semantic contract MUST have exactly one owning
  governance artifact (ADR or Authorized SPEC derived from that ADR). Duplicate
  or competing ownership across peer artifacts is prohibited.

---

### Decision 4 — Vocabulary Scope and ADR-008 Boundary

**Runtime Vocabulary and Domain Vocabulary serve different responsibilities.**

| Vocabulary class | Scope | Authority | Governs |
| ---------------- | ----- | --------- | ------- |
| **Runtime Vocabulary** | Runtime bounded context | `runtime-lexicon.md`; ADR-008 | RV-01 ~ RV-07 terms, IP-01, Alias Acceptance, Vocabulary Debt within Runtime scope |
| **Domain Vocabulary** | Editorial, Discovery, and Rollout bounded contexts | ADR-005, ADR-006, ADR-007 respective glossaries | Story, Candidate, Entity, Governed Projection, etc. |
| **Runtime Representation** | Implementation and surface expression of Runtime concepts | runtime-lexicon §3; ADR-008; authorized implementation SPECs | `scenes`, locale keys, frozen symbols — **not** a vocabulary layer |

**ADR-008 governance boundary (clarified, not reopened):**

ADR-008 remains **Accepted and authoritative** for Runtime vocabulary
convergence **within Runtime scope**. ADR-009 clarifies that scope as follows:

1. ADR-008 applies to **Runtime Vocabulary (Layer 5)** and to **Runtime
   Representation** (implementation symbols and authorized surface forms carrying
   RV-01 ~ RV-07).
2. ADR-008 does **not** extend Editorial and Discovery glossary authority
   (ADR-005, ADR-006) or Rollout vocabulary (ADR-007).
3. ADR-008 Decision 6 (vertical language stack) applies to **Runtime normative
   identifiers and their authorized downstream surfaces** — not to Editorial
   concepts that are orthogonally defined in another bounded context.
4. Reducing translation cost for **Editorial ↔ Runtime** boundaries requires
   **semantic contracts** (Decision 3), not extension of Runtime ubiquitous
   language into Editorial definitions.

ADR-008 is **not** superseded. ADR-009 **specializes scope** so Discovery and
Editorial SPECs can reference terminology without redefining Runtime vocabulary
choices, and Runtime SPECs need not justify Editorial term selection.

---

### Decision 5 — Mapping Authority

**Cross-layer vocabulary mappings are first-class governance artifacts.**

> **Mapping ownership follows concept ownership, not implementation ownership.**

The ADR or glossary that owns the **source concept** in its bounded context owns
the cross-layer mapping contract for that concept pair. Implementation locations
(database tables, API routes, UI modules) do **not** determine mapping ownership.

**Example.** The Story ↔ Reading Route mapping is owned by **ADR-007** (Rollout;
Governed Projection) because Story is an Editorial concept and Reading Route is
a Runtime concept — the mapping is a **cross-domain projection contract**.
It is **not** owned by Runtime Lexicon, Discovery SPECs, or implementation
modules that happen to persist `scenes` rows.

#### Ownership

| Mapping type | Owner | MUST NOT be owned by |
| ------------ | ----- | -------------------- |
| Editorial ↔ Runtime projection semantics (e.g. Story ↔ Reading Route) | **ADR-007**; SPEC-ROL-001 | Runtime Lexicon; Discovery SPECs alone |
| Discovery outcome → Production/Rollout ingress | **ADR-006**; SPEC-D3-002; SPEC-ROL-001 | Runtime Lexicon |
| Runtime normative ↔ implementation alias (e.g. Reading Route ↔ `scenes`) | **`runtime-lexicon.md`**; ADR-008 | Editorial ADRs |
| Runtime normative ↔ localization surface | **SPEC-VDC-001** (under ADR-008) | Ad hoc UI strings |
| Editorial concept definitions (e.g. Story) | **ADR-005** | Runtime SPECs |

#### Definition location

Mappings MUST be defined in:

* the **owning ADR** when architectural and stable; or
* an **Authorized SPEC** derived from that ADR when operational and testable.

Mappings MUST NOT live only in implementation code, comments, or narrative README
text.

#### Introduction of new mappings

| Actor | Permitted action |
| ----- | ---------------- |
| **Architect ADR** | Introduce new cross-domain mapping **classes** and authority rules |
| **Authorized SPEC** | Introduce field-level or API-level mapping tables within ADR scope |
| **Implementation** | MAY implement authorized mappings; MUST NOT invent new cross-domain equivalences |
| **Narrative docs** | MUST NOT introduce normative mappings |

A new mapping that equates concepts from different bounded contexts (e.g. equating
Story with Reading Route) requires **Rollout ADR amendment** or a new Architecture
ADR — it cannot be introduced in a Discovery or Runtime implementation SPEC alone.

#### Evolution

* **Stable mappings** (architectural orthogonality, projection-only Story
  representation) change only through ADR amendment.
* **Operational mappings** (field tables, locale registers, alias classifications)
  change through SPEC revision within ADR scope.
* **Implementation symbols** frozen by authorized SPEC (e.g. SPEC-VDC-001
  Deliverable 13) require SPEC amendment — not silent drift.
* Mapping removal MUST include supersession rationale per FOUNDATION Audit
  Continuity Principle.

---

### Decision 6 — Vocabulary Governance Rules

The following rules are **normative** and **implementation-independent**.

**VOC-GOV-01 — Bounded-context vocabulary sovereignty**

Each bounded context MUST maintain its own authoritative glossary. No context
MAY redefine another context's glossary terms with conflicting semantics.

**VOC-GOV-02 — Reference, do not redefine**

Downstream ADRs and SPECs MUST reference upstream glossaries and MUST NOT
publish alternate definitions for governed terms (existing rule chain: ADR-006,
ADR-007, runtime-lexicon DR-01).

**VOC-GOV-03 — Contract-required boundary crossing**

Any artifact that crosses bounded contexts MUST cite or embed the applicable
semantic contract (Decision 3). Boundary crossing without contract is prohibited.

**VOC-GOV-04 — Terminology reuse without contract prohibition**

Reusing a term from another layer for convenience MUST NOT imply semantic
equivalence unless a semantic contract explicitly authorizes reuse or mapping.

**VOC-GOV-05 — Orthogonal concept protection**

Story (Editorial) and Reading Route (Runtime) MUST remain orthogonally governed.
Vocabulary convergence MUST NOT be used to merge their identities (ADR-007
Decision 2 preserved).

**VOC-GOV-06 — Runtime Lexicon exclusivity within Runtime scope**

RV-01 ~ RV-07 remain the sole normative Runtime vocabulary registry.
ADR-009 does not modify RV entries (Non-Goal).

**VOC-GOV-07 — Implementation alias containment**

Implementation aliases MUST be declared through alias classification contracts.
Unregistered ad-hoc aliases in normative documents are prohibited (ADR-008
Vocabulary Debt policy preserved).

**VOC-GOV-08 — Split authority precedence preserved**

When Editorial and Runtime descriptions diverge:

* **Runtime enforcement** prevails for production behavior (`FOUNDATION.md` §1).
* **Editorial authority** prevails for Story semantics and Discovery boundaries
  (ADR-005, ADR-006).
* **Rollout authority** prevails for governed projection semantics (ADR-007).

Vocabulary Architecture MUST NOT collapse this split into a single terminology
authority.

**VOC-GOV-09 — Glossary responsibility**

| Vocabulary layer | Glossary owner |
| ---------------- | -------------- |
| Constitutional | `governance/Constitution.md` |
| Architecture | ADR-004, ADR-005, ADR-006, ADR-007; `governance/FOUNDATION.md` |
| Editorial and Discovery | ADR-005; ADR-006 (+ downstream SPECs for operational terms) |
| Rollout | ADR-007 (+ SPEC-ROL-001 for operational mappings) |
| Runtime | `runtime-lexicon.md` |
| Runtime Representation | runtime-lexicon §3 + authorized implementation SPECs (not a vocabulary layer) |

**VOC-GOV-10 — Discovery SPEC vocabulary rule**

Discovery SPECs MUST reference ADR-005/006/007/008 glossaries and Runtime
Lexicon where applicable. Discovery SPECs MUST NOT redefine governed vocabulary
or justify Runtime term selection outside Runtime scope.

**VOC-GOV-11 — Mapping follows concept ownership**

Cross-layer mapping ownership MUST follow concept ownership in bounded contexts,
not implementation location. The owning ADR for the source concept's bounded
context (or the designated cross-domain ADR for projection pairs) owns the
mapping contract.

---

## Architecture Diagrams

### Layered Vocabulary Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ L1  Constitutional Vocabulary         (Constitution.md)    │
└────────────────────────────┬────────────────────────────────┘
                             │ informs
┌────────────────────────────▼────────────────────────────────┐
│ L2  Architecture Vocabulary            (ADR-004/005/006/007) │
└────────────┬───────────────────────────────┬────────────────┘
             │                               │
             ▼                               ▼
┌────────────────────────┐      ┌────────────────────────────┐
│ L3 Editorial /         │      │ L4 Rollout Vocabulary       │
│    Discovery Vocabulary│      │    (ADR-007)              │
│    (ADR-005, ADR-006)  │      └─────────────┬──────────────┘
└────────────┬───────────┘                    │
             │     Semantic Contracts (D3)    │
             └──────────────┬─────────────────┘
                            ▼
                 ┌──────────────────────┐
                 │ L5 Runtime Vocabulary │
                 │ (runtime-lexicon)    │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ Runtime Representation│  ← not a vocabulary layer
                 │ (implementation +     │
                 │  surface forms)       │
                 └──────────────────────┘
```

Five vocabulary layers. Runtime Representation is expression only.

### Semantic Contract Boundary (normative pattern)

```text
[Concept A @ Bounded Context X]     [Concept B @ Bounded Context Y]
         │                                    │
         │  ← VOC-GOV-03: contract required → │
         ▼                                    ▼
    ┌──────────────────────────────────────────────┐
    │ Semantic Contract                            │
    │  - contract class                            │
    │  - source / target identity                  │
    │  - sole owning governance artifact (VOC-SC-05) │
    │  - forbidden: identity merge (unless ADR)    │
    └──────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
  Layer-appropriate term A            Layer-appropriate term B
  (need not be identical)           (need not be identical)
```

### Vocabulary Scope vs ADR-008

```text
┌──────────────────────────────────────────────────────────────┐
│                     DOMAIN VOCABULARY SCOPE                   │
│  Editorial / Discovery (ADR-005, ADR-006)                   │
│  Rollout (ADR-007)                                          │
│                                                              │
│   Governed by: semantic identity + glossary sovereignty       │
└───────────────────────────────┬──────────────────────────────┘
                                │ Semantic Contracts only
┌───────────────────────────────▼──────────────────────────────┐
│                    RUNTIME VOCABULARY (L5)                    │
│  RV-01 ~ RV-07 │ ADR-008 IP-01 │ Alias / Debt policy         │
│                                                              │
│   Governed by: runtime-lexicon.md + ADR-008 (unchanged)      │
└───────────────────────────────┬──────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────┐
│              RUNTIME REPRESENTATION (not a vocabulary layer)  │
│  Implementation symbols │ locale registers │ frozen symbols   │
└──────────────────────────────────────────────────────────────┘
```

---

## Relationship with Existing ADRs

### ADR-005 — Narrative Information Model

ADR-005 remains authoritative for **Editorial vocabulary within Layer 3**
(Editorial and Discovery Vocabulary).

ADR-009 does not modify Story Canonical Definition, Information Emergence, or
NIM-INV-*. ADR-009 makes explicit that Editorial vocabulary is **sovereign**
and MUST be referenced — not absorbed — by Runtime and Discovery artifacts.

### ADR-006 — Discovery Copilot Architecture

ADR-006 remains authoritative for **Discovery vocabulary within Layer 3**
and Human Review outcome paths (lifecycle outcome contract class).

ADR-009 does not modify DISC-INV-*, Authority Emergence, or Candidate semantics.
Discovery SPECs gain a explicit rule (VOC-GOV-10) to reference glossaries without
redefining them.

### ADR-007 — Editorial → Runtime Rollout Architecture

ADR-007 remains authoritative for **Rollout Vocabulary (Layer 4)**
and for **Governed Projection** as the primary Editorial↔Runtime semantic contract.
Story ↔ Reading Route mapping ownership resides here (Decision 5).

ADR-009 does not modify ROL-INV-*, projection behavior, or Story ↔ Reading Route
orthogonality. ADR-009 elevates governed projection from Rollout mechanism to
**exemplar semantic contract pattern**.

### ADR-008 — Runtime Vocabulary Convergence

ADR-008 remains **Accepted** and authoritative for **Runtime Vocabulary scope**.

ADR-009 **clarifies** ADR-008 boundary (Decision 4). ADR-009 does **not**:

* modify RV-01 ~ RV-07;
* supersede IP-01, Alias Acceptance Rule, or Vocabulary Debt definitions;
* reopen SPEC-VDC-001 implementation authority;
* invalidate Runtime vertical consistency **within Runtime scope**.

ADR-008 and ADR-009 are **complementary**: ADR-008 governs Runtime term quality;
ADR-009 governs **multi-vocabulary coexistence** across bounded contexts.

---

## Decision Log

| ID | Decision | Rationale | Status |
| -- | -------- | --------- | ------ |
| D1 | Semantic identity is the primary governance unit | Prevents synonym-driven conflation across orthogonal contexts (ADR-007; EAR findings) | Accepted in this ADR |
| D2 | Five vocabulary layers + Runtime Representation | Reduce layer-count cognitive cost; Implementation/Surface are expression not vocabulary | Accepted in this ADR |
| D3 | Semantic contracts required at boundaries; sole owner per contract | Prevents contract drift across peer ADRs/SPECs | Accepted in this ADR |
| D4 | ADR-008 scope clarified to Runtime + Representation | Resolves ADR-008/005/007 tension without reopening ADR-008 | Accepted in this ADR |
| D5 | Mapping authority; mapping follows concept ownership | Closes authority loop; e.g. Story↔Reading Route owned by ADR-007 | Accepted in this ADR |
| D6 | VOC-GOV-* governance rules | Implementation-independent stability | Accepted in this ADR |

---

## Consequences

### Positive

* Discovery architecture refinement can proceed with **explicit vocabulary
  ownership** — SPECs reference glossaries instead of re-deriving terms.
* Runtime SPECs no longer carry burden of justifying Editorial vocabulary.
* Cross-domain integration documents **must** cite contracts — reducing silent
  Story ↔ Reading Route conflation.
* New engineers and AI participants can determine whether term differences are
  **architectural layering** or **unresolved debt**.
* ADR-008 Runtime convergence work retains authority within its correct scope.

### Negative / costs

* Governance authors must classify vocabulary layer and cite contracts — modest
  authoring overhead.
* Multiple glossaries remain — **by design**; cognitive cost shifts from hidden
  translation to explicit contract lookup.
* Existing documents that implied full-stack ubiquitous language from ADR-008
  Decision 6 require **interpretive alignment** to this ADR — not automatic
  retroactive rewrite.

### Neutral

* No implementation rename, migration, or registry introduction is required to
  adopt this ADR.
* No Accepted ADR is superseded.

---

## Validation

### Acceptance criteria (ADR-009 complete when all satisfied)

- [x] **VAC-01** — Discovery SPECs can reference terminology without redefining
  vocabulary (VOC-GOV-10).
- [x] **VAC-02** — Runtime SPECs can rely on runtime-lexicon.md without
  justifying Editorial term choices outside Runtime scope (Decision 4).
- [x] **VAC-03** — Cross-domain communication is normatively required to use
  semantic contracts, not identical terminology (Decision 3; VOC-GOV-03).
- [x] **VAC-04** — Vocabulary ownership is explicit per layer (Decision 2;
  VOC-GOV-09).
- [x] **VAC-05** — No Accepted ADR is reopened or superseded (Relationship
  section).
- [x] **VAC-06** — No implementation work is required for adoption (Consequences).

### Invariant checks established by this ADR

- **VOC-INV-01** — No normative document may equate Story with Reading Route
  without citing ADR-007 projection contract semantics (forbidden: identity merge).

- **VOC-INV-02** — No Discovery SPEC may redefine terms owned by ADR-005, ADR-006,
  ADR-007, or runtime-lexicon.md.

- **VOC-INV-03** — Any cross-layer mapping introduced after this ADR MUST
  declare contract class, source context, target context, sole owner, and
  satisfy mapping-follows-concept-ownership (Decision 5; VOC-GOV-11).

- **VOC-INV-05** — Every semantic contract MUST have exactly one owning
  governance artifact (VOC-SC-05).

- **VOC-INV-04** — ADR-008 IP-01 and Alias Acceptance Rule remain binding within
  Runtime scope; ADR-009 MUST NOT be interpreted as exempting Runtime identifiers
  from ADR-008.

### Governance review command

```bash
npm run check:governance
```

Manual checks:

- ADR metadata and Related ADR references ADR-004, 005, 006, 007, 008
- Non-Goals exclude Discovery redesign, Runtime topology, Concept Registry
- Relationship section preserves upstream ADR authority
- No RV registry modification

---

## Refs

### Constitutional

- `governance/Constitution.md` — Cognitive Cost First; Reader Understanding First; Story Structure roadmap
- `governance/FOUNDATION.md` — Runtime Supremacy Law; Governance Hierarchy; Audit Continuity

### Vocabulary authority

- `governance/vocabulary/runtime-lexicon.md` — RV-01 ~ RV-07; DR-01 ~ DR-06; Legacy Alias Reference
- `governance/ADR_RULES.md` — ADR lifecycle and authority boundaries
- `governance/templates/ADR_TEMPLATE.md` — ADR structure

### Related ADRs

- ADR-004 — Source of Canonical Truth (Runtime Truth v1 topology)
- ADR-005 — Narrative Information Model (Editorial glossary)
- ADR-006 — Discovery Copilot Architecture (workflow vocabulary; outcome paths)
- ADR-007 — Editorial → Runtime Rollout Architecture (governed projection)
- ADR-008 — Runtime Vocabulary Convergence (Runtime scope IP-01 and alias policy)

### Evidence inputs (EAR)

- EAR — Domain Vocabulary Audit (2026-07-10)
- EAR — Vocabulary Architecture Validation (2026-07-10)

### Operational contract examples (read-only)

- `docs/specs/spec-rol-001-governed-projection.md` — field mapping contract §4.6
- `docs/specs/spec-vdc-001-vocabulary-debt-closure.md` — localization and frozen symbol contracts
- `docs/specs/spec-d3-002-discovery-human-review.md` — Discovery accept handoff vocabulary boundaries

---

## Decision

Raree Show adopts a **Layered Vocabulary Architecture of five vocabulary layers**
in which **semantic identity is the primary governance unit**, **bounded contexts
maintain sovereign glossaries**, and **cross-layer meaning is preserved only
through explicit semantic contracts with exactly one owning governance artifact**.

Runtime Vocabulary (ADR-008; `runtime-lexicon.md`) remains authoritative
**within Runtime scope (Layer 5)**. Domain vocabularies (Editorial/Discovery,
Rollout) remain authoritative **within their respective scopes**. Implementation
and surface forms are **Runtime Representation**, not vocabulary layers.

**Mapping ownership follows concept ownership, not implementation ownership.**

**Vocabulary similarity shall never replace semantic mapping.**

---

## Alternatives Considered

### A — Full-stack ubiquitous language (ADR-008 Decision 6 maximal interpretation)

Require identical normative terms from Constitutional language through
Implementation for all concepts, including Editorial Story and Runtime Reading
Route.

**Rejected.** Conflicts with ADR-005 Decision 8 (Editorial independence), ADR-007
Decision 2 (Story ⊥ Reading Route), and EAR evidence that orthogonality is
architectural — not debt. Would increase silent conflation risk at boundaries.

ADR-008 is retained for Runtime scope; this alternative is rejected only as a
**cross-domain** policy.

### B — Implicit layered vocabulary (status quo)

Continue without a Vocabulary Architecture ADR; rely on dispersed glossary
sections and author discipline.

**Rejected.** EAR evidence shows implicit layers already drift (SPEC/code
`scene` vs `readingRoute`; five parallel vocabularies per ADR-008 audit).
Implicit architecture does not reduce long-term vocabulary discussion.

### C — Canonical Concept Registry (central ID indirection)

Introduce a registry assigning concept IDs with per-layer vocabulary columns.

**Rejected for this ADR** (Explicit Non-Goal). Evidence supports architectural
**benefit**, but introduction is deferred — registry design is out of scope and
would duplicate existing ADR-owned glossaries without a separate authorization
decision.

### D — Eliminate Runtime Lexicon; use Editorial vocabulary everywhere

Make Story and Editorial terms the only normative language; treat Reading Route
as deprecated architecture language.

**Rejected.** Violates Runtime Supremacy and ADR-004 Runtime Truth v1 topology.
Runtime routing semantics require Runtime vocabulary. Non-Goal: no Runtime
vocabulary modification.

---

## Trade-offs

| Trade-off | Cost | Benefit |
| --------- | ---- | ------- |
| Five vocabulary layers (not eight) | Less taxonomy to memorize | Layer model itself stays learnable; Representation subordinated to Runtime |
| Mandatory semantic contracts with sole owner | Authors must cite owning ADR/SPEC | Prevents contract drift across peer artifacts |
| Mapping follows concept ownership | Authors must identify concept owner first | Prevents implementation modules claiming cross-domain mappings |
| ADR-008 scope clarification | Readers must reconcile Decision 6 text with Decision 4 here | Removes Discovery/Runtime vocabulary jurisdiction disputes |
| No Concept Registry in this ADR | Continued dispersed contract locations | Avoids premature abstraction; respects Non-Goal |
| Governance stability over naming perfection | Some legacy symbols remain per ADR-008 | Meets ADR success criterion: fewer future vocabulary debates |

---

## Non-Goals

This ADR does **not**:

* redesign Discovery workflow, Candidate lifecycle, or Human Review (ADR-006).
* redesign Runtime Truth v1 topology (ADR-004).
* rename Story, Reading Route, or any RV-01 ~ RV-07 term.
* redesign Rollout, Governed Projection, or Story ↔ Reading Route association
  semantics (ADR-007).
* introduce a Knowledge Graph.
* introduce a Canonical Concept Registry.
* modify `governance/vocabulary/runtime-lexicon.md` entries.
* authorize implementation renames, migrations, or localization changes.
* define Product behavior or reader UX specification.
* supersede ADR-008 or any other Accepted ADR.

---

## Legacy Alias Reference

*This ADR does not introduce or modify Runtime vocabulary entries.*

For Runtime normative terms and legacy aliases, see
`governance/vocabulary/runtime-lexicon.md` §3 (authoritative).

ADR-009 adds **no** new Implementation Aliases or Documentation Aliases.
