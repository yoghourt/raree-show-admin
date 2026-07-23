# SPEC-CPP-001 — Creator Production Pipeline (Responsibility Boundaries)

## Metadata

| Field | Value |
| ----- | ----- |
| Title | Creator Production Pipeline — Responsibility Boundaries |
| Status | **Accepted** — Contract Freeze (responsibility boundaries only) |
| Spike Implementation Authorization | **Conditionally Granted** — MVP only · Gates A–F (this SPEC §0a) |
| Production Authorization | **Not granted** (MVP is scoped Creator tooling; not a broad Production Authorization expansion) |
| Version | v0.2 |
| Owner | Architect |
| Last Updated | 2026-07-23 |
| Accepted | Architect · 2026-07-21 |
| MVP Grant | Architect · 2026-07-23 · Conditional |
| Derived From | SPIKE-CPP-001 (Architect Accepted · Direction **B+**) · operational production-workflow evidence (2026-07-21) · ADR-010 (Creator ⊥ Reader; Assets / Accept posture) |
| Does not amend | ADR-010 Port shape · Discovery SPECs · Rollout SPECs · Deployment Defaults |

---

## 0. Three-State Authorization (normative)

| State | SPEC-CPP-001 |
| ----- | ------------ |
| Contract Freeze | **Yes** — responsibility boundaries only (this SPEC Accepted) |
| Spike Implementation Authorization | **Conditionally Granted** — MVP scope + Gates A–F (see §0a) |
| Production Authorization | **Not granted** |

Contract Freeze alone does not authorize implementation. The Conditional MVP grant
authorizes only the scoped surfaces listed in §0a. Gate violation suspends implementation.

### 0a. Conditional MVP grant (Gates A–F)

Architect Decision 2026-07-23. Violation of any gate suspends implementation.

| Gate | Rule |
| ---- | ---- |
| **A** | Execution is never Authority — Jobs never become Runtime Truth |
| **B** | Execution never owns Lifecycle — Job success must not auto-complete Task/Work |
| **C** | Assets only Runtime Truth — Tasks derived; no editable Task authority |
| **D** | Infrastructure replaceable — no queue/engine as Runtime |
| **E** | Human Acceptance remains business boundary into Assets |
| **F** | No irreversible architecture — no Workflow Engine / Task Graph / Queue Framework in MVP |

MVP scope only: Work Production Board (UI) · Production Context · Batch Frame Completion · Accept→Save portrait simplification · Derived Production Tasks.

Bootstrap regression pre-merge checks (all must be **No**): Execution owns Authority? Execution owns Lifecycle? Infrastructure becomes Runtime? Second Runtime Truth appeared?

---

## 1. Purpose

Freeze the **Runtime responsibility boundaries** for Creator Production Pipeline (CPP) under Direction **B+**:

```text
Work
  → Production Plan
    → Derived Production Tasks
      → Jobs
        → Deployment Adapter
          → Assets
```

This SPEC defines **what each layer is responsible for** and **what it MUST NOT own**.

It does **not** define database schema, APIs, UI, providers, queues, or implementation algorithms.

---

## 2. Layer classification

| Content in this SPEC | Layer |
| -------------------- | ----- |
| Work / Production Plan / Production Task / Job responsibilities | Architecture / Runtime Contract |
| Assets as sole Runtime Truth; Tasks as projections | Architecture / Runtime Contract |
| Discovery ⊥ Rollout ⊥ CPP (sibling capabilities) | Architecture / Runtime Contract |
| Deployment Adapter under Job execution only | Architecture layering (compatible with ADR-010) |
| Schema, endpoints, board UI, Job queue, completeness predicates detail | **Forbidden here** — later SPEC / Implementation grant |
| Local vs Cloud defaults, models, USD | **Forbidden here** → Deployment Defaults |

---

## 3. Architecture invariants

