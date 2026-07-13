# Governance Release Report — Runtime Reading RC1

## Metadata

| Field | Value |
| ----- | ----- |
| **Release** | Runtime Reading Governance RC1 |
| **Date** | 2026-07-11 |
| **Mode** | Documentation only — no architecture redesign |
| **Repositories** | `raree-show-admin`, `raree-show-web` |

---

## 1. SPEC-ROL-002 Promotion Result

**Result: ACCEPTED → v1.0**

| Check | Outcome |
| ----- | ------- |
| Open Questions remain projection-only (OQ-ROL2-P01 ~ P06) | Pass |
| No drift vs ADR-005 v2.0 | Pass |
| No drift vs ADR-007 v1.2 | Pass |
| No drift vs SPEC-RDX-001 v1.2/v1.3 | Pass |
| Story ↔ Reading Route semantics projection-only | Pass |
| Editorial Scene never a Runtime entity | Pass |
| No Runtime Reading capability leakage | Pass |

**Status change:** Draft v0.2 → **Accepted v1.0** (RC1 promotion; no semantic change).

**Acceptance criteria:** ROL2-DAC-01 ~ ROL2-DAC-06 all satisfied.

---

## 2. SPEC-RDX-001 Wording Alignment Summary

**Result: v1.2 → v1.3 (wording only)**

| Before | After |
| ------ | ----- |
| Rendering policy → W-01 / downstream web SPEC | Rendering policy → **Implementation / Presentation** |
| Visual composition, Animation, Media presentation → W-01 | → **Implementation / Presentation** |
| Frame Narrative rendering policy → W-01 | → **Implementation / Presentation** (downstream web SPEC) |
| Navigation mechanics → W-01 / implementation | Browser navigation orchestration → **W-01** (orchestration only) |

**Unchanged:** Capability semantics, Reader Step, lifecycle, invariants, ownership.

Aligns admin SPEC with W-01 v2.1 (rendering excluded from browser spec).

---

## 3. Runtime Reading RC1 Release Document

**Created:** `docs/specs/runtime-reading-governance-rc1.md`

Official governance release baseline consolidating Accepted artifacts, web realization references, deferred capability list, and dependency graph.

---

## 4. Navigation Updates

| Location | Update |
| -------- | ------ |
| `raree-show-admin/AGENTS.md` | Runtime Reading Governance RC1 baseline entry |
| `docs/specs/spec-rdx-001-runtime-reading-experience.md` | Refs RC1; ROL-002 Accepted; rendering owner wording |
| `docs/specs/spec-rol-002-projection-semantics.md` | Accepted v1.0; RC1 in Related |
| `raree-show-web/docs/specs/w-01-visibility-synchronized-navigation.md` | RC1 baseline reference |
| `raree-show-web/docs/runtime-architecture.md` | RC1 baseline reference |

---

## 5. Final Dependency Graph

```text
Constitution
     ↓
ADR-005 v2.0 ── ADR-007 v1.2 ── ADR-008 ── ADR-009
     ↓
SPEC-ROL-001 (Implemented)
     ↓
SPEC-ROL-002 (Accepted v1.0)
     ↓
SPEC-RDX-001 (Accepted v1.3)
     ↓
Runtime Reading Governance RC1
     ↓
W-01 (raree-show-web — Accepted v2.1)
     ↓
runtime-architecture.md (raree-show-web — Accepted v2.1)
     ↓
Implementation (src/)
```

No reverse dependency.

---

## 6. Remaining Deferred Capabilities (Informational)

| Item | Blocks baseline Reader Step? |
| ---- | ---------------------------- |
| Scene-aware Reading | No |
| Frame Narrative Consumption Policy | No (baseline uses existing frames) |
| Cross-session Resume | No (deferred semantics) |
| SceneProjectionLink Consumption | No (graceful absence per RDX-RS-06) |
| Future Presentation SPEC | No |
| ROL-002 OQ-ROL2-P01 ~ P06 | No (implementation-phase projection details) |
| Cross-Route Session Policy | No |

---

## 7. Acceptance Criteria Verification

| Criterion | Status |
| --------- | ------ |
| SPEC-ROL-002 Accepted | ✅ |
| SPEC-RDX-001 wording aligned with W-01 | ✅ |
| Runtime Reading Governance RC1 created | ✅ |
| Navigation reflects RC1 baseline | ✅ |
| No new architecture decisions | ✅ |
| Runtime Reading capability ownership in admin only | ✅ |
| Web remains downstream realization | ✅ |

**Release verdict: RC1 CLOSED — baseline Reader Step implementation may proceed.**
