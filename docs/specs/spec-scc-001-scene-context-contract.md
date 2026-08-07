# SPEC-SCC-001 — Scene Context Contract

## Metadata

| Field | Value |
| ----- | ----- |
| Title | Scene Context Contract |
| Status | **Accepted** — Architect Review |
| Version | v0.2 |
| Owner | Architect |
| Last Updated | 2026-08-07 |
| Derived From | ADR-012 (Scene Context Runtime Boundary — Governance Closure) |
| Related | ADR-004 · ADR-005 · ADR-006 · ADR-007 · ADR-009 · ADR-011 · SPEC-ROL-001/002 · SPEC-RDX-001 · Runtime Reading Governance RC1 |
| Authorization | **Contract Accepted** — semantic ownership only; no Spike / Production / Implementation grant |
| Supersedes | SPEC-SCC-001 v0.1 (Draft) |

> **Authority boundary:** This SPEC defines **semantic ownership and producer/consumer contracts** for Scene Context. It does **not** authorize persistence, transport shapes, UI, or materialization algorithms. Downstream SPECs may refine representation without changing ownership boundaries defined here.

> **v0.2 (Architect Review — Approved with Minor Corrections):** Clarifies Runtime-authoritative terminology (not a new Editorial entity); renames reader-facing wording to avoid Editorial Scene confusion; tightens Web Reader consumption boundary (Runtime delivery projections only; Scene Context ≠ URL/page identity).

---

## 1. Purpose

Define the **Scene Context Runtime Contract**: the stable semantic ownership boundary for a narrative moment inside a Story, as authorized by ADR-012.

This SPEC freezes:

* Scene Context meaning
* ownership boundaries and invariants
* producer / consumer contracts
* projection and association semantics (as relations, not identity)
* forbidden ownership leakage patterns

This SPEC does **not** define how Scene Context is stored, transported, rendered, or generated.

---

## 2. Relationship to ADR-012

ADR-012 is the Architecture authority for Scene Context Runtime Boundary.

SPEC-SCC-001 is the **downstream Runtime Contract** that makes ADR-012 ownership rules consumable by Discovery, Review / Accept, Rollout Projection, Admin / Creator, and Web Reader — without collapsing identities or freezing implementation.

| Concern | ADR-012 | SPEC-SCC-001 |
| ------- | ------- | ------------ |
| Scene Context as Runtime ownership boundary | Decides | Contracts |
| Five-way identity separation | Freezes | Inherits and restates as invariants |
| Editorial Scene association → Scene Context → Reading Frame projection | Authorizes | Defines producer/consumer and projection rules |
| Reading Route retained as delivery projection | Decides | Forbids Route ownership recovery |
| Schema / API / UI / cardinality / materialization | Explicit Non-Changes | Remain Non-goals |

**Consistency constraint:** Any interpretation of this SPEC that contradicts ADR-012 identity or ownership rules is invalid. On conflict, ADR-012 prevails until amended by a later Accepted ADR.

---

## 3. Scene Context Definition

### 3.1 Normative definition

> **Scene Context** is the Runtime ownership boundary for a narrative moment inside a Story.

Scene Context is a **Runtime construct**. It is not an Editorial progression unit, not a visual representation, and not a delivery container.

### 3.2 What Scene Context owns

Scene Context owns:

| Owned concern | Meaning |
| ------------- | ------- |
| Narrative moment context | Beat-level narrative meaning for that moment inside a Story |
| Character appearance references | References into Work Character Archive for who appears / how they appear in this moment |
| Location context | Location context for this moment, referencing Work Location Archive where applicable |
| Reader-facing narrative context | The scoped narrative-moment information Reader Runtime may consume without Editorial identity |
| Creation-facing visual expression | Creation-facing visual intent / expression that drives projection toward Reading Frame |

### 3.3 What Scene Context does not own

Scene Context does **not** own:

| Non-owned concern | True owner |
| ----------------- | ---------- |
| Character Archive entity | Work (Character Archive) |
| Location Archive entity | Work (Location Archive) |
| Story metadata / Story structural container | Story |
| Generated image asset | Reading Frame (as visual representation / asset carrier) |
| Editorial Scene identity | Editorial Domain (Editorial Scene) |
| Delivery / session container projection | Reading Route |
| Story ordering across moments | Story |

