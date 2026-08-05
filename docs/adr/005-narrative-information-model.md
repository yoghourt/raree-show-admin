# ADR-005 — Narrative Information Model

**Status:** Accepted
**Type:** Architecture ADR
**Version:** 2.0
**Last Updated:** 2026-07-11
**Owner:** Architect
**Related ADR:** ADR-004 (Source of Canonical Truth — Human Acceptance Gate and Copilot authority); ADR-006 (Discovery Copilot Architecture — Authority Emergence and Human Review outcome paths); ADR-007 (Editorial → Runtime Rollout Architecture — Architecture Closure); ADR-009 (Vocabulary Architecture — Layer 3 Editorial vocabulary); ADR-012 (Scene Context Runtime Boundary — association without identity merge)
**Amendment:** A4 (Editorial Narrative Topology Completion — introduces canonical **Scene** as the editorial progression unit within Story; extends Information Emergence, Decision 7, and invariants; clarifies Alternative B rejection scope; **no** Runtime topology, Rollout projection, or Layer 5 vocabulary changes). A5 (ADR-012 alignment — Editorial Scene may **associate** with Scene Context without identity merge; Editorial Scene does **not** become a Runtime entity; Scene Context does **not** replace Editorial Scene; Decision 10 preserved). Prior amendments A1–A3 preserved in substance.

---

## What

This ADR establishes the **Narrative Information Model** for the Raree Show
 **Editorial Domain**.

It defines:

* The foundational principle that **narrative is the source of truth** for editorial
  knowledge.
* The **Canonical Definition of Story** — the system-wide reference definition.
* The **Canonical Definition of Scene** — the editorial progression unit within
  Story.
* The **Glossary** of core narrative terms for downstream ADRs.
* The distinction between **Story**, **Scene**, **Story Arc**, and **Chapter**.
* **Story boundary principles** governed by Narrative Closure and the ONE Rule.
* The **Information Emergence Model** — the required dependency order in which
  editorial artifacts may be derived.
* **Editorial Architectural Invariants** binding the Editorial Domain.
* The **multi-pass** editorial philosophy within the Editorial Domain.
* The independence of the **Editorial Domain** from the **Runtime Domain**.

This ADR explicitly does **not** govern:

* Runtime schema, database design, API contracts, or UI
* Migration strategy or rollout sequencing
* AI implementation or Copilot routing (ADR-004 remains authoritative)
* Discovery Copilot architecture (ADR-006)
* Editorial↔Runtime cross-domain mapping (ADR-007)
* Layer 5 Runtime vocabulary (`Reading Route`, `Reading Frame`, `Reader Step`)

---

## Why

Raree Show exists to reduce the cognitive cost of understanding complex stories
while preserving the author's narrative experience (`Constitution.md` — *Reader
Understanding First*, *Preserve the Author's Narrative Experience*).

Four structural problems block a narrative-first model in the Editorial Domain:

**Problem 1 — Chapter mistaken for Story.**

Author-defined chapters are publishing and reading-pause boundaries. They do not
 reliably coincide with the smallest unit at which a reader stabilizes one mental
 model. Treating Chapter as Story produces incorrect cognitive granularity for
 fragmented reading.

**Problem 2 — Runtime routing conflated with editorial cognition.**

Current Runtime Truth v1 routes reading through Reading Route records
 (implementation: Scene). A Reading Route is the routable reading container in
 the **Runtime Domain** — not, by itself, a definition of editorial narrative
 completeness or editorial progression. Editorial decisions require a model
 grounded in reader cognition within the **Editorial Domain**, not storage
 convenience.

**Problem 3 — Knowledge defined before narrative.**

When Characters, Locations, Relationships, or graph structures are treated as
 primary inputs to narrative segmentation, knowledge defines boundaries instead
 of emerging from approved narrative units. This inverts the required dependency
 order and produces inconsistent editorial truth.

**Problem 4 — Progression semantics compressed between Story and Runtime Frame.**

When the Editorial Domain defines only **Story** as a narrative object, **reader
 progression semantics** (the step-by-step advance through narrative beats within
 a Story) have no canonical Editorial owner. Implementations and vocabulary then
 attribute progression to **Runtime Reading Frame** — a Layer 5 persistence unit —
 which creates **semantic compression** across domain boundaries. Progression
 authority belongs in the Editorial Domain; Runtime Frame remains representation
 only.

