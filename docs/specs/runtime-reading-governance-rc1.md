# Runtime Reading Governance RC1

## 1. Status

| Field | Value |
| ----- | ----- |
| **Capability** | Runtime Reading |
| **Version** | **RC1** |
| **State** | **Release Candidate** |
| **Date** | 2026-07-11 |
| **Authority repository** | `raree-show-admin` |

Runtime Reading Governance RC1 is the official governance release baseline for **baseline Reader Step** implementation. It consolidates accepted architecture and SPEC artifacts without introducing new architectural decisions.

---

## 2. Accepted Architecture

The following governance artifacts are **Accepted** under RC1:

| Artifact | Role |
| -------- | ---- |
| **ADR-005 v2.0** | Editorial Story / Scene ontology; NIM-INV-06 progression authority |
| **ADR-007 v1.2** | Projection architecture; Rollout closure at Reading Route |
| **ADR-008 v1.1** | Runtime vocabulary convergence |
| **ADR-009 v1.2** | Vocabulary layer separation; Reader Step (Layer 5) |
| **SPEC-ROL-001** | Governed Projection — operator execution (Implemented) |
| **SPEC-ROL-002 v1.0** | Editorial Scene Projection Semantics — projection-only |
| **SPEC-RDX-001 v1.3** | Runtime Reading Experience — sole capability authority |

Supporting (inherited, not redefined by RC1):

- **ADR-004** — Runtime Truth v1 topology
- **SPEC-CORE-001** — Runtime Representation field shapes

---

## 3. Web Realization

Web documents **realize** Runtime Reading capability. They **do not own** Runtime Reading capability.

| Document | Repository | Role |
| -------- | ------------ | ---- |
| **W-01 v2.1** | `raree-show-web` | Browser Runtime Specification — client orchestration |
| **runtime-architecture.md v2.1** | `raree-show-web` | Implementation architecture under W-01 + SPEC-RDX-001 |

Capability semantics MUST be resolved in `raree-show-admin` (SPEC-RDX-001). Web documents cite — never redefine — Reader Step, lifecycle, invariants, or capability ownership.

---

## 4. Deferred Capability

The following remain **explicitly deferred** beyond RC1 **unless marked Authorized**.
 Authorization means **architecture decision completed** — **not** implementation complete.
 No implementation discussion in this document.

| Deferred item | Notes |
| ------------- | ----- |
| **Scene-aware Reading** | **Authorized by ADR-012** (architecture decision completed). Scene Context is Runtime ownership boundary; Scene Context-aware Reading accepted under SPEC-RDX-001 v1.4 terminology correction. Implementation / operational SPEC remain downstream. |
| **Frame Narrative Consumption Policy** | caption rendering, fallback rules — Implementation / Presentation SPEC |
| **Cross-session Resume** | Progress persistence semantics beyond RDX-3 capability layer |
| **SceneProjectionLink Consumption** | **Authorized by ADR-012** as architecture for association/projection consumption path (Editorial Scene → Scene Context → Reading Frame). Historical link-table shapes are not re-authorized; operational SPEC remains downstream. **Not** implementation complete. |
| **Future Presentation Specification** | Rendering, animation, visual composition (Implementation) |
| **ROL-002 Open Questions** | OQ-ROL2-P01 ~ P06 — projection mapping details; deferred to implementation phase |
| **Cross-Route Session Policy** | SPEC-RDX-001 RDX-5 handoff — deferred |

RC1 **does not** block baseline **Reader Step** (frame-centric) implementation within an existing Reading Route.

**Amendment (2026-08-05):** ADR-012 Governance Closure Pass — Scene-aware Reading and association/projection consumption path marked **Authorized by ADR-012** (decision complete ≠ shipped).

---

## 5. Release Statement

Runtime Reading governance is considered **architecturally complete for baseline Reader Step implementation**.

Future governance work **extends** this capability — it does **not** reopen accepted architectural decisions in ADR-005, ADR-007, SPEC-ROL-002, or SPEC-RDX-001 without explicit amendment.

---

## 6. Dependency Graph

```text
Constitution
     ↓
ADR-005 v2.0
     ↓
ADR-007 v1.2
     ↓
SPEC-ROL-001 (Implemented)
     ↓
SPEC-ROL-002 (Accepted)
     ↓
SPEC-RDX-001 (Accepted)
     ↓
Runtime Reading Governance RC1  ◄── this document
     ↓
W-01 (raree-show-web)
     ↓
runtime-architecture.md (raree-show-web)
     ↓
Implementation (src/)
```

**One-way authority:** No reverse dependency. Web and implementation MUST NOT amend admin capability semantics.

---

## 7. Refs

```text
docs/specs/spec-rol-001-governed-projection.md
docs/specs/spec-rol-002-projection-semantics.md
docs/specs/spec-rdx-001-runtime-reading-experience.md
docs/specs/runtime-reading-governance-rc1-release-report.md
raree-show-web/docs/specs/w-01-visibility-synchronized-navigation.md
raree-show-web/docs/runtime-architecture.md
```