### 3.4 Placement in the Runtime model

```text
Work
 ├── Character / Location Archive
 └── Story
      └── Scene Context
            ├── narrative context ownership
            ├── character appearance references
            ├── location context reference
            ├── creation-facing visual expression
            └── projects → Reading Frame

Reading Route = Story delivery runtime projection

Reading Frame = visual projection representation
```

---

## 4. Ownership Contract

### 4.1 Frozen ownership tree

```text
Work
 ├── Character Archive
 └── Location Archive


Story
 └── Scene Context


Scene Context
 └── projects → Reading Frame


Reading Frame
 └── visual representation only
```

Reading Route remains orthogonal as:

```text
Reading Route = Story delivery runtime projection
```

Reading Route is retained. Retention does **not** restore narrative / character / location ownership to Route.

### 4.2 Capability readiness ownership

| Capability | Owner |
| ---------- | ----- |
| character appearance context | Scene Context |
| location context | Scene Context |
| narrative beat | Scene Context |
| image asset | Reading Frame |
| Archive identity | Work |
| Story ordering | Story |
| delivery projection | Reading Route |

### 4.3 Required invariants

```text
Scene Context ≠ Story

Scene Context ≠ Reading Frame

Scene Context ≠ Reading Route

Scene Context ≠ Editorial Scene

Reading Frame MUST NOT become narrative ownership boundary

Reading Route MUST NOT own character/location context
```

Additional invariants:

| ID | Invariant |
| -- | --------- |
| SCC-INV-01 | Scene Context is the sole Runtime ownership boundary for narrative-moment context inside a Story |
| SCC-INV-02 | Character appearance references and location context attach at Scene Context scope, never at Reading Route or Story container as ownership |
| SCC-INV-03 | Reading Frame may carry visual representation and generated assets; it MUST NOT own narrative beat, character appearance, or location context |
| SCC-INV-04 | Reading Route may deliver Story; it MUST NOT own Scene Context, character appearance, or location context |
| SCC-INV-05 | Editorial Scene may associate to Scene Context; association MUST NOT merge identity |
| SCC-INV-06 | Projection from Scene Context to Reading Frame MUST NOT transfer narrative ownership into Frame |
| SCC-INV-07 | Archive entities remain Work-scoped; Scene Context holds references / context, not Archive identity |

### 4.4 Contract stability rule

> This contract defines semantic ownership only. Concrete persistence and transport representations may evolve without changing ownership boundaries.

Therefore this SPEC MUST NOT be read as freezing:

* JSON / payload shape
* database schema or table design
* API routes or transport envelopes
* UI structure

Representation change that preserves §3–§4 ownership is in-contract. Representation change that moves ownership to Route, Frame, Story, or Editorial Scene is out-of-contract and violates ADR-012.

---

## 5. Producer Contract

### 5.1 Authorized producer systems (semantic roles)

The following systems MAY participate in producing Scene Context information. Participation does not by itself establish Runtime truth.

| Producer role | May produce | May not unilaterally establish |
| ------------- | ----------- | ------------------------------ |
| **Discovery** | Scene Context **candidate** information (narrative moment cues, appearance/location candidate references, creation-facing visual expression candidates) | Runtime Truth for Scene Context |
| **Review / Accept** | Human acceptance decisions that authorize candidate information toward Runtime-authoritative Scene Context | Automatic identity merge with Editorial Scene, Frame, or Route |
| **Rollout Projection** | Governed association / projection that materializes Runtime-authoritative Scene Context relationships toward Runtime delivery and Frame projection | Ownership reassignment to Reading Route or Reading Frame |

### 5.2 Discovery output rules

Discovery output:

* **MAY** produce Scene Context candidate information
* **MUST NOT** directly define Runtime Truth
* **MUST NOT** treat Editorial Scene candidate identity as Scene Context identity

Human acceptance remains required before candidate information may become **Runtime-authoritative Scene Context**.

Runtime authority comes from the governed Runtime contract after the human gate — **not** from Editorial accept as if it created a new Editorial entity named “Accepted Scene Context.”

