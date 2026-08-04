# ADR-012 — Scene Context Runtime Boundary

**Status:** Draft  
**Type:** Architecture ADR  
**Version:** 0.2  
**Last Updated:** 2026-08-04  
**Owner:** Architect  
**Related ADR:** ADR-004 (Runtime Truth topology); ADR-005 (Narrative Information Model); ADR-006 (Discovery Copilot); ADR-007 (Rollout / Projection); ADR-009 (Vocabulary / Reader Step); ADR-011 (Visual Expression ownership)  
**Related SPEC (downstream, not defined here):** SPEC-RDX-001; SPEC-ROL-001/002; Runtime Reading Governance RC1  
**Evidence:** EAR Extraction Pipeline Runtime Truth; EAR Scene-Centric Ownership Migration; EAR Editorial Scene → Runtime Scene Convergence; EAR Scene Context Contract; EAR ADR Draft Preparation / Change Proposal (Architect Review: APPROVED WITH CORRECTION)

> **Draft authorization:** Architect Review approved the Scene Context Runtime Boundary decision with correction: Scene Context is **not** a new routing/page identity; Reading Route is retained as the Story delivery / runtime container projection with **reduced ownership**.  
> **Stabilization (v0.2):** Route / Frame non-ownership invariants made explicit; RDX impact framed as terminology correction only.

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

Raree Show uses **Scene Context** as the **Runtime ownership boundary** for narrative moments inside a Story.

* **Story** remains the **structural container**.
* **Reading Frame** remains the **visual projection representation**.
* **Editorial Scene** remains an **editorial source concept** and does **not** merge identity with Scene Context.
* **Reading Route** remains the **runtime projection of Story delivery** (delivery container only). See Route boundary below.
* **Reading Frame** remains **visual projection representation** only. See Frame boundary below.

```text
Scene Context
      │
      │ projects
      ▼
Reading Frame
```

---

## Runtime Boundary

Conceptual model (normative for this ADR):

```text
Work
├── Character Archive
├── Location Archive
└── Story
     └── Scene Context
          ├── character appearance references
          ├── location context reference
          ├── narrative moment context
          ├── visual creation context (intent / expression)
          │
          └── projects
                │
                ▼
          Reading Frame
```

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

Ownership of narrative moments (including character appearance and location context) belongs to **Scene Context**, not to Reading Route.

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

### Responsibilities

| Construct | Responsibility |
| --------- | -------------- |
| **Work** | Scope root; owns Character Archive and Location Archive as durable catalogs |
| **Story** | Structural container; owns structural ordering of narrative moments within the story unit |
| **Scene Context** | **Runtime ownership boundary** for a narrative moment: character appearance references, location context, narrative moment context, visual creation context; **projects** to Reading Frame |
| **Reading Frame** | Visual projection representation only; does **not** own narrative context |
| **Reading Route** | Delivery projection of Story only; does **not** own narrative / character / location / Scene Context |
| **Editorial Scene** | Editorial Domain source / progression concept; may **associate** to Scene Context; **never** equals Scene Context by identity |

### Ownership reduction for Reading Route

| Before (de facto) | After (this ADR) |
| ----------------- | ---------------- |
| delivery + narrative ownership + character ownership + location ownership + treated as scene-context owner | **delivery projection only**; narrative / character / location / Scene Context ownership → **Scene Context**; Frames remain visual projection under delivery |

---

## Identity Rules

Mandatory invariants:

```text
Scene Context  ≠  Story
Scene Context  ≠  Reading Frame
Scene Context  ≠  Editorial Scene   (by identity)
Scene Context  ≠  Reading Route
Reading Frame  ≠  Runtime ownership boundary
Reading Frame  does not own narrative context
Reading Route  ≠  narrative / character / location ownership
```

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

## ADR Relationship

### ADR-004 — Runtime Truth topology

* **Impact (explainable):** Runtime Truth v1 treated Reading Route as the primary container that de facto carried narrative-moment fields. This ADR **evolves ownership**, not delivery topology removal.
* **Reading Route retained:** Continues as **delivery projection of Story**. It is not deleted.
* **What changes:** Authoritative ownership of character appearance and location context moves to **Scene Context**. Route remains delivery; Frame remains representation.
* **What does not change here:** Scene Context is **not** a new routable URL/page identity. Addressing / page identity stay a Reading Route delivery concern unless a later ADR decides otherwise.
* **Version note:** Ownership story is a **version transition** relative to v1; delivery shape `Work → (Story delivery via) Reading Route → Reading Frame` remains intelligible with Scene Context as the ownership boundary inside Story.

### ADR-005 — Narrative Information Model

* **Decision 10 preserved (not broken):** Editorial Scene ⊥ Reading Route ⊥ Reading Frame — identity non-merge remains mandatory.
* **Extension only:** Scene Context is a **separate Runtime construct**. It does not rename or replace Editorial Scene.
* **NIM-INV-06 preserved:** Editorial Scene remains Editorial Domain progression authority; it may **associate** to Scene Context without becoming Runtime by identity.
* **Story preserved:** Structural container; not collapsed into Scene Context.

### ADR-007 — Rollout / Projection