This ADR resolves these problems within the **Editorial Domain** without altering
 current Runtime Domain enforcement. Runtime Truth v1 remains authoritative.
 Cross-domain mapping is governed by **ADR-007** (`FOUNDATION.md` §1 — Runtime
 Supremacy Law).

This ADR supports the Constitution capability roadmap stage **Story Structure**
 (Appendix A): the reader can naturally explain the main storyline from beginning
 to end.

---

## Foundational Principle

> **Narrative is the source of truth. All other editorial knowledge emerges from
> approved narrative units.**

Corollaries:

* Knowledge artifacts in the Editorial Domain are **derived**, not boundary-defining.
* A narrative unit gains authority only through **human acceptance** (ADR-004
  Decision 2).
* Runtime Domain representation may lag Editorial Domain truth; Editorial Domain
  truth may not be overridden by Runtime Domain convenience.
* **Reader progression semantics** are authoritative in the Editorial Domain at
  **Scene** granularity — not at Runtime **Reading Frame** granularity.

---

## Glossary

The following terms are **canonical for the Raree Show governance system**.
 Downstream ADRs and SPECs MUST use these definitions and MUST NOT redefine them
 with conflicting semantics.

Terms **Reading Route**, **Reading Frame**, **Frame Narrative**, and **Reader Step**
 are defined in Layer 5 Runtime vocabulary (`governance/vocabulary/runtime-lexicon.md`).
 This ADR references those definitions for domain-boundary context only and MUST NOT
 redefine them.

**Story**

The primary editorial narrative unit. See **Canonical Definition — Story**
 (authoritative wording).

**Scene**

The editorial progression unit within Story. See **Canonical Definition — Scene**
 (authoritative wording).

An **Editorial Scene** is **not** a **Story**, **not** a **Reading Route**
 (Runtime Domain), and **not** a **Reading Frame** (Runtime Domain). The
 implementation alias `Scene` for Reading Route MUST NOT be treated as the
 Editorial Scene defined by this ADR (ADR-009 Layer 3 vs Layer 5 separation).

**Approved Story unit**

A human-accepted Story satisfying the Canonical Definition and NIM-INV-05.
 An Approved Story unit is an Editorial Domain artifact — not a Production
 Entity (ADR-006 Human Review outcome paths).

**Approved Scene unit**

A human-accepted Scene within an Approved Story unit, satisfying the Scene
 Canonical Definition and NIM-INV-05. An Approved Scene unit is an Editorial
 Domain artifact — not a Production Entity and not a Runtime Reading Frame.

**Story Arc**

A higher-order narrative construct spanning **multiple Stories**. A Story Arc
 organizes phase-level progression (e.g., a campaign, a relationship arc over
 many beats). A Story Arc is **not** a Story.

**Chapter**

An **author-defined** structural and publishing boundary in the source work.
 Chapter metadata may describe where editorial content occurs; it does not define
 Story boundaries in the Editorial Domain.

**Mental Model Transition**

A durable update to what the reader understands, believes, or feels is true about
 the narrative after completing a narrative unit — such that they can answer,
 without ambiguity: *what this part was about, and how that particular matter
 turned out.*

**Narrative Progression Step**

The reader's advance through **Scenes** within a Story — one editorial beat at a
 time. Narrative Progression Step is an **Editorial Domain** concept carried by
 **Scene** units. It MUST NOT be redefined as a Runtime **Reading Frame** identity
 (NIM-INV-06).

**Narrative Closure**

The combined satisfaction of closure signals (operative, epistemic, relational,
 affective, world-state, or decisional) that allows a reader to perceive a narrative
 unit as complete. No single structural marker is sufficient alone. Narrative
 Closure governs **Story** boundaries — not individual **Scene** boundaries within
 an approved Story.

**Knowledge Artifact**

Any editorial derivative extracted from approved Stories — including Character
 references, Location references, Relationship updates, Timeline assertions, and
 Knowledge Graph nodes or edges. Knowledge artifacts MUST NOT define Story
 boundaries. Knowledge artifacts MAY reference Scenes within approved Stories
 as provenance but MUST NOT define Scene or Story boundaries.

**Editorial Domain**

The governance and production layer where narrative units, boundaries, summaries,
 Scenes, and derived knowledge are defined and human-accepted. This ADR governs the
 Editorial Domain. It is independent of runtime schema and routing.

**Runtime Domain**

