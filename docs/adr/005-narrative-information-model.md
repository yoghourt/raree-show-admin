# ADR-005 — Narrative Information Model

**Status:** Accepted
**Type:** Architecture ADR
**Version:** 1.3
**Last Updated:** 2026-06-29
**Owner:** Architect
**Related ADR:** ADR-004 (Source of Canonical Truth — Human Acceptance Gate and Copilot authority); ADR-006 (Discovery Copilot Architecture — Authority Emergence and Human Review outcome paths); ADR-007 (Editorial → Runtime Rollout Architecture — Architecture Closure)
**Amendment:** Clarification only — A1 (Relationship to ADR-006; Approved Story unit vs Production Entity), A2 (Relationship to ADR-007; cross-domain mapping deferral closed). No Decisions changed.

---

## What

This ADR establishes the **Narrative Information Model** for the Raree Show
 **Editorial Domain**.

It defines:

* The foundational principle that **narrative is the source of truth** for editorial
  knowledge.
* The **Canonical Definition of Story** — the system-wide reference definition.
* The **Glossary** of core narrative terms for downstream ADRs.
* The distinction between **Story**, **Story Arc**, and **Chapter**.
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

---

## Why

Raree Show exists to reduce the cognitive cost of understanding complex stories
while preserving the author's narrative experience (`Constitution.md` — *Reader
Understanding First*, *Preserve the Author's Narrative Experience*).

Three structural problems block a narrative-first model in the Editorial Domain:

**Problem 1 — Chapter mistaken for Story.**

Author-defined chapters are publishing and reading-pause boundaries. They do not
 reliably coincide with the smallest unit at which a reader stabilizes one mental
 model. Treating Chapter as Story produces incorrect cognitive granularity for
 fragmented reading.

**Problem 2 — Scene-oriented modeling conflates the Runtime Domain with cognition.**

Current Runtime Truth v1 routes reading through Scene records. Scene is a
 routable runtime unit in the **Runtime Domain** — not, by itself, a definition
 of editorial narrative completeness. Editorial decisions require a model grounded
 in reader cognition within the **Editorial Domain**, not storage convenience.

**Problem 3 — Knowledge defined before narrative.**

When Characters, Locations, Relationships, or graph structures are treated as
 primary inputs to narrative segmentation, knowledge defines boundaries instead
 of emerging from approved narrative units. This inverts the required dependency
 order and produces inconsistent editorial truth.

This ADR resolves these problems within the **Editorial Domain** without altering
 current Runtime Domain enforcement. Runtime Truth v1 remains authoritative until
 ADR-007 governs governed projection from Editorial Story units to Runtime Scene
 association (`FOUNDATION.md` §1 — Runtime Supremacy Law).

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

---

## Glossary

The following terms are **canonical for the Raree Show governance system**.
 Downstream ADRs and SPECs MUST use these definitions and MUST NOT redefine them
 with conflicting semantics.

**Story**

The primary editorial narrative unit. See **Canonical Definition** (authoritative
 wording).

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

**Narrative Closure**

The combined satisfaction of closure signals (operative, epistemic, relational,
 affective, world-state, or decisional) that allows a reader to perceive a narrative
 unit as complete. No single structural marker is sufficient alone.

**Knowledge Artifact**

Any editorial derivative extracted from approved Stories — including Character
 references, Location references, Relationship updates, Timeline assertions, and
 Knowledge Graph nodes or edges. Knowledge artifacts MUST NOT define Story
 boundaries.

**Editorial Domain**

The governance and production layer where narrative units, boundaries, summaries,
 and derived knowledge are defined and human-accepted. This ADR governs the
 Editorial Domain. It is independent of runtime schema and routing.

**Runtime Domain**

The production-enforced layer where reading topology, persistence, and routing
 are implemented. Current Runtime Truth v1 (`Work → Scene → Story Images`) belongs
 to the Runtime Domain.

**The ONE Rule**

The mandatory Editorial Domain gate for Story boundary approval: primary dramatic
 question → stable outcome → reader can stabilize one mental model. See Decision 5.