```text
Discovery candidate
        │
        │ Human acceptance
        ▼
Runtime-authoritative Scene Context
        │
        │ Rollout Projection (governed)
        ▼
Reading delivery / Frame projection surfaces
```

### 5.3 Acceptance and authority

| Rule | Normative |
| ---- | --------- |
| Human acceptance required for Runtime-authoritative Scene Context | **MUST** |
| Discovery Accept alone defines Runtime-authoritative Scene Context | **MUST NOT** |
| Editorial accept creates a new Editorial entity “Accepted Scene Context” | **MUST NOT** |
| Projection Accept may operationalize associations / projections for Runtime-authoritative Scene Context | **MAY** (downstream Rollout SPECs) |
| Projection Accept may invent narrative ownership | **MUST NOT** |

Exact Accept workflow split (Discovery Accept vs Projection Accept) remains owned by Discovery / Rollout SPECs; this SPEC only freezes that **candidate ≠ Runtime truth** and **human gate remains**.

---

## 6. Consumer Contract

### 6.1 Web Reader

**Consumes:**

* Scene Context–scoped reading information (narrative moment context needed for Scene Context–aware Reading)
* Reading Frame projection (visual representation)

**Does not consume (as ownership or identity authority):**

* Editorial Scene identity
* Discovery staging objects
* generation provenance as Reader-facing truth

```text
Web Reader consumes Scene Context through Runtime delivery projections,
not by directly depending on Editorial production objects.
```

```text
Reader consumption of Scene Context does not make Scene Context a URL/page routing identity.
```

Reader Step remains the consumption atom (ADR-012 / SPEC-RDX-001). This SPEC authorizes **Scene Context–aware Reading**, not Editorial Scene–centric Reading. Web Reader MUST NOT bypass Runtime delivery by depending on Editorial production objects (for example Editorial staging / association stores) as if they were Scene Context Runtime authority.

### 6.2 Admin / Creator

**Consumes:**

* Scene Context ownership boundary as the creation / curation boundary for narrative-moment context
* creation-facing visual expression owned by Scene Context
* Archive references via Scene Context (not via Story or Route ownership)

**Does not:**

* attach character / location ownership to the Story container
* treat Reading Frame as scene ownership
* treat Reading Route as narrative-moment ownership
* rename Editorial Scene into Scene Context

Admin MAY associate Editorial Scene with Scene Context and project Scene Context to Reading Frame; association and projection remain relations, not identity merges.

---

## 7. Projection Rules

### 7.1 Editorial → Runtime → Representation chain

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

### 7.2 Normative relation rules

| Relation | Meaning | Identity effect |
| -------- | ------- | --------------- |
| **association** | Editorial Scene relates to Scene Context as editorial source ↔ Runtime ownership boundary | **≠ identity merge** |
| **projection** | Scene Context projects visual representation to Reading Frame | **≠ identity merge**; **≠ ownership transfer** of narrative context |

### 7.3 Authority preserved across hops

* Editorial Scene remains **editorial progression authority** (ADR-005 / NIM-INV-06)
* Scene Context remains **Runtime ownership boundary**
* Reading Frame remains **visual representation only**
* Reading Route remains **Story delivery runtime projection only**

### 7.4 Forbidden convergence

```text
Editorial Scene becomes Runtime Scene
```

is forbidden. Scene Context is a distinct Runtime construct. No rename, alias, or implementation convenience may collapse Editorial Scene into Scene Context, Reading Frame, or Reading Route.

### 7.5 Projection endpoint clarification

* Scene Context **projects to** Reading Frame for visual representation
* Reading Route **delivers** Story; it is not the narrative ownership endpoint of Editorial Scene association under ADR-012
* Cardinality of association / projection is **not** frozen here (see Open Questions)

---

## 8. Forbidden Patterns

The following patterns violate this contract:

