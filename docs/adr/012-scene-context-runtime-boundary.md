# ADR-012 — Scene Context Runtime Boundary

**Status:** Draft — Accepted Review Ready  
**Type:** Architecture ADR  
**Version:** 0.3  
**Last Updated:** 2026-08-05  
**Owner:** Architect  
**Related ADR:** ADR-004 (Runtime Truth topology); ADR-005 (Narrative Information Model); ADR-006 (Discovery Copilot); ADR-007 (Rollout / Projection); ADR-009 (Vocabulary / Reader Step); ADR-011 (Visual Expression ownership)  
**Related SPEC (downstream, not defined here):** SPEC-RDX-001; SPEC-ROL-001/002; Runtime Reading Governance RC1  
**Evidence:** EAR Extraction Pipeline Runtime Truth; EAR Scene-Centric Ownership Migration; EAR Editorial Scene → Runtime Scene Convergence; EAR Scene Context Contract; EAR ADR Draft Preparation / Change Proposal (Architect Review: APPROVED WITH CORRECTION)

> **Draft authorization:** Architect Review approved the Scene Context Runtime Boundary decision with correction: Scene Context is **not** a new routing/page identity; Reading Route is retained as the Story delivery / runtime container projection with **reduced ownership**.  
> **Stabilization (v0.2):** Route / Frame non-ownership invariants made explicit; RDX impact framed as terminology correction only.  
> **Accepted Preparation (v0.3):** Ownership rules frozen; Governance Impact tracking added; Explicit Non-Changes and Open Questions preserved for Accepted Review.  
> **Governance Closure Pass (2026-08-05):** ADR-004 A10 / ADR-005 A5 / ADR-007 A3 / SPEC-RDX-001 v1.4 / RC1 deferred items aligned in this repo. Runtime Lexicon v2.1 (RV-08 Scene Context) is authored in **raree-governance** (`vocabulary/runtime-lexicon.md`) and must be consumed via submodule sync — **do not** edit `governance/` in this consumer. Architecture consistency achieved; SPEC Authorization Boundary next — **no implementation grant**.

---

## Context

Raree Show Runtime today materializes an approved Story primarily through a **Reading Route** delivery container that presents ordered **Reading Frames**.

Observed structural mismatch:

1. **Reading Route incorrectly owns** character appearance and location context at delivery-container scope, producing wrong granularity and cross-Story contamination when batch entities are attached at Story/Route accept time.
2. **Reading Frame** carries visual projection and related presentation representation, but is **not** the ownership boundary for narrative-moment context (who appears, where, what the beat is).
3. **Editorial Scene** exists in the Editorial Domain (ADR-005) and is produced by Discovery, then associated toward Runtime representation. It provides editorial progression authority (NIM-INV-06) but **does not** supply a Runtime ownership boundary. Identity merge with Frame or Route is forbidden (ADR-005 Decision 10).

The product requires a stable **Runtime** ownership boundary for narrative moments inside a Story, without collapsing Editorial Scene, Reading Route, or Reading Frame into one identity, and without making that boundary a new URL/page routing entity in this ADR.

---

## Problem Statement

The system needs a stable ownership boundary for:

* character appearance (references into Work Character Archive)
* location context (references into Work Location Archive)
* narrative moment context (beat-level narrative meaning for readers/creators)
* visual creation context (intent / expression that drives projection)

Without that boundary:

* ownership defaults to Reading Route → wrong granularity and batch attach pollution
* Frames remain representation-only → cannot authoritatively own appearance/location
* Editorial Scene remains editorial-only → cannot be silently renamed into Runtime without violating ADR-005

---

## Decision

Raree Show uses Scene Context as the Runtime ownership boundary for narrative moments inside a Story.

* **Story** remains the **structural container**.
* **Reading Frame** remains the **visual projection representation**.
* **Editorial Scene** remains an **editorial source concept** and does **not** merge identity with Scene Context.
* **Reading Route** remains the **Story delivery runtime projection** (delivery container only).

```text
Scene Context
      │
      │ projects
      ▼
Reading Frame
```

---

## Runtime Boundary

Normative conceptual model:

```text
Work
├── Character Archive
├── Location Archive
└── Story
     └── Scene Context
            │
            └── projects → Reading Frame


Reading Route
 = Story delivery runtime projection
```

### Ownership Rules (frozen)

#### Scene Context owns

* narrative moment meaning
* character appearance references
* location context
* creation-facing visual context

#### Reading Frame owns

* visual representation

#### Reading Route owns

* delivery projection

#### Archives own

* character entities (Character Archive)
* location entities (Location Archive)

#### Story owns

* structural ordering of narrative moments within the story unit

### Reading Route boundary (mandatory)