---

## Canonical Definition

The following is the **canonical Story definition** for the Raree Show governance
 system. All downstream ADRs and SPECs MUST reference this section when defining
 or constraining Story. They MUST NOT publish alternate Story definitions with
 conflicting semantics.

> A **Story** is the smallest narrative unit that produces one stable **Mental
> Model Transition** for the reader.

Supporting term definitions appear in **Glossary**.

---

## Decision

### Decision 1 — Story Is the Primary Editorial Narrative Unit

**Story is the primary unit of narrative production in the Editorial Domain.**

Story is a **reader cognitive unit** — the unit at which an operator (or reader)
 can stabilize understanding of "what this part is about and how it turned out."

Story is **not** defined as a database entity, Runtime Domain routable record,
 or author structural container in this ADR. The authoritative wording is the
 **Canonical Definition**.

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

This decision adopts the **Canonical Definition** without modification.

Story is the **minimum** unit satisfying that definition. Larger constructs
 (Story Arc, Work, series) span multiple Stories.

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

---

### Decision 6 — Narrative Precedes Knowledge

**Narrative precedes Knowledge.**

All **Knowledge Artifacts** MUST be derived from **approved Stories** in the
 dependency order defined by the Information Emergence Model (below).

Knowledge Artifacts MUST NOT be used to **define** Story boundaries.

---

### Decision 7 — The Editorial Domain Is Multi-Pass

**Narrative work in the Editorial Domain is multi-pass, not single-pass.**

A valid editorial sequence includes, at minimum:

1. Scope and catalog preparation (Work brief; Character/Location scope acceptance)
2. Reading and Story boundary identification (ONE Rule gate)
3. Story unit completion (summary, cast/place, Mental Model Transition)
4. Knowledge extraction from approved Story units
5. Work-level consistency review before publication approval

This sequence describes a **typical workflow** within the Editorial Domain. It
 does not override the **dependency order** defined by the Information Emergence
 Model (see below).

Single-pass generation of narrative units and derived knowledge in one undifferentiated
 step is rejected for editorial truth production.

---

### Decision 8 — Editorial Domain Is Independent of Runtime Domain

**The Editorial Domain is independent of the Runtime Domain.**

The Story model defined by this ADR is **orthogonal** to current Runtime Truth v1
 in the Runtime Domain:

```text
Work
 └─ Scene              (routable runtime reading unit)
      └─ Story Images  (ordered visual frames; JSONB)
```

This ADR does not modify, endorse, or implement any mapping between domains.

Cross-domain mapping is governed by **ADR-007** (Accepted). Governed projection
 implementation is deferred to downstream SPEC. Until implemented, Runtime Domain
 supremacy applies unchanged (`FOUNDATION.md` §1).

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

Story units MUST preserve author narrative order within a Work.

**NIM-INV-02 — Knowledge does not define boundaries**

Knowledge Artifacts MUST NOT define Story boundaries.

**NIM-INV-03 — Reader cognition over storage convenience**

Reader cognitive completeness takes precedence over storage or routing convenience
 in the Runtime Domain when approving Story boundaries in the Editorial Domain.

**NIM-INV-04 — Editorial Domain truth precedes Runtime Domain**

Editorially approved Story truth in the Editorial Domain precedes Runtime Domain
 representation. The Runtime Domain MUST NOT silently redefine editorial boundaries.

**NIM-INV-05 — Human acceptance is final**

No Story unit and no derived Knowledge Artifact gains standing without explicit
 human acceptance (ADR-004 Decision 2).

---

## Relationship to ADR-004

This ADR specializes the Raree Show information model for the **Editorial Domain**.
 It does not supersede ADR-004.

ADR-004 remains authoritative for:

* Human-Owned Canonical Truth (Decision 1)
* Human Acceptance Gate (Decision 2)
* Copilot routing, field classification, and suggestion pipelines
* RT-INV-04 Enrichment boundary (Discovery architecturally owned by ADR-006 Accepted)

This ADR MUST NOT weaken any ADR-004 decision or invariant.

---

