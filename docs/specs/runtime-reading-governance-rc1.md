# Runtime Reading Governance RC1

## 1. Status

| Field | Value |
| ----- | ----- |
| **Capability** | Runtime Reading |
| **Version** | **RC1** |
| **State** | **Accepted** (amendment incorporated — governance owner path confirmed) |
| **Base State** | Release Candidate (2026-07-11) |
| **Date** | 2026-08-07 |
| **Authority repository** | `raree-show-admin` |

> **Amendment (2026-08-07) — Accepted:** Aligns RC1 deferred table with ADR-012 + SPEC-SCC-001 v0.2 + downstream RDX/ROL amendments. Closes **Scene-aware Reading deferred** as architecture authorization for **Scene Context-aware Reading**. Does **not** authorize Editorial Scene-centric Reading, Scene Context addressing, or Scene Context production implementation (Spike Authorization is separate).

Runtime Reading Governance RC1 is the official governance release baseline for **baseline Reader Step** implementation. It consolidates accepted architecture and SPEC artifacts without introducing new architectural decisions beyond those already Accepted in ADR-012 / SPEC-SCC-001.

---

## 2. Accepted Architecture

The following governance artifacts are **Accepted** under RC1:

| Artifact | Role |
| -------- | ---- |
| **ADR-005 v2.0** | Editorial Story / Scene ontology; NIM-INV-06 progression authority |
| **ADR-007 v1.2** | Projection architecture; Story ↔ Reading Route delivery association |
| **ADR-008 v1.1** | Runtime vocabulary convergence |
| **ADR-009 v1.2** | Vocabulary layer separation; Reader Step (Layer 5) |
| **ADR-012** | Scene Context Runtime Boundary — ownership boundary for narrative moments |
| **SPEC-SCC-001 v0.2** | Scene Context Contract — semantic ownership / producer-consumer contract |
| **SPEC-ROL-001** | Governed Projection — operator execution (Implemented) |
| **SPEC-ROL-002 v1.2** | Editorial Scene Projection Semantics — projection-only (Scene Context chain) |
| **SPEC-RDX-001 v1.5** | Runtime Reading Experience — sole capability authority (Scene Context-aware Reading) |

Supporting (inherited, not redefined by RC1):

- **ADR-004** — Runtime Truth v1 topology (delivery: Work → Reading Route → Reading Frame)
- **SPEC-CORE-001** — Runtime Representation field shapes

### Normative identity / ownership (inherited — not redefined)

```text
Editorial Scene ≠ Scene Context ≠ Reading Frame ≠ Story ≠ Reading Route
```

```text
Character appearance → Scene Context
Location context     → Scene Context
Narrative moment     → Scene Context
Image asset          → Reading Frame
Delivery             → Reading Route
```

---

## 3. Web Realization

Web documents **realize** Runtime Reading capability. They **do not own** Runtime Reading capability.

| Document | Repository | Role |
| -------- | ------------ | ---- |
| **W-01 v2.1** | `raree-show-web` | Browser Runtime Specification — client orchestration |
| **runtime-architecture.md v2.1** | `raree-show-web` | Implementation architecture under W-01 + SPEC-RDX-001 |

Capability semantics MUST be resolved in `raree-show-admin` (SPEC-RDX-001). Web documents cite — never redefine — Reader Step, lifecycle, invariants, or capability ownership.

Web Reader consumes Scene Context through **Runtime delivery projections**, not Editorial production objects. Scene Context ≠ URL/page routing identity.

---

## 4. Deferred Capability

The following remain **explicitly deferred** beyond RC1 **unless marked Closed / Authorized**.
 Authorization means **architecture decision completed** — **not** implementation complete.
 No implementation discussion in this document.

