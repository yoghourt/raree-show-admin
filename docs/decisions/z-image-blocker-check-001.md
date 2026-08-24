# Z-IMAGE-BLOCKER-CHECK-001 — Close-out

**Status:** DECIDED  
**Type:** Qualification close-out (not Architecture)  
**Parent:** CREATOR-RENDERER-QUAL-001 · RSD-001  
**Date:** 2026-08-23  
**Production:** NOT AUTHORIZED  
**EVG-001:** HOLD  
**Architecture:** NONE  

---

## Decision

```text
Z-IMAGE-BLOCKER-CHECK-001

Decision:
STOP INVESTMENT

Z-Image-Turbo:
RETAINED AS CANDIDATE
NOT QUALIFIED
NOT DEFAULT

Reason:
Runtime instability:
4/10 success

Named prop instability:
0/4 correct among produced images

Interpretation:
Renderer capability remains historically demonstrated,
but current LocalAI/runtime + visual realization stability
does not meet Raree qualification requirements.

No Architecture impact.
No EVG reopening.
No production change.

Next:
Creator Renderer Candidate Discovery
```

---

## What this does

- Closes Z-Image-Turbo **qualification** investment on the current LocalAI host.
- Leaves RSD-001 **Candidate** membership intact. RCS-001 capability evidence is not withdrawn.
- Does **not** promote to Default, Default Candidate, or production binding.
- Does **not** remove `sd-3.5-medium-ggml` / current `IMAGE_CREATOR_ACCEPT_*` defaults.

## What this does not do

```text
IMAGE_CREATOR_ACCEPT_PROVIDER
IMAGE_CREATOR_ACCEPT_MODEL
Projection
Identity Slot
Renderer Expression
EVG-001
ADR-010 / Architecture
Cloud fallback
Klein observation
```

## Evidence

| Check | Result |
| ----- | ------ |
| RCS-001 capability (historical) | Z-Image realized 青龙偃月刀 on dual-cast frozen prompt |
| QUAL-001 | Remain Candidate; runtime 85%; named prop 70%; single-cast 2/5 CORRECT |
| BLOCKER-001 runtime | Cold 2/5 · Warm 2/5 · **4/10** · UNSTABLE |
| BLOCKER-001 named prop | **0/4 CORRECT** (all GENERIC short green dao) |

Gates unchanged: Runtime ≥95% · Named Prop ≥80%. Not lowered.

Findings: `docs/findings/z-image-blocker-check.md`

---

## Next Authorization

Qualification **STOP INVESTMENT** still holds: do not run more Z-Image qualification generations. Reliability findings are not rewritten as PASS.

**Default selection** is separately decided in RSD-002 (`docs/decisions/rsd-002-z-image-default.md`): Z-Image-Turbo is Creator Local Default as “currently best default”, not as qualification PASS. IMPLEMENT (2026-08-24) switched `IMAGE_CREATOR_ACCEPT_MODEL` to `Z-Image-Turbo`; rollback remains `sd-3.5-medium-ggml`.

```text
Next:
none under BLOCKER-001
See RSD-002 IMPLEMENT (done)

EVG-001:
HOLD

Architecture:
NONE

Production:
SWITCHED (model id only)
```