## Relationship to ADR-006

ADR-006 (Accepted) governs Discovery and the **Authority Emergence Model**.
 This ADR governs **Story semantics** and **Information Emergence** in the
 Editorial Domain.

When **Story Discovery** produces Story Candidates, Human Review acceptance
 yields an **Approved Story unit** — an editorial artifact governed by this ADR
 (NIM-INV-05, Canonical Definition). An Approved Story unit is **not** a
 Production **Entity** as defined in ADR-006. Catalog objects (Character,
 Location) follow the Catalog Entity path in ADR-006 after Human Review.

This ADR MUST NOT weaken ADR-006 Discovery boundaries or ADR-004 Human Acceptance.

---


## Relationship to ADR-007

ADR-007 (Accepted) governs **Editorial → Runtime Rollout** and **Architecture
 Closure** for Runtime Truth v1. This ADR governs **Story semantics** and
 **Information Emergence** in the Editorial Domain.

Cross-domain mapping deferral from this ADR is **closed** by ADR-007. Approved
 Story units reach Runtime only through **governed projection** onto Scene records
 (projection-only; Story is not a routable Runtime entity).

This ADR MUST NOT weaken ADR-007 rollout boundaries or ADR-004 Human Acceptance.

---

## Relationship to Runtime Truth v1


Current Runtime Truth v1 topology in the **Runtime Domain** is unchanged by this ADR.

This ADR governs the **Editorial Domain** cognitive model. Runtime Truth v1 governs
 the **Runtime Domain** enforced reading topology. The two domains coexist; Editorial↔Runtime association is governed by **ADR-007**;
 projection implementation is deferred to downstream SPEC.

When Editorial Domain and Runtime Domain descriptions diverge, **Runtime Domain
 enforcement prevails** for production behavior; **this ADR prevails** for Editorial
 Domain authority (`FOUNDATION.md` §1).

---

## Deferred Decisions

The following are explicitly deferred. They MUST NOT be inferred from this ADR.

| Deferred item | Expected governance home |
| ------------- | ------------------------ |
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

---

## Alternatives Considered

**Alternative A — Chapter as Story.**

Rejected. Literary and cognitive evidence demonstrates that author chapters are
 pause boundaries, not reliable cognitive-completion boundaries. POV chapters and
 multi-arc chapters violate one-chapter-one-story assumptions.

**Alternative B — Scene as editorial Story.**

Rejected. Scene aligns with Runtime Domain routing but conflates Runtime Domain
 structure with Editorial Domain cognitive completeness. A Scene may contain multiple
 Stories or span part of one Story.

**Alternative C — Topology-first normalization before Story definition.**

Rejected. Defining Runtime Domain topology before Story semantics inverts the
 Information Emergence Model and binds editorial judgment to storage structure.

**Alternative D — Single-pass AI bootstrap as Story producer.**

Rejected. Superseded by ADR-004. Conflicts with Human Acceptance Gate and Narrative
 Precedes Knowledge.

---

## Trade-offs

**Positive**

* Narrative-first Editorial Domain model aligned with Constitution reader principles
* Canonical Story definition and Glossary for downstream ADR consistency
* Repeatable Story boundary gate (ONE Rule)
* Clear dependency order for Knowledge Artifacts
* Editorial Domain / Runtime Domain separation enables ADR-005 acceptance without forced migration

**Costs**

* Editorial judgment required for every Story boundary (not mechanically derivable
  from chapter index)
* Story ≠ Chapter increases operator training burden
* Cross-domain mapping deferred — Editorial Domain Story units are not yet first-class Runtime Domain entities
* Multi-pass editorial work is slower than single-pass generation

---

## Refs

### Evidence Chain

```text
EAR — Narrative Unit Validation (Hypothesis A / B / C)
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
```

### ADR

```text
ADR-004 — Source of Canonical Truth (parent)
ADR-006 — Discovery Copilot Architecture (Accepted — Authority Emergence; Story vs Entity paths)
ADR-007 — Editorial → Runtime Rollout Architecture (Accepted — Architecture Closure)
```