| Item | Status | Notes |
| ---- | ------ | ----- |
| **Scene Context-aware Reading** | **Closed (authorized)** | Scene Context-aware Reading authorized by ADR-012. Editorial Scene-centric Reading remains rejected. Implementation remains governed by RDX contract. |
| **Editorial Scene-centric Reading** | **Rejected (not deferred)** | Editorial Scene as Runtime consumption unit remains forbidden (ADR-005 Decision 10; ADR-012; SPEC-RDX-001). |
| **Frame Narrative Consumption Policy** | Deferred | caption rendering, fallback rules — Implementation / Presentation SPEC |
| **Cross-session Resume** | Deferred | Progress persistence semantics beyond RDX-3 capability layer |
| **Scene Context association / projection consumption path** | **Authorized (architecture)** | Editorial Scene → association → Scene Context → projection → Reading Frame (ADR-012). Historical link-table shapes are not re-authorized; operational SPEC remains downstream. **Not** implementation complete. |
| **Scene Context addressing** | Deferred — **not authorized** | ADR-012 Open Question; RC1 / RDX amendments do **not** grant URL/page identity |
| **Future Presentation Specification** | Deferred | Rendering, animation, visual composition (Implementation) |
| **ROL-002 Open Questions** | Deferred | Projection mapping / operational details; cardinality and persistence not frozen by Draft Amendments |
| **Cross-Route Session Policy** | Deferred | SPEC-RDX-001 RDX-5 handoff |

### Required wording (Scene-aware closure)

```text
Scene Context-aware Reading authorized by ADR-012.

Editorial Scene-centric Reading remains rejected.

Implementation remains governed by RDX contract.
```

RC1 **does not** block baseline **Reader Step** implementation within an existing Reading Route delivery.

**Prior note (2026-08-05):** ADR-012 Governance Closure Pass initially marked Scene-aware Reading authorized. This amendment **closes** the deferred item under the precise Scene Context terminology above and rejects Editorial Scene Runtime adoption.

---

## 5. Release Statement

Runtime Reading governance is considered **architecturally complete for baseline Reader Step implementation**.

Scene Context Runtime Boundary (ADR-012) and Scene Context Contract (SPEC-SCC-001) are **Accepted** architecture/contract authorities. Downstream RDX / ROL amendments are **Accepted** and align Reader and Projection contracts; they do **not** reopen Accepted ADR decisions.

Future governance work **extends** this capability — it does **not** reopen accepted architectural decisions in ADR-005, ADR-007, ADR-012, SPEC-SCC-001, SPEC-ROL-002, or SPEC-RDX-001 without explicit amendment.

---

## 6. Dependency Graph

```text
Constitution
     ↓
ADR-005 v2.0
     ↓
ADR-007 v1.2
     ↓
ADR-012 + SPEC-SCC-001
     ↓
SPEC-ROL-001 (Implemented)
     ↓
SPEC-ROL-002 v1.2 (Accepted)
     ↓
SPEC-RDX-001 v1.5 (Accepted)
     ↓
Runtime Reading Governance RC1  ◄── this document (Accepted amendment)
     ↓
W-01 (raree-show-web)
     ↓
runtime-architecture.md (raree-show-web)
     ↓
Implementation (src/)
```

**One-way authority:** No reverse dependency. Web and implementation MUST NOT amend admin capability semantics.

---

## 7. Review Gate (Accepted)

### Architecture

- [x] RDX supports Scene Context-aware Reading (via SPEC-RDX-001 v1.5)
- [x] Editorial Scene-centric Reading remains rejected
- [x] Reader Step remains consumption atom

### Projection

- [x] ROL chain passes through Scene Context (via SPEC-ROL-002 v1.2)
- [x] Frame remains visual representation only

### Governance

- [x] RC1 Scene-aware deferred formally closed as Scene Context-aware Reading authorized
- [x] Context addressing not authorized
- [x] Implementation details not frozen
- [x] Amendments Accepted (governance owner path confirmed)
- [x] Production Implementation of Scene Context remains **not** authorized (Spike-only)

### Forbidden drift check

- [x] No Route owns character_ids (narrative ownership)
- [x] No Frame owns scene meaning
- [x] No Editorial Scene becomes Runtime Scene
- [x] No Scene Context becomes URL identity

---

## 8. Refs

```text
docs/adr/012-scene-context-runtime-boundary.md
docs/specs/spec-scc-001-scene-context-contract.md
docs/specs/spec-rol-001-governed-projection.md
docs/specs/spec-rol-002-projection-semantics.md
docs/specs/spec-rdx-001-runtime-reading-experience.md
docs/specs/runtime-reading-governance-rc1-release-report.md
raree-show-web/docs/specs/w-01-visibility-synchronized-navigation.md
raree-show-web/docs/runtime-architecture.md
```
