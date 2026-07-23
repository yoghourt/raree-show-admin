# Authorization — CPP MVP (Conditional)

**Status:** Conditionally Authorized  
**Date:** 2026-07-23  
**Authority:** Architect Decision  
**Depends on:** SPEC-CPP-001 (Accepted) · SPIKE-CPP-001 (B+) · `review-cpp-bootstrap-regression.md`

---

## Grant

CPP **MVP implementation** is Conditionally Authorized under Gates A–F below.

Violation of any gate **suspends** implementation and requires Architect review.
Do not work around a gate.

---

## Constitutional binding

Axiom (Constitution §4) — **source of truth is `raree-governance`**, not the
admin `governance/` submodule working tree:

> Execution, Authority, and Lifecycle must remain independent. Runtime Truth
> emerges only through controlled business transitions, never directly from
> execution.

After merging in `raree-governance`, bump/sync the admin submodule
(`npm run bootstrap` / governance sync). Do **not** edit `raree-show-admin/governance/` as the authority.

---

## Gates (implementation)

| Gate | Rule |
| ---- | ---- |
| **A** | Execution is never Authority — Jobs never become Runtime Truth |
| **B** | Execution never owns Lifecycle — Job success must not auto-complete Task/Work |
| **C** | Assets only Runtime Truth — Tasks derived; no editable Task authority |
| **D** | Infrastructure replaceable — no queue/engine as Runtime |
| **E** | Human Acceptance remains business boundary into Assets |
| **F** | No irreversible architecture — no Workflow Engine / Task Graph / Queue Framework in MVP |

---

## MVP scope (only)

1. Work Production Board (UI over Production Plan progress)  
2. Production Context (work-scoped derived view)  
3. Batch Frame Completion  
4. Accept → Save workflow simplification (portrait)  
5. Derived Production Tasks (computed; not stored as authority)

Anything beyond requires separate Architect review.

---

## Bootstrap Regression Rule (pre-merge)

Before merge, verify all answers are **No**:

* Does Execution own Authority?  
* Does Execution own Lifecycle?  
* Does Infrastructure become Runtime?  
* Has a second Runtime Truth appeared?  

---

## Non-authorization

This grant does **not** authorize scene-frame AI generation, durable Task/Job
authority tables, or Discovery/Rollout redesign.
