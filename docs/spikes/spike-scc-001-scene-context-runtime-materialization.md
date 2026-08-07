# SPIKE-SCC-001 — Scene Context Runtime Materialization

**Status:** Spike Implementation **Authorized** · Evidence **PASS** · Architect Review **PASS — Proceed** (2026-08-07)  
**Production Authorization:** **NOT granted** · Implementation Authorization Proposal next  
**Contract Freeze:** ADR-012 · SPEC-SCC-001 v0.2 · SPEC-RDX-001 v1.5 · SPEC-ROL-002 v1.2  
**Authority:** Architect · Scene Context Contract Closure Report

---

## What

Authorize an **isolated** Minimal Runtime Materialization Spike that validates whether Scene Context can sit on existing Runtime Truth as:

```text
Editorial Source → association → Scene Context → projection → Reading Frame
```

without changing production schema, Web URL, Reader navigation, or Admin UX.

---

## Why

Architecture and contracts are Closed/Accepted. Production Implementation is not authorized. A Spike is required to gather runtime evidence before any SPEC Implementation Authorization.

---

## Authorization states (do not collapse)

| State | This Spike |
| ----- | ---------- |
| Contract Freeze | Granted (ADR-012 / SCC-001 / RDX v1.5 / ROL v1.2 / RC1) |
| **Spike Implementation Authorization** | **GRANTED** |
| Production Authorization | **NOT granted** |

---

## Allowlist (MAY)

| Path / artifact | Purpose |
| --------------- | ------- |
| `scripts/scene-context-spike/**` | In-memory adapter + runner + fixtures + evidence |
| `docs/spikes/spike-scc-001-*.md` | Authorization record |
| `docs/findings/spike-scc-001-*.md` | Findings |
| Temporary spike-only types inside the script tree | Scene Context representation |

---

## Denylist (MUST NOT)

* Production schema / migrations
* Route field removal (`character_ids`, `location_id`, etc.)
* Web URL / Reader navigation changes
* Admin UX redesign
* Restoring `SceneProjectionLink` as authority
* Scene Context URL/page identity
* Changing ADR-012 topology
* Wiring spike adapter into production Rollout/Admin/Web paths

---

## How

1. Fixture Editorial Scene sources shaped like Discovery Scene Candidate staging.  
2. Temporary adapter associates → `SpikeSceneContext`.  
3. Project Context → existing Frame shape `{url, caption}` on Route delivery.  
4. Audit ownership leakage (Route / Frame / Story).  
5. Build ReaderCompatibilityView (Frame + Context overlay) without Reader code changes.  
6. Write Findings; recommend A / B / C.

```bash
./node_modules/.bin/jiti scripts/scene-context-spike/run.ts
```

---

## Findings location

`docs/findings/spike-scc-001-runtime-materialization.md`