1. **CPP-INV-01 — Assets are Runtime Truth.** Canonical story content and accepted media live in **Assets**. Production Plans and Production Tasks MUST NOT become a second source of truth for asset fields (e.g. `portrait_url`, `story_images_v2` captions/urls).
2. **CPP-INV-02 — Tasks are projections.** Production Tasks MUST be **derived from Assets** (and Plan completion definition) whenever possible. Correct flow is `Assets → Derived Tasks`, not `Task → mutate Asset as authority`.
3. **CPP-INV-03 — Plan ≠ Task ≠ Job.**  
   - **Production Plan** owns how a Work reaches completion (definition, progress, checklist, strategy, overall completion state).  
   - **Production Task** owns the next actionable unit.  
   - **Job** owns execution only (infrastructure), not business progress.
4. **CPP-INV-04 — Deployment stays under Jobs.** Local / Cloud (or any provider) binding MUST occur at **Job** execution via Deployment Adapter. Plans and Tasks MUST remain Deployment-agnostic. Changing Local ↔ Cloud MUST NOT rewrite Plans or Tasks.
5. **CPP-INV-05 — Sibling capabilities.** Discovery, Rollout, and CPP are **independent** Creator capabilities:  
   - Discovery: what belongs (Candidates → human gate)  
   - Rollout: persist narrative structure  
   - CPP: drive a Work from incomplete → complete per its Production Plan  
   CPP MUST NOT absorb Discovery propose/review or Rollout persist semantics.
6. **CPP-INV-06 — Reader outside CPP.** Reader Runtime consumes published Assets only. CPP MUST NOT place generation or Plan state on the Reader hot path (aligned with ADR-010 Creator ⊥ Reader).
7. **CPP-INV-07 — UI is not Runtime.** A “Production Board” (or similar) MAY visualize a Production Plan. Architecture names and contracts refer to **Production Plan**, not to board UI.

---

## 4. Capability context (non-normative narration)

```text
Discovery          →  what belongs
Rollout            →  narrative structure persisted
CPP                →  Work incomplete → complete (via Plan)
Assets             →  canonical truth (always)
Reader Runtime     →  consume Assets
```

Ordering above is a typical operator path, not a hard runtime call graph. Capabilities remain independently evolvable.

---

## 5. Responsibility contracts

### 5.1 Work

| | |
| - | - |
| **Is** | Product-level deliverable. Represents **what** must be completed for the operator’s production goal. |
| **Responsible for** | Identity of the deliverable; association to its Assets; being the parent of at most one active Production Plan intent for a given completion campaign (cardinality of plans is an implementation concern — not frozen here). |
| **MUST NOT** | Own completion checklist mechanics, task scheduling, Job execution, or Deployment bindings. |
| **Progress** | Work is complete when its **Production Plan** reports completion — not when a single Task or Job finishes. |

### 5.2 Production Plan

| | |
| - | - |
| **Is** | Runtime object that represents **how a Work reaches completion**. |
| **Responsible for** | Completion definition; production checklist; progress; production strategy; overall completion state; production metrics scoped to that completion effort. |
| **MUST NOT** | Store canonical Asset payloads; encode Local/Cloud; act as a Job runner; replace Discovery Candidates or Rollout write semantics; be defined as a UI board. |
| **Relation** | Belongs to a Work. Spawns / accounts for Derived Production Tasks. Progress is a function of completion definition vs Asset truth (and task outcomes only insofar as they reflect Asset state). |

### 5.3 Production Task

| | |
| - | - |
| **Is** | Next **actionable** unit of production work under a Production Plan. |
| **Responsible for** | Representing actionable work (e.g. Complete Character, Fill Frames, Review Assets); targeting Asset refs; exposing actionable state for operators or automation triggers. |
| **MUST NOT** | Be the canonical store of Asset fields; own Work-level progress/checklist/strategy (those belong to Plan); bind Deployment providers; be confused with Jobs. |
| **Derivation** | MUST be derived from Assets (+ Plan completion definition) whenever possible. Explicit non-derived tasks (e.g. pure review gates) MAY exist but MUST NOT duplicate Asset authority. |

