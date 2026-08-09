# IMPLEMENT-SCC-001 — Level 2 Controlled Expansion (Option A)

**Status:** **Authorized** · 2026-08-08  
**Authority:** Architect Instruction — Authorize A (post IMPLEMENT-SCC-001-S1 Result Review PASS)  
**Prerequisite:** `docs/spikes/implement-scc-001-s1-result-review.md` — PASS · Architecture Stable

---

## Decision

```text
Proceed with controlled Context-aware projection expansion
```

Scene Context is accepted as a Runtime-consumable capability boundary on Runtime Truth v1 delivery. Level 2 may continue under controlled enablement. **Level 3 is not authorized.**

---

## What is authorized

| Grant | Meaning |
| ----- | ------- |
| S1 path in production-adjacent envs | May enable `SCENE_CONTEXT_PROJECTION_ENABLED` per environment |
| Work-scoped rollout | Prefer `SCENE_CONTEXT_WORK_ALLOWLIST` for staged expansion |
| Coexistence | Legacy Hot Path remains rollback via flag off |
| Follow-on Level 2 slices | May be proposed under separate slice IDs (e.g. S2) within denylist |

Additive `scene_contexts_v1` storage remains the S1 representation; this grant does **not** freeze persistence architecture forever.

---

## What remains forbidden

```text
❌ Level 3 Full Migration
❌ Delete Route character_ids / location_id
❌ Reader URL / navigation redesign
❌ Scene Context URL/page identity
❌ Admin information-architecture redesign
❌ Schema finalization / persistence architecture freeze
❌ Restore SceneProjectionLink as authority
❌ Unbounded “implement all Context” without slice grant
```

---

## Controlled expansion posture

```text
Default: flag OFF (safe rollback)

Expansion steps (ops):
1. Migration applied in target env
2. Allowlist one Work → enable flag → verify Projection Accept
3. Widen allowlist or clear allowlist only after evidence
```

Code expansion beyond S1 still requires a **named next slice** before non-allowlisted product surface work.

### Named follow-on slices (batch-attach pollution track)

| Slice | Doc | Status |
| ----- | --- | ------ |
| Problem framing | `docs/spikes/adr-012-batch-attach-pollution-resolution.md` | Normative explanation |
| **L2-A** Context ownership authority (stop Accept→Route batch attach) | `docs/spikes/implement-scc-001-l2a-context-ownership-authority.md` | **PASS · Verified** |
| **L2-B** UI aggregate from Context / child scenes | `docs/spikes/implement-scc-001-l2b-ui-context-aggregate.md` | **PASS · Verified** |
| **L2-C** Propose→Context candidate signals | `docs/spikes/implement-scc-001-l2c-propose-context-signals.md` | **PASS · Verified** |
| **L3** Route ownership sunset (program) | `docs/spikes/implement-scc-001-level3-route-ownership-sunset.md` | **GRANTED** · L3-A PASS · L3-B implemented · L3-C pending |
| **L3-B** Historical Context backfill | `docs/spikes/implement-scc-001-l3b-historical-context-backfill.md` | **Implemented** · awaiting human verification |

Rejected: Accept/UI heuristic filter that keeps Story/Route as ownership (short-term D1).

---

## Refs

```text
docs/spikes/implement-scc-001-s1-result-review.md
docs/spikes/implement-scc-001-s1-context-aware-projection.md
docs/spikes/adr-012-batch-attach-pollution-resolution.md
docs/spikes/implement-scc-001-l2a-context-ownership-authority.md
docs/spikes/implement-scc-001-l2b-ui-context-aggregate.md
docs/spikes/implement-scc-001-l2c-propose-context-signals.md
docs/spikes/implement-scc-001-level3-route-ownership-sunset.md
docs/spikes/implement-scc-001-l3b-historical-context-backfill.md
docs/adr/012-scene-context-runtime-boundary.md
docs/specs/spec-scc-001-scene-context-contract.md
config/infra/scene-context-defaults.md
```