The production-enforced layer where reading topology, persistence, and routing
 are implemented. Current Runtime Truth v1 (`Work → Reading Route → Reading Frame`,
 implementation: `Work → Scene → Story Images`) belongs to the Runtime Domain.
 See `governance/vocabulary/runtime-lexicon.md` for normative Runtime vocabulary.

**The ONE Rule**

The mandatory Editorial Domain gate for **Story** boundary approval: primary
 dramatic question → stable outcome → reader can stabilize one mental model.
 See Decision 5. The ONE Rule does **not** apply to individual Scene boundaries
 within an approved Story.

---

## Canonical Definition

### Canonical Definition — Story

The following is the **canonical Story definition** for the Raree Show governance
 system. All downstream ADRs and SPECs MUST reference this section when defining
 or constraining Story. They MUST NOT publish alternate Story definitions with
 conflicting semantics.

> A **Story** is the smallest narrative unit that produces one stable **Mental
> Model Transition** for the reader.

Supporting term definitions appear in **Glossary**.

### Canonical Definition — Scene

The following is the **canonical Scene definition** for the Raree Show governance
 system (Editorial Domain). All downstream ADRs and SPECs MUST reference this
 section when defining or constraining **Editorial Scene**. They MUST NOT publish
 alternate Scene definitions with conflicting semantics.

> A **Scene** is the smallest editorial narrative unit that expresses one
> **Narrative Progression Step** within an approved **Story** — one narrative
> beat at which the reader advances through story content (narrative prose and
> associated visual intent) without completing the Story's Mental Model Transition.

Supporting clarifications:

* A Story **contains** one or more Scenes in author narrative order (NIM-INV-01).
* A Scene **does not** produce a standalone Mental Model Transition sufficient to
  satisfy the Story Canonical Definition.
* A Scene **does not** inherit Story boundary authority; Story boundaries remain
  governed by Narrative Closure and the ONE Rule.
* Scene semantics are **Editorial Domain** authority. **Reading Frame** is Runtime
  Domain representation only (Decision 10).

---

## Decision

### Decision 1 — Story Is the Primary Editorial Narrative Unit

**Story is the primary unit of narrative production in the Editorial Domain.**

Story is a **reader cognitive unit** — the unit at which an operator (or reader)
 can stabilize understanding of "what this part is about and how it turned out."

Story is **not** defined as a database entity, Runtime Domain routable record,
 or author structural container in this ADR. The authoritative wording is the
 **Canonical Definition — Story**.

---

### Decision 2 — Story Is Independent from Chapter

**Chapter and Story are not equivalent.**

| Construct | Domain | Role |
| --------- | ------ | ---- |
| **Chapter** | Author structure | Author-defined structural and publishing boundary |
| **Story** | Editorial Domain | Cognitive unit defined by Mental Model Transition |

Chapter metadata may **describe** where a Story occurs in the original work. Chapter
 metadata must not **define** Story boundaries.

---

### Decision 3 — Story Is the Minimum Mental Model Transition

**Story is the smallest narrative unit that produces one stable Mental Model
Transition for the reader.**

This decision adopts the **Canonical Definition — Story** without modification.

Story is the **minimum** unit satisfying that definition. Larger constructs
 (Story Arc, Work, series) span multiple Stories.

**Scene is the minimum Narrative Progression Step within Story.** Scene is **not**
 the minimum Mental Model Transition unit. One Story contains one or more Scenes.

---

### Decision 4 — Story Boundaries Follow Narrative Closure

**Story boundaries are determined by Narrative Closure, not by structural chapter
 boundaries.**

Narrative Closure is satisfied by a **combination of closure signals** (see
 Glossary). No single structural marker (chapter end, word count, POV change) is
 sufficient alone.

Story segmentation MUST NOT occur:

* Before the primary dramatic question of the unit has a stable outcome.
* Before the payoff of that unit has landed for the reader.
* Solely because an author chapter boundary has been reached.

Scene boundaries within an approved Story MUST NOT substitute for Story boundary
 adjudication.

---

### Decision 5 — The ONE Rule (Story Boundary Gate)

**The ONE Rule is the mandatory Editorial Domain gate before a Story boundary is approved.**

A Story boundary is approved only when all three conditions hold:

```text
Primary dramatic question
        ↓
Stable outcome (resolved, failed, or irreversibly transformed)
        ↓
Reader can stabilize one mental model
```

Operational self-test for operators:

> If the reader stopped here, could they state how **this particular matter**
> turned out — not merely what is still in progress?