### 5.4 Job

| | |
| - | - |
| **Is** | **Execution** of a capability (infrastructure). |
| **Responsible for** | Running an operation such as Generate Portrait, Upload Batch, or other authorized capability invokes; selecting Deployment Adapter binding at run time; reporting execution success/failure. |
| **MUST NOT** | Represent business progress of a Work; own completion definition; schedule the production board; leak provider identity upward into Plan/Task identity. |
| **Relation** | Invoked in service of a Production Task (or equivalent authorized trigger). Outcomes converge into **Assets** (after required Human Accept where policy demands). |

### 5.5 Assets (referenced, not redefined)

| | |
| - | - |
| **Is** | The only Runtime Truth for persisted story content and accepted media. |
| **Responsible for** | Canonical fields consumed by Reader and by completeness predicates. |
| **MUST NOT** | Be bypassed by treating Plan/Task rows as published content. |

Human Accept into Assets (where required, e.g. portrait Accept posture under ADR-010) remains a Creator gate. Jobs MAY produce drafts; Assets hold accepted truth.

### 5.6 Deployment Adapter (referenced)

| | |
| - | - |
| **Participates** | Only beneath Job execution. |
| **MUST NOT** | Appear in Production Plan or Production Task identity or completion definition. |

---

## 6. Forbidden collapses

The following collapses are **non-conformant** with this SPEC:

| Collapse | Why forbidden |
| -------- | ------------- |
| Task as Asset authority | Violates CPP-INV-01 / INV-02 |
| Plan stores portrait URLs / frame urls as truth | Violates CPP-INV-01 / Plan MUST NOT |
| Task encodes Local vs Cloud | Violates CPP-INV-04 |
| Job completion ⇒ Work complete | Violates Plan ownership of completion |
| “Production Board” as Architecture object | Violates CPP-INV-07 |
| CPP owns Discovery Accept-All or Rollout persist | Violates CPP-INV-05 |
| Reader depends on Plan/Task/Job | Violates CPP-INV-06 |

---

## 7. Explicitly deferred (MUST NOT freeze here)

* Database tables, columns, or projection algorithms  
* HTTP/API shapes  
* UI layouts (including any Production Board)  
* Job queue / worker topology  
* Concrete completeness predicate lists (showcase vs lean) — belong to Plan configuration / later SPEC  
* Scene-frame AI generation authorization (still outside ADR-010 A3 unless newly granted)  
* Workflow engines or Comfy-style graphs as CPP OS  

---

## 8. Relationship to MVP (informative)

SPIKE-CPP-001 ROI order remains informative for a future implementation grant:

1. Production Plan (completion definition + progress)  
2. Derived Production Tasks  
3. Incomplete-frame fill via Jobs (e.g. batch upload)  
4. Character-complete shortcuts  
5. Non-blocking portrait Jobs  

That order is **not** authorization.

---

## 9. Acceptance criteria for this SPEC

Architect may Accept (Contract Freeze of boundaries) when:

- [x] Work / Production Plan / Production Task / Job responsibilities are agreed as written  
- [x] Assets-as-truth and Task-as-projection invariants are agreed  
- [x] Deployment-under-Job and Discovery ⊥ Rollout ⊥ CPP are agreed  
- [x] No schema/API/UI leaked into this freeze  

**Accepted:** Architect · 2026-07-21  

Implementation authorization remains a **separate** decision.

---

## 10. Document history

| Version | Date | Note |
| ------- | ---- | ---- |
| v0.1 | 2026-07-21 | Draft from Architect Review of SPIKE-CPP-001 (Direction B+) |
| v0.1 | 2026-07-21 | **Accepted** — Contract Freeze (boundaries only); implementation not authorized |
| v0.2 | 2026-07-23 | Conditional MVP Implementation Authorization (Gates A–F); Constitution axiom noted |