* **Deferred mapping closed (justified):** ADR-007 deferred Editorial Scene ↔ Runtime governed mapping. This ADR closes that deferral **without identity merge**, which is the form ADR-005/007 already required.
* **Closed form:**

  * Editorial Scene **associates** → Scene Context  
  * Scene Context **projects** → Reading Frame  

* **Basis for closure:** Association + projection satisfies the need for a governed Runtime boundary while preserving “Editorial Scene is not Reading Route / Frame.”
* **Forbidden form remains forbidden:** Editorial Scene = Runtime entity / = Scene Context / = Frame.

### SPEC-RDX-001 / RC1 (terminology correction authorization)

RDX conflict is **limited to terminology correction**, not a redesign of Reader Step or consumption atom:

```text
Prior shorthand:     “Scene-centric Reading rejected”
Corrected meaning:   Editorial Scene-centric Reading → remains Rejected
Newly authorized:    Scene Context-aware Reading → Accepted
```

* **Reader Step** definition is **unchanged** by this ADR.
* Rejecting Editorial Scene as a Runtime consumption node remains valid.
* Accepting Scene Context as ownership boundary (with Frame as representation) does **not** equal accepting Editorial Scene-centric Reading.
* RC1 deferred **Scene-aware Reading** may be closed by this ADR chain once Accepted; SPEC/RC1 text updates remain downstream and out of this ADR’s body.

### ADR-006 / ADR-011

* Discovery scene candidates and Visual Intent/Expression remain **sources** for Scene Context’s narrative and visual creation context; they do not redefine Scene Context identity.
* ADR-011 Expression ownership for visualization intelligence remains; Scene Context **holds** visual creation context for a narrative moment and **projects** Frame representation.

---

## Non Goals

This ADR does **NOT** define:

* database schema
* API contracts
* migration strategy
* Admin UI
* Web UI
* extraction prompt design
* SPEC field inventories
* persistence implementation
* Reading Route removal
* Scene Context as URL/page/routing entity
* changes to Reader Step atom definition

---

## Alternatives Considered

| Alternative | Outcome |
| ----------- | ------- |
| Keep character/location on Reading Route; fix only Extraction attach | Rejected — wrong ownership granularity remains |
| Rename Editorial Scene → Runtime Scene (identity merge) | Rejected — violates ADR-005 Decision 10 |
| Make Reading Frame the ownership boundary | Rejected — Frame is Representation; lacks stable narrative-moment ownership semantics |
| Make Scene Context the new routable page/URL identity in this ADR | Rejected — Architect correction; Route retained as delivery container |
| Remove Reading Route in this ADR | Rejected — requires separate decision |

---

## Consequences

### Positive

* Clear Runtime ownership for appearance, location, and narrative moment (**Scene Context**)
* Clear non-ownership for Reading Route (delivery only) and Reading Frame (visual projection only)
* Preserves Editorial ↔ Runtime layer separation and ADR-005 Decision 10
* Retains Reading Route delivery without a routing redesign in this ADR
* Unblocks Scene Context-aware Reading without accepting Editorial Scene-centric Reading

### Negative / costs

* Runtime ownership story is a version transition relative to v1
* Downstream artifacts must align vocabulary (Route vs Scene Context) — Vocabulary Debt remains
* Non-authoritative legacy Route-held appearance/location data become an architectural debt until a later governed change (not designed here)

---

## Open Questions

Architectural open points only (no implementation design):

1. Whether a future ADR may authorize Scene Context addressing **without** changing Reading Route as delivery projection — **not** authorized here.
2. Sequencing of downstream SPEC-RDX-001 / RC1 wording updates after this ADR is Accepted — process, not schema.
3. Cardinality expectations for association/projection chains — deferred to SPEC; not frozen here.

---

## Review Criteria (Draft Gate)

### Must NOT happen

* ❌ Scene Context becomes Editorial Scene rename  
* ❌ Scene Context becomes Frame rename  
* ❌ Scene Context becomes URL/page entity decision in this ADR  
* ❌ Reading Route removed without a separate decision  

### Must happen

* ✅ Scene Context ownership boundary clear  
* ✅ Story / Reading Route boundary clear (Route = delivery only)  
* ✅ Reading Frame boundary clear (visual projection; no narrative ownership)  
* ✅ Editorial identity preserved (D10; no rename to Scene Context)  
* ✅ ADR-004 / 005 / 007 relationship clear; RDX framed as terminology correction  
* ✅ Implementation details excluded  

---

## Legacy Alias Reference

| Normative Term | Legacy / Implementation Term | Classification | Status |
| -------------- | ---------------------------- | -------------- | ------ |
| Reading Route | `scenes` table row; product “故事” delivery unit | Implementation Alias | Active — **ownership reduced** by this ADR |
| Reading Frame | `story_images_v2[]` element; Story Image | Implementation Alias | Active — visual projection only |
| Scene Context | *(none stable)* | New Runtime term | Draft — must not alias to Editorial Scene or Frame |
| Editorial Scene | Discovery `candidateType: "scene"`; Approved Scene unit | Editorial Domain | Active — association source only |
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