If the answer is no, the boundary MUST NOT be approved.

The ONE Rule applies to **Story** boundaries only. It does **not** gate individual
 **Scene** boundaries within an approved Story.

---

### Decision 6 — Narrative Precedes Knowledge

**Narrative precedes Knowledge.**

All **Knowledge Artifacts** MUST be derived from **approved Stories** in the
 dependency order defined by the Information Emergence Model (below).

Knowledge Artifacts MUST NOT be used to **define** Story boundaries or Scene
 boundaries.

---

### Decision 7 — The Editorial Domain Is Multi-Pass

**Narrative work in the Editorial Domain is multi-pass, not single-pass.**

A valid editorial sequence includes, at minimum:

1. Scope and catalog preparation (Work brief; Character/Location scope acceptance)
2. Reading and Story boundary identification (ONE Rule gate)
3. Story unit completion (summary, cast/place, Mental Model Transition)
4. **Scene identification and completion within approved Story units** (narrative
   beat and visual intent per Scene)
5. Knowledge extraction from approved Story units
6. Work-level consistency review before publication approval

This sequence describes a **typical workflow** within the Editorial Domain. It
 does not override the **dependency order** defined by the Information Emergence
 Model (see below).

Single-pass generation of narrative units and derived knowledge in one undifferentiated
 step is rejected for editorial truth production.

---

### Decision 8 — Editorial Domain Is Independent of Runtime Domain

**The Editorial Domain is independent of the Runtime Domain.**

The Editorial narrative model defined by this ADR is **orthogonal** to current
 Runtime Truth v1 in the Runtime Domain.

**Editorial Domain topology (this ADR):**

```text
Story                         (primary cognitive unit)
 └─ Scene                     (progression unit within Story)
```

**Runtime Domain topology (ADR-004; unchanged):**

```text
Work
 └─ Reading Route              (routable reading container)
      └─ Reading Frame         (ordered narrative-visual units; JSONB)
```

*Implementation symbols: Reading Route → `scenes`; Reading Frame → `story_images_v2[]` element.*

This ADR does not modify, endorse, or implement any mapping between Editorial
 Scenes and Runtime Reading Routes or Reading Frames.

Cross-domain mapping is governed by **ADR-007** (Accepted). Governed projection
 implementation is deferred to downstream SPEC. Until implemented, Runtime Domain
 supremacy applies unchanged (`FOUNDATION.md` §1).

---

### Decision 9 — Scene Is the Editorial Progression Unit Within Story

**Scene is the canonical Editorial narrative object for reader progression within Story.**

Scene carries **Narrative Progression Step** semantics in the Editorial Domain.

Scene is:

* **Compositional** — Scenes exist **within** approved Stories in narrative order.
* **Subordinate to Story cognition** — Scenes do not satisfy the Story Canonical
  Definition alone.
* **Editorial authority** — Scene boundaries and content are Editorial Domain
  decisions subject to human acceptance (NIM-INV-05).

Scene is **not**:

* A **Story** (Alternative B rejection preserved — see Alternatives Considered).
* A **Reading Route** or **Reading Frame** (Runtime Domain constructs).
* A substitute for the ONE Rule at Story granularity.

---

### Decision 10 — Editorial Scene Is Orthogonal to Runtime Reading Route and Reading Frame

**Editorial Scene and Runtime Reading Route / Reading Frame are orthogonal constructs in different domains.**

| Construct | Domain | Role |
| --------- | ------ | ---- |
| **Scene** (Editorial Scene) | Editorial Domain | Progression unit within Story (Canonical Definition — Scene) |
| **Reading Route** (implementation: Scene) | Runtime Domain | Routable reading container / Story delivery projection (ADR-004; ownership reduced by ADR-012) |
| **Reading Frame** | Runtime Domain | Ordered narrative-visual unit — visual projection representation (ADR-004); **not** narrative ownership (ADR-012) |
| **Scene Context** | Runtime Domain | Runtime ownership boundary for narrative moments (ADR-012) — **not** Editorial Scene by identity |

Editorial Scene and Runtime Reading Frame MUST NOT be treated as equivalent,
 interchangeable, or merged by identity.

**Preserved:**

```text
Editorial Scene ≠ Runtime Scene
Editorial Scene ≠ Reading Frame
Editorial Scene ≠ Reading Route
Editorial Scene ≠ Scene Context   (by identity)
```