| ID | Forbidden pattern |
| -- | ----------------- |
| SCC-FORB-01 | `Scene Context ≡ Editorial Scene` (identity merge or rename) |
| SCC-FORB-02 | `Scene Context ≡ Reading Frame` (identity merge or rename) |
| SCC-FORB-03 | `Scene Context ≡ Reading Route` (identity merge, replacement, or “Route is Context”) |
| SCC-FORB-04 | `Scene Context ≡ Story` |
| SCC-FORB-05 | Reading Frame becomes narrative ownership boundary |
| SCC-FORB-06 | Reading Route owns character appearance or location context |
| SCC-FORB-07 | Character / Location Archive entities owned by Scene Context (vs references / context) |
| SCC-FORB-08 | Story container owns character appearance / location context for narrative moments |
| SCC-FORB-09 | Discovery staging object treated as Runtime-authoritative Scene Context without human acceptance |
| SCC-FORB-10 | Web Reader consumes Editorial Scene identity, Discovery staging, or other Editorial production objects as reading authority |
| SCC-FORB-11 | Generation provenance treated as Reader-facing narrative ownership |
| SCC-FORB-12 | Freezing JSON / DB / API / UI shapes in the name of this ownership contract |
| SCC-FORB-13 | Treating Scene Context as a URL/page routing identity because Reader consumes it |

---

## 9. Non-goals

Out of scope for SPEC-SCC-001 (deferred to later SPECs / Implementation Authorization):

* database schema
* table design
* migration
* API route
* TypeScript interface
* UI design
* Admin page structure
* Web component design
* persistence strategy
* association cardinality
* projection cardinality
* materialization algorithm
* generation prompt format
* renderer implementation
* Reading Route removal or Scene Context as URL / page routing identity
* Reader Step atom redefinition
* legacy Route-held appearance / location sunset procedure

These MUST NOT be smuggled into this SPEC as frozen decisions.

---

## 10. Open Questions

Architectural / contract-adjacent open points — **must not be closed early** by Acceptance of this SPEC:

1. **Association cardinality:** How many Editorial Scenes may associate to one Scene Context, and inverse — deferred.
2. **Projection cardinality:** How many Reading Frames a Scene Context may project to, and inverse — deferred.
3. **Context addressing:** Whether a future ADR authorizes Scene Context addressing without changing Reading Route as delivery projection — not authorized by ADR-012 or this SPEC.
4. **Persistence materialization path:** Which governed path first materializes Scene Context — out of scope.
5. **Legacy Route ownership sunset:** How non-authoritative legacy Route-held appearance / location data retire — migration later.
6. **Accept workflow split detail:** Precise Discovery Accept vs Projection Accept operational split for Scene Context — owned by Discovery / Rollout SPECs; this SPEC only requires human gate + candidate ≠ truth.
7. **RDX / RC1 wording sequencing:** Order of downstream terminology updates for Scene Context–aware Reading — process only.

---

## Review Gate (v0.2 — Architect Accepted Review)

### Architecture

* [x] Scene Context remains the Runtime ownership boundary
* [x] Editorial Scene does not upgrade into Runtime Scene
* [x] Reading Frame does not assume narrative ownership
* [x] Reading Route does not restore character / location ownership
* [x] Five-way identity isolation preserved: Editorial Scene ≠ Scene Context ≠ Reading Frame ≠ Story ≠ Reading Route
* [x] Scene Context ≠ URL/page routing identity

### Governance

* [x] Defines semantic contract only
* [x] Does not freeze implementation representation (schema / API / UI / TypeScript)
* [x] Does not prematurely close Open Questions
* [x] Runtime-authoritative terminology does not invent an Editorial “Accepted Scene Context” entity
* [x] Web Reader consumes Scene Context only through Runtime delivery projections

### Product Alignment

* [x] Web minimal reading context can be based on Scene Context–scoped information + Frame projection
* [x] Admin / Creator authorship boundary can center on Scene Context
* [x] Discovery output can evolve naturally as Scene Context candidate (not Runtime truth)

---

## Refs

* `docs/adr/012-scene-context-runtime-boundary.md`
* `docs/adr/004-source-of-canonical-truth.md`
* `docs/adr/005-narrative-information-model.md`
* `docs/adr/006-discovery-copilot-architecture.md`
* `docs/adr/007-rollout-architecture.md`
* `docs/specs/spec-rol-002-projection-semantics.md`
* `docs/specs/spec-rdx-001-runtime-reading-experience.md`
* `docs/specs/runtime-reading-governance-rc1.md`