```text
Reading Route = delivery projection of Story
```

Reading Route **IS**:

* Story delivery / runtime container projection
* reading / session delivery scope carrier

Reading Route is **NOT**:

* narrative ownership boundary
* character appearance ownership
* location context ownership
* Scene Context owner or Scene Context identity

This ADR does **not** remove Reading Route. Removal or replacement of Reading Route as delivery container requires a **separate** decision.

### Reading Frame boundary (mandatory)

```text
Reading Frame represents visual projection.
Reading Frame does not own narrative context.
```

Reading Frame **IS**:

* visual projection
* presentation representation
* generated asset carrier

Reading Frame is **NOT**:

* Runtime ownership boundary for narrative moments
* owner of character appearance
* owner of location context
* owner of narrative moment context
* Scene Context by rename or identity

Scene Context **projects to** Reading Frame; projection is not ownership transfer of narrative context.

### Responsibilities (summary)

| Construct | Responsibility |
| --------- | -------------- |
| **Work** | Scope root; owns Character / Location Archives |
| **Story** | Structural container; structural ordering |
| **Scene Context** | Runtime ownership boundary for narrative moments; projects to Frame |
| **Reading Frame** | Visual representation only |
| **Reading Route** | Delivery projection of Story only |
| **Editorial Scene** | Editorial source; may associate to Scene Context; never equals it by identity |

---

## Identity Rules

Frozen identity separation:

```text
Editorial Scene
    ≠
Scene Context
    ≠
Reading Frame
    ≠
Story
    ≠
Reading Route
```

Additional invariants:

```text
Reading Frame  ≠  Runtime ownership boundary
Reading Frame  does not own narrative context
Reading Route  ≠  narrative / character / location ownership
```

Governed relationships (not equality):

```text
Editorial Scene
      │
      │ association
      ▼
Scene Context
      │
      │ projection
      ▼
Reading Frame
```

**Important:** Editorial Scene does **NOT** become a “Runtime Scene.” Scene Context is a **distinct Runtime construct**. Association replaces identity merge. Frame projection does **not** absorb Scene Context ownership.

---

## Governance Impact

Impact tracking for Accepted Review. Downstream SPEC/code MUST NOT bypass these boundaries.

### ADR-004 Impact

**Before:**

```text
Work
 → Reading Route
    → Reading Frame
```

(de facto: Route also carried narrative-moment ownership)

**After:**

```text
Work
 → Story
    → Scene Context
       → Reading Frame

Reading Route = Story delivery runtime projection (retained)
```

* Reading Route is **retained**
* Reading Route **ownership contracts** (no narrative / character / location / Scene Context ownership)
* Scene Context is introduced as the **ownership boundary**
* This is an **ownership evolution**, not deletion of delivery topology
* Scene Context is **not** authorized as a new URL/page routing identity in this ADR

### ADR-005 Impact

**Preserved:**

```text
Editorial Scene ≠ Runtime Identity
```

Decision 10 identity non-merge (Editorial Scene ⊥ Reading Route ⊥ Reading Frame) remains mandatory.

**Added:**

```text
Editorial Scene associates with Scene Context
```

**Forbidden:**

```text
Editorial Scene becomes Runtime Scene
Editorial Scene = Scene Context (by identity)
```

NIM-INV-06: Editorial Scene remains Editorial Domain progression authority; association does not transfer identity into Runtime.

### ADR-007 Impact

**Closed (was deferred):**

```text
Editorial Scene ↔ Runtime mapping deferred
```

**Replaced by:**

```text
Editorial Scene
        association
             ↓
Scene Context
        projection
             ↓
Reading Frame
```

**Forbidden:** identity merge at any hop (Editorial Scene ≠ Scene Context ≠ Reading Frame).

### RDX Impact

**Prior shorthand:**

```text
Scene-centric Reading rejected
```

**Terminology correction (authorized by this ADR):**

* Rejected remains: **Editorial Scene as runtime consumption unit** / Editorial Scene-centric Reading
* Accepted: **Scene Context-aware Reading**
* Preserved: **Reader Step remains the consumption atom** (unchanged by this ADR)

This is a **terminology correction**, not a redesign of Reader Step or RDX capability ownership.

### RC1 Impact

**Authorized to close (upon Acceptance of this ADR):**

```text
Scene-aware Reading deferred item
```

**Reason:** ADR-012 authorizes the Runtime Boundary (Scene Context) that Scene-aware Reading depended on. SPEC/RC1 baseline text updates remain downstream; they MUST NOT reopen identity merge or Route narrative ownership.

### Implementation bypass prohibition

Any subsequent Discovery, Rollout, Persistence, Admin, or Web change that:

* reassigns character appearance or location context ownership to Reading Route or Reading Frame, or
* renames Editorial Scene into Scene Context / Frame / Route, or
* treats Scene Context as removed Reading Route,

**violates** this ADR unless a later Accepted ADR amends it.

---

## Explicit Non-Changes

ADR-012 does **NOT** decide:

* database schema
* table design
* API shape
* URL routing
* migration strategy
* Admin UI
* Web UI
* SPEC fields
* implementation sequence
* extraction prompt design
* Reading Route removal
* Scene Context as page/routing entity
* Reader Step atom redefinition
* association/projection cardinality freeze
* persistence materialization path

---

## Alternatives Considered

| Alternative | Outcome |
| ----------- | ------- |
| Keep character/location on Reading Route; fix only Extraction attach | Rejected — wrong ownership granularity remains |
| Rename Editorial Scene → Runtime Scene (identity merge) | Rejected — violates ADR-005 Decision 10 |
| Make Reading Frame the ownership boundary | Rejected — Frame is Representation; does not own narrative context |
| Make Scene Context the new routable page/URL identity in this ADR | Rejected — Architect correction; Route retained as delivery projection |
| Remove Reading Route in this ADR | Rejected — requires separate decision |

---

## Consequences

### Positive

* Clear Runtime ownership for narrative moments (**Scene Context**)
* Clear non-ownership for Reading Route (delivery only) and Reading Frame (visual representation only)
* Preserves Editorial ↔ Runtime layer separation and ADR-005 Decision 10
* Retains Reading Route delivery without a routing redesign in this ADR
* Unblocks Scene Context-aware Reading without accepting Editorial Scene-centric Reading

### Negative / costs

* Runtime ownership story is a version transition relative to v1
* Downstream artifacts must align vocabulary (Route vs Scene Context) — Vocabulary Debt remains
* Legacy Route-held appearance/location data become architectural debt until a later governed change (**not designed here**)

---

## Open Questions

Architectural open points only — **must not be closed early** by this ADR:

1. **Context addressing:** Whether a future ADR may authorize Scene Context addressing **without** changing Reading Route as delivery projection — **not** authorized here.
2. **Association / projection cardinality:** Deferred to SPEC; not frozen here.
3. **Route legacy ownership sunset:** How non-authoritative legacy Route-held appearance/location data are retired — migration later; not designed here.
4. **Persistence materialization:** Which governed path first materializes Scene Context — out of scope here.
5. **RDX / RC1 text sequencing:** Order of downstream wording updates after Acceptance — process only.

---

## Review Criteria (Accepted Review Gate)

### Must NOT happen

* ❌ Scene Context becomes Editorial Scene rename  
* ❌ Scene Context becomes Frame rename  
* ❌ Scene Context becomes URL/page entity decision in this ADR  
* ❌ Reading Route removed without a separate decision  
* ❌ Implementation / schema / API / UI sneak into this ADR  

### Must happen

* ✅ Scene Context ownership boundary clear and frozen  
* ✅ Story / Reading Route boundary clear (Route = delivery only)  
* ✅ Reading Frame boundary clear (visual representation; no narrative ownership)  
* ✅ Editorial identity preserved (D10; association ≠ merge)  
* ✅ Governance Impact recorded for ADR-004 / 005 / 007 / RDX / RC1  
* ✅ Explicit Non-Changes present  
* ✅ Open Questions preserved (not prematurely closed)  

---

## Legacy Alias Reference

| Normative Term | Legacy / Implementation Term | Classification | Status |
| -------------- | ---------------------------- | -------------- | ------ |
| Reading Route | product “故事” delivery unit; implementation alias historically “Scene” | Implementation Alias | Active — **delivery only**; ownership reduced |
| Reading Frame | Story Image | Implementation Alias | Active — visual representation only |
| Scene Context | *(none stable)* | New Runtime term | Draft — must not alias to Editorial Scene or Frame |
| Editorial Scene | Discovery scene candidate; Approved Scene unit | Editorial Domain | Active — association source only |
| Story | Approved Story unit; structural container | Editorial + structural | Active — not Scene Context |

---

## Refs

* `docs/adr/004-source-of-canonical-truth.md`
* `docs/adr/005-narrative-information-model.md`
* `docs/adr/006-discovery-copilot-architecture.md`
* `docs/adr/007-rollout-architecture.md`
* `docs/specs/spec-rdx-001-runtime-reading-experience.md`
* `docs/specs/spec-rol-002-projection-semantics.md`
* `docs/specs/runtime-reading-governance-rc1.md`
* Architect Review Feedback + ADR Draft Authorization (2026-08-04) — APPROVED WITH CORRECTION
* Accepted Preparation (2026-08-05) — Governance Impact + Explicit Non-Changes