**Reader progression semantics** are authoritative at **Editorial Scene** granularity.
 **Reading Frame** carries Runtime representation only. Progression authority MUST
 NOT be assigned to Reading Frame in governance artifacts (NIM-INV-06).

**Association (ADR-012 / Amendment A5):** Editorial Scene may **associate** with
 **Scene Context** without identity merge. Scene Context **projects** to Reading Frame.
 Editorial Scene does **NOT** become a Runtime entity. Scene Context does **NOT**
 replace Editorial Scene.

Cross-domain association between Editorial Scenes and Runtime representation is
 governed by **ADR-007** as closed by **ADR-012** (association → Scene Context →
 projection → Reading Frame). This ADR does not authorize identity merge.

---

## Information Emergence Model

Editorial information MUST emerge in the following **dependency order**.
 Implementations MUST preserve this order and MUST NOT reverse it.

```text
Narrative
        ↓
Mental Transition
        ↓
Story Boundary
        ↓
Story Summary
        ↓
Scene Sequence (within Story)
        ↓
Scene Completion
        ↓
Knowledge Extraction
        ↓
Relationship Updates
        ↓
Knowledge Graph
```

This model describes **dependency order** — which artifact classes may depend on
 which others. It is **not** a strict step-by-step **workflow execution order**.
 Editorial workflow steps (Decision 7) MAY interleave or iterate as long as no
 step treats a downstream artifact as authoritative before its upstream dependencies
 are human-accepted.

Governing rule:

> Information must emerge in this order.

---

## Editorial Architectural Invariants

The following invariants are **Editorial Domain constraints**. They are not
 Runtime Domain-enforced constraints and MUST NOT be classified as constitutional
 invariants or Runtime-Enforced status (`ADR_RULES.md` §7).

**NIM-INV-01 — Author narrative order**

Story units MUST preserve author narrative order within a Work. Scenes MUST
 preserve author narrative order within their parent Story.

**NIM-INV-02 — Knowledge does not define boundaries**

Knowledge Artifacts MUST NOT define Story boundaries or Scene boundaries.

**NIM-INV-03 — Reader cognition over storage convenience**

Reader cognitive completeness takes precedence over storage or routing convenience
 in the Runtime Domain when approving Story boundaries in the Editorial Domain.

**NIM-INV-04 — Editorial Domain truth precedes Runtime Domain**

Editorially approved Story and Scene truth in the Editorial Domain precedes Runtime
 Domain representation. The Runtime Domain MUST NOT silently redefine editorial
 boundaries.

**NIM-INV-05 — Human acceptance is final**

No Story unit, no Scene unit, and no derived Knowledge Artifact gains standing
 without explicit human acceptance (ADR-004 Decision 2).

**NIM-INV-06 — Progression authority is Editorial**

Narrative Progression Step semantics MUST be governed at **Editorial Scene**
 granularity. Runtime **Reading Frame** MUST NOT be treated as the authoritative
 definition of editorial progression in governance artifacts. Reading Frame remains
 Runtime Domain representation only.

**NIM-INV-07 — Scene does not define Story boundaries**

Scenes MUST NOT define, replace, or substitute for Story boundary adjudication.
 The ONE Rule and Narrative Closure remain Story-level gates only.

---

## Relationship to ADR-004

This ADR specializes the Raree Show information model for the **Editorial Domain**.
 It does not supersede ADR-004.

ADR-004 remains authoritative for:

* Human-Owned Canonical Truth (Decision 1)
* Human Acceptance Gate (Decision 2)
* Runtime Truth v1 topology (`Work → Reading Route → Reading Frame`)
* Copilot routing, field classification, and suggestion pipelines
* RT-INV-04 Enrichment boundary (Discovery architecturally owned by ADR-006 Accepted)

This ADR MUST NOT weaken any ADR-004 decision or invariant. Runtime Truth v1
 topology is **unchanged** by Amendment A4.

---

## Relationship to ADR-006

ADR-006 (Accepted) governs Discovery and the **Authority Emergence Model**.
 This ADR governs **Story and Scene semantics** and **Information Emergence** in
 the Editorial Domain.

When **Story Discovery** produces Story Candidates, Human Review acceptance
 yields an **Approved Story unit** — an editorial artifact governed by this ADR
 (NIM-INV-05, Canonical Definition — Story). An Approved Story unit is **not** a
 Production **Entity** as defined in ADR-006.

