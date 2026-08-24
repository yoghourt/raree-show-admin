# RSD-002 — Promote Z-Image-Turbo to Creator Local Default

**Status:** ACCEPTED  
**Type:** Renderer Strategy Decision  
**Parent:** RSD-001  
**Date:** 2026-08-24  
**Owner:** Architect  
**Production configuration:** SWITCHED (2026-08-24)  
**EVG-001:** HOLD  
**Architecture:** NONE / FROZEN  

Evidence: `SPIKE-RCS-001` · `CREATOR-RENDERER-QUAL-001` · `Z-IMAGE-BLOCKER-CHECK-001`

---

## Decision

```text
Decision:
ACCEPT

Creator Local Default:
Z-Image-Turbo

Previous Default:
sd-3.5-medium-ggml

Why:
Z-Image demonstrates superior observed
character identity, named-object realization,
location realization, and cross-work separation.

Known Limitations:
Runtime instability.
Named-prop instability under some compositions.

Production Configuration:
SWITCHED 2026-08-24

Rollback:
sd-3.5-medium-ggml

EVG-001:
HOLD

Architecture:
NONE
```

LocalAI catalog ids (unchanged by this decision): Default `Z-Image-Turbo` · Rollback `sd-3.5-medium-ggml`.

---

## Meaning of Default

```text
Default = currently best default choice
≠ perfect production-grade reliability
≠ QUAL PASS
≠ EVG PASS
≠ Architecture change
```

RSD-001 put Z-Image in the **candidate set**.  
RSD-002 selects it as **Creator Local Default**.  
QUAL-001 / BLOCKER-001 **did not** meet reliability gates. Those findings stay as Known Limitations. They are not rewritten as PASS / Stable / Production-grade.

---

## Renderer roster (decision state)

```text
Creator Local Renderer

DEFAULT
└── Z-Image-Turbo

BASELINE / LEGACY / ROLLBACK
└── SD3.5 Medium (`sd-3.5-medium-ggml`)
    retained; not deleted

UNQUALIFIED / NOT OBSERVED
└── FLUX.2 Klein 4B
```

SD3.5 Medium is demoted to **Baseline / Legacy Renderer**. Keep installed for config-level rollback.

---

## Rationale (observed A/B)

On the frozen RCS/QUAL protocol, Z-Image-Turbo > SD3.5 Medium on Raree’s current Renderer-critical axes:

| Axis | Observation |
| ---- | ----------- |
| Character Identity | Z-Image clearly stronger |
| Named Cultural Object | Z-Image clearly stronger |
| Guan Yu (red face / beard / green robe) | 10/10 in QUAL |
| Green Dragon Crescent Blade | Z-Image can realize correctly; SD3.5 stably collapses to a Western straight sword |
| Han military tent | Z-Image holds |
| Campaign map | Z-Image holds |
| ASOIAF location | Z-Image holds |
| Cross-work separation | Z-Image PASS |

Capability evidence is historical and retained. This decision does **not** claim the reliability gates were met.

---

## Known Limitations (must be preserved)

Do not erase qualification findings because Default was granted.

```text
Named Prop:
7/10 in qualification
0/4 in blocker re-check

Runtime:
85% qualification
40% blocker re-check

Known failure modes:
- single-character side-profile named weapon instability
- Local runtime timeout / fetch failure
```

Forbidden language for this Default:

```text
PASS
Stable
Production-grade
```

QUAL-001 remains **NOT QUALIFIED** on its own gates (Named Prop ≥80%, Runtime ≥95%). RSD-002 does not reopen or lower those gates.

---

## EVG boundary

```text
EVG-001 = HOLD
```

Do not reopen EVG because of RSD-002.

```text
EVG:
Does the visual experience / rule system work?

RSD:
Which renderer is currently the best default?
```

RSD-002 does not change EVG’s result.

---

## Architecture boundary

```text
Architecture = NONE
```

Forbidden by this decision:

- Discovery
- Projection
- Identity Slot
- Renderer Expression
- Scene Context
- Canon
- Work-specific renderer rules

This decision changes only:

```text
Creator Renderer selection
```

---

## Production configuration

**IMPLEMENT — Creator Local Default Switch (2026-08-24)** applied. Scope is model id only.

```text
IMAGE_CREATOR_ACCEPT_PROVIDER   unchanged (localai)
IMAGE_CREATOR_ACCEPT_MODEL      Z-Image-Turbo
IMAGE_CREATOR_ACCEPT_FALLBACK   unchanged
prompt                          unchanged
Renderer Expression             unchanged
Cloud fallback                  unchanged
other production runtime        unchanged
```

Operator binding:

```text
old:
IMAGE_CREATOR_ACCEPT_MODEL=sd-3.5-medium-ggml

new:
IMAGE_CREATOR_ACCEPT_MODEL=Z-Image-Turbo

rollback:
IMAGE_CREATOR_ACCEPT_MODEL=sd-3.5-medium-ggml
```

Deployment note: `config/infra/deployment-defaults.md` (`accept_model` LocalAI Creator Default). Code default for unset `IMAGE_CREATOR_ACCEPT_MODEL` remains provider-agnostic (`sdxl-turbo` for the legacy `local` portrait server) and was not retargeted.

---

## Rollback

Must remain a **configuration** operation, not an Architecture rewrite:

```text
Z-Image-Turbo
        ↓ failure / unacceptable regression
sd-3.5-medium-ggml
```

---

## Relation to prior decisions

| Record | Still true | Superseded |
| ------ | ---------- | ---------- |
| RSD-001 Candidate ACCEPT | Yes | “Candidate ≠ Default” as the live roster |
| QUAL-001 NOT QUALIFIED | Yes (reliability gates) | Next = Candidate Discovery |
| BLOCKER-001 STOP INVESTMENT | Yes (no more Z-Image qualification gens) | “NOT DEFAULT” as live selection; Default is now RSD-002 |

STOP INVESTMENT on **qualification** still holds. This is not a re-test grant.

---

## Status after implementation

```text
IMPLEMENT — Creator Local Default Switch
DONE 2026-08-24

EVG-001:
HOLD

Architecture:
NONE

No further model evaluation under this grant.
```

---

## Refs

- RSD-001: `docs/decisions/rsd-001-creator-local-renderer.md`
- SPIKE-RCS-001: `docs/spikes/spike-rcs-001-local-renderer-capability.md`
- QUAL-001: `docs/findings/creator-renderer-qualification.md`
- BLOCKER-001: `docs/decisions/z-image-blocker-check-001.md`
- BLOCKER findings: `docs/findings/z-image-blocker-check.md`