When Discovery produces **scene-level editorial Candidates** (ADR-006 Scene
 Candidate Generation), Human Review acceptance yields editorial artifacts governed
 by the **Scene** semantics of this ADR — **not** Production Entities and **not**
 Runtime Reading Route or Reading Frame records without governed projection per
 ADR-007.

Catalog objects (Character, Location) follow the Catalog Entity path in ADR-006
 after Human Review.

This ADR MUST NOT weaken ADR-006 Discovery boundaries or ADR-004 Human Acceptance.

---

## Relationship to ADR-007

ADR-007 (Accepted) governs **Editorial → Runtime Rollout** and **Architecture
 Closure** for Runtime Truth v1. This ADR governs **Story and Scene semantics**
 and **Information Emergence** in the Editorial Domain.

Cross-domain mapping deferral from prior versions of this ADR is **closed** by
 ADR-007 for **Approved Story unit ↔ Reading Route** association. **Approved
 Story unit ↔ Reading Route** governed projection remains authoritative in ADR-007
 and is **unchanged** by Amendment A4.

**Editorial Scene ↔ Runtime Reading Route / Reading Frame** cross-domain mapping
 is **closed architecturally by ADR-012** as:

```text
Editorial Scene → associates → Scene Context → projects → Reading Frame
```

Association ≠ identity. Projection ≠ identity. This ADR does not modify ADR-007
 Rollout Model except by recognizing ADR-012’s closure of the Scene mapping deferral.

This ADR MUST NOT weaken ADR-007 rollout boundaries or ADR-004 Human Acceptance.

---

## Relationship to ADR-009

ADR-009 (Accepted) governs **Vocabulary Architecture**. **Scene** (Editorial) is
 Layer 3 Editorial vocabulary owned by this ADR. **Reading Route**, **Reading Frame**,
 and **Reader Step** remain Layer 5 Runtime vocabulary. ADR-009 VOC-GOV-01 and
 VOC-GOV-04 prohibit treating Editorial Scene and Runtime Reading Route as equivalent
 without an explicit semantic contract. ADR-007 owns Story ↔ Reading Route projection
 contracts; Editorial Scene ↔ Runtime representation contracts are **closed by
 ADR-012** (Editorial Scene associates → Scene Context projects → Reading Frame)
 without identity merge.

This ADR MUST NOT modify Layer 5 Runtime vocabulary or RV entries.

---

## Relationship to Runtime Truth v1

Current Runtime Truth v1 topology in the **Runtime Domain** is unchanged by this
 ADR.

This ADR governs the **Editorial Domain** cognitive and progression model.
 Runtime Truth v1 governs the **Runtime Domain** enforced reading topology. The two
 domains coexist; Editorial↔Runtime association is governed by **ADR-007**;
 projection implementation is deferred to downstream SPEC.

When Editorial Domain and Runtime Domain descriptions diverge, **Runtime Domain
 enforcement prevails** for production behavior; **this ADR prevails** for Editorial
 Domain authority (`FOUNDATION.md` §1).

---

## Deferred Decisions

The following are explicitly deferred. They MUST NOT be inferred from this ADR.

| Deferred item | Expected governance home |
| ------------- | ------------------------ |
| Editorial Scene ↔ Runtime Reading Route / Reading Frame governed mapping | **Closed by ADR-012** (association → Scene Context → projection → Reading Frame; no identity merge). Downstream SPEC may operationalize; MUST NOT reopen identity merge. |
| Relationship delta persistence model | SPEC (post-v1 capability) |
| Story Arc visibility in the Runtime Domain | SPEC or post-v1 capability |
| Knowledge Graph integration | post-v1 capability (Constitution roadmap) |

Implementation of any deferred item MUST follow **ADR → SPEC → Implementation**
 (`ADR_RULES.md` §13, `SPEC_RULES.md` §4).

ADR-006 (Discovery Copilot Architecture) governs **Discovery** capabilities only.
 Cross-domain mapping is governed by **ADR-007** (Accepted).

---

## Out of Scope

This ADR explicitly excludes:

* Schema and database design
* API and UI design
* Migration strategy
* AI implementation details
* Copilot routing changes
* Discovery workflows (ADR-006)
* Runtime Domain reading flow redesign
* Rollout projection implementation (ADR-007)
* Layer 5 Runtime vocabulary changes (ADR-008 / ADR-009)

---

## Alternatives Considered

**Alternative A — Chapter as Story.**

Rejected. Literary and cognitive evidence demonstrates that author chapters are
 pause boundaries, not reliable cognitive-completion boundaries. POV chapters and
 multi-arc chapters violate one-chapter-one-story assumptions.

**Alternative B — Scene equated to editorial Story.**

Rejected. **Equating** Runtime-oriented or route-level **Scene** with the **Story**
 Canonical Definition conflates Runtime Domain routing with Editorial Domain
 cognitive completeness. A routable container may contain multiple Stories or span
 part of one Story. This rejection does **not** prohibit **Scene as a progression
 unit within Story** (Decision 9 — adopted).

**Alternative C — Topology-first normalization before Story definition.**

Rejected. Defining Runtime Domain topology before Story semantics inverts the
 Information Emergence Model and binds editorial judgment to storage structure.

**Alternative D — Single-pass AI bootstrap as Story producer.**

Rejected. Superseded by ADR-004. Conflicts with Human Acceptance Gate and Narrative
 Precedes Knowledge.

**Alternative E — Reading Frame as direct semantic child of Story.**

Rejected. Reading Frame is a Runtime Domain persistence unit inside Reading Route
 (ADR-004). Making Frame the direct editorial child of Story compresses progression
 semantics into Runtime representation and violates Editorial / Runtime orthogonality
 (Decision 10, NIM-INV-06).

**Alternative F — Story-only Editorial topology without Scene.**

Rejected. Leaves Narrative Progression Step semantics without an Editorial owner,
 forcing progression authority onto Runtime Reading Frame and reproducing the
 semantic compression described in Problem 4.

---

## Trade-offs

**Positive**

* Complete Editorial narrative topology: Story (cognitive) + Scene (progression)
* Removes progression semantic compression onto Runtime Reading Frame
* Preserves Story Canonical Definition and ONE Rule unchanged
* Preserves Runtime Truth v1 topology and ADR-007 Story ↔ Reading Route projection
* Clear Layer 3 Editorial vocabulary for Scene (ADR-009 compatible)

**Costs**

* Editorial judgment required for Story boundaries and Scene sequences within Stories
* Story ≠ Chapter and Scene ≠ Reading Frame increase operator training burden
* Editorial Scene ↔ Runtime representation mapping remains deferred (ADR-007 / SPEC)
* Multi-pass editorial work is slower than single-pass generation

---

## Refs

### Evidence Chain

```text
EAR — Narrative Unit Validation (Hypothesis A / B / C)
EAR — Narrative Object Topology Completeness Audit (2026-07-11)
AD-005 — Narrative Closure Detection
AD-006 — Editorial Segmentation Workflow (ONE Rule)
AD-007 — Editorial Production Workflow Validation
```

### Governance

```text
Constitution.md                              Reader principles; Story Structure roadmap
governance/FOUNDATION.md                     Runtime Supremacy Law; authority hierarchy
governance/ADR_RULES.md                      ADR lifecycle; ADR → SPEC → Implementation
governance/SPEC_RULES.md                     ADR/SPEC division of responsibility
docs/adr/004-source-of-canonical-truth.md   Human Acceptance Gate; Copilot authority
docs/adr/009-vocabulary-architecture.md     Layer 3 Editorial vocabulary; orthogonality rules
```

### ADR

```text
ADR-004 — Source of Canonical Truth (parent)
ADR-006 — Discovery Copilot Architecture (Accepted — Authority Emergence; Story vs Entity paths)
ADR-007 — Editorial → Runtime Rollout Architecture (Accepted — Architecture Closure)
ADR-009 — Vocabulary Architecture (Layer 3 Editorial vocabulary authority)
```

---

## Legacy Alias Reference (A3)

*Added by Amendment A3 — Runtime Vocabulary Alignment. See `governance/vocabulary/runtime-lexicon.md` for the complete normative registry.*

| Normative Term | Legacy Term | Classification | Status |
| -------------- | ----------- | -------------- | ------ |
| Reading Route | Scene | Implementation Alias | Active — appears as `(implementation: Scene)`; **not** Editorial Scene (Layer 3) |
| Reading Frame | Story Image | Implementation Alias | Active — appears as `(implementation: Story Image)` |

*Amendment A4 note:* **Editorial Scene** (Layer 3; this ADR) and **Reading Route**
 (Layer 5; implementation alias `Scene`) MUST NOT be conflated. See Decision 10 and
 Glossary disambiguation.
