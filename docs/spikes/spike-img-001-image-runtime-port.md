# SPIKE-IMG-001 — Image Runtime Port Spike

**Status:** Spike Implementation **Authorized** · EC-3 **PASS** via SiliconFlow Kontext (2026-07-17)  
**Production Authorization:** **Granted (scoped)** — ADR-010 **A3** · Constraints A–F (2026-07-20); see SPEC-IMG-001 §9a  
**Contract Freeze:** ADR-010 · SPEC-IMG-001 (Accepted)  
**Authority:** Architect · `POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC` §6 (three-state model)

---

## What

Authorize an **isolated** Image Runtime Spike that validates the Image Generation Port, draft/accept adapters, reference-based portrait consistency, and configuration-based provider switching.

This document is the Spike Authorization record and the Findings container.

---

## Why

SPEC-IMG-001 froze contracts without authorizing production code. A Spike was required to gather evidence before Production Authorization. Production Authorization was later granted scoped via ADR-010 **A3** (Constraints A–F).

---

## Authorization states (do not collapse)

| State | This Spike |
| ----- | ---------- |
| Contract Freeze | Already granted via ADR-010 / SPEC-IMG-001 |
| **Spike Implementation Authorization** | **GRANTED** by this document |
| Production Authorization | **GRANTED (scoped)** via ADR-010 **A3** (separate from this Spike; Constraints A–F) |

---

## Goal

Validate:

1. Image Generation Port abstraction  
2. At least one draft provider adapter  
3. At least one accept provider adapter  
4. Reference-based portrait consistency  
5. Deployment switching through configuration  

---

## Allowlist (MAY implement)

| Path / artifact | Purpose |
| --------------- | ------- |
| `lib/ai/image/**` | Port types, factory, spike-only adapters |
| `scripts/**` | Spike runners (e.g. `scripts/spike-img-*.ts`) |
| Temporary spike adapters under `lib/ai/image/**` | draft / accept channels |
| Temporary spike deployment config | env / local config read by spike scripts only (e.g. `IMAGE_SPIKE_*`) |
| `docs/spikes/**` Findings updates | Evidence record |
| Local spike output directories (gitignored) | Images / `report.json` |

---

## Denylist (MUST NOT modify)

* `app/actions/generateCharacterAvatar.ts` (and related production avatar UI wiring)
* Rollout pipeline (`lib/rollout/**`, rollout API routes)
* Discovery pipeline
* Production Copilot / text LLM paths
* Production Budget enforcement (none may be introduced into production paths)
* Reader runtime / `raree-show-web` consumption path
* Database schema / migrations
* Cloudinary production workflow modules used by production actions (spike MAY write local files instead; MUST NOT change production upload contracts)
* Any existing Runtime Truth implementation outside the allowlist

---

## How (methodology)

1. Implement Port + `ImagePortraitProvider` adapters behind config (`draft` vs `accept` strategy ids).  
2. Phase A: draft channel iterates prompts → canonical portrait per sample character.  
3. Phase B: accept channel generates variants with `referenceImages` = canonical.  
4. Switch providers via config only; business/script orchestration must not hard-code vendor SDKs.  
5. Score consistency; record cost vs Budget Policy knob assumptions.  
6. Write Findings below; recommend Proceed to Production **or** Continue Research.

Suggested Deployment bindings for the Spike (replaceable; not frozen):

* `draft_policy` → free-tier channel (see `config/infra/deployment-defaults.md`)
* `accept_policy` → cheap/quality accept channel
* Limits used only inside spike scripts (not production enforcement)

---

## Exit Criteria (all required for Spike Success)

| # | Criterion | Pass condition |
| - | --------- | -------------- |
| EC-1 | Port abstraction | Business/spike orchestration depends only on Port; swapping adapter does not change orchestration code |
| EC-2 | Config switching | Provider/channel switch via Deployment/spike config only |
| EC-3 | Portrait consistency | Agreed threshold: **≥80% of scored variants ≥ 4/5 identity** vs canonical (3 sample characters; ≥6 variants each unless Findings document a justified reduction) |
| EC-4 | Cost vs Budget Policy | Observed Accept count and spend shape match lean Budget Policy assumptions (knobs/`usd_cap` mapping in Deployment Defaults); document variance |
| EC-5 | Production isolation | Diff contains **no** denylist path modifications |

Spike **fails** if any EC fails → recommendation MUST be Continue Research (or scoped re-spike).

---

## Validation

Executed commands:

```bash
IMAGE_SPIKE_DRAFT_PROVIDER=pollinations \
IMAGE_SPIKE_ACCEPT_PROVIDER=siliconflow \
IMAGE_SPIKE_ACCEPT_MODEL=black-forest-labs/FLUX.1-Kontext-dev \
IMAGE_SPIKE_SILICONFLOW_BASE=https://api.siliconflow.com/v1 \
  npx tsx scripts/spike-img-001-portrait-consistency.ts
# (resumable; completed 3×6 after network retries)
```

Evidence artifacts (gitignored):

* `spike-output/spike-img-001/report.json`
* `spike-output/spike-img-001/scores.json`
* `spike-output/spike-img-001/C{1,2,3}/canonical.*` + `var-0{1..6}.*`

Invariant checks:

- [x] EC-1 … EC-5 recorded with evidence paths
- [x] Findings Recommendation filled
- [x] Production Authorization later granted via ADR-010 A3 (Spike itself did not grant)

---

## Refs

* Governance: `governance/specs/POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC.md` §6
* ADR: `docs/adr/010-image-runtime-and-policy.md`
* SPEC: `docs/specs/spec-img-001-image-generation-port.md`
* Deployment: `config/infra/deployment-defaults.md`
* Template: `governance/templates/SPIKE_TEMPLATE.md`

---

## Findings

> **Status:** EC-3 completed 2026-07-17 via SiliconFlow  
> Production Authorization later **Granted (scoped)** via ADR-010 **A3** (2026-07-20) — Spike Success still did not auto-grant; Architect grant required.

### Architecture validation

| EC | Result | Evidence |
| -- | ------ | -------- |
| EC-1 Port abstraction | **PASS** | Orchestration uses Port only (`resolveSpikeChannelProvider`). |
| EC-2 Config switching | **PASS** | `IMAGE_SPIKE_ACCEPT_PROVIDER=siliconflow` + model id via config. |
| EC-3 Portrait consistency | **PASS** | 18/18 variants identityScore ≥4 (100% ≥80% threshold). |
| EC-4 Cost vs Budget | **PASS** (observational) | ~$0.03/accept Kontext est.; 18 accepts ≈ **~$0.54** (+ draft free). Fits lean Budget shape. |
| EC-5 Production isolation | **PASS** | Allowlist only; no denylist path changes. |

### Consistency evaluation (EC-3)

**Provider / model:**

| Channel | Provider | Model / path |
| ------- | -------- | ------------ |
| Draft | pollinations (free host) | `flux` |
| Accept | **siliconflow** (`api.siliconflow.com`) | `black-forest-labs/FLUX.1-Kontext-dev` + `image`/`input_image` (canonical data-URL) |

**Sample count:** 3 characters × **6** variants = **18** scored accepts (reference applied).

| Character | Variants scored | ≥4/5 identity | Avg I / P / Q | Notes |
| --------- | --------------- | ------------- | ------------- | ----- |
| C1 Veteran knight | 6 | **6** | 4.67 / 4.33 / 4.83 | Armor + white beard identity locked |
| C2 Young mage | 6 | **6** | 4.50 / 4.33 / 4.83 | Freckles / indigo / straps hold |
| C3 Elder scholar | 6 | **6** | 4.33 / 4.17 / 4.67 | Brown robes + aged face; mild draft→accept style shift |

Threshold (≥80% identityScore ≥4/5): **PASS (100%)**  
Scores: `spike-output/spike-img-001/scores.json` · images under `spike-output/spike-img-001/C{1,2,3}/`

### Cost evaluation

| Metric | Observed | Budget Policy assumption | Variance |
| ------ | -------- | ------------------------ | -------- |
| Accept-quality image count | 18 (+ retries during flaky downloads) | lean portrait sample ≪40 | OK |
| Draft channel cost | ~$0 | free draft | Match |
| Accept channel cost | ~$0.03 × 18 ≈ **$0.54** est. (Kontext-dev) | lean cheap accept | Match |

Note: intl host required for this key (`.cn` → 401). Download flakiness mitigated with resume + curl retry.

### Runtime risks

1. SiliconFlow intl vs CN endpoint mismatch can look like “invalid key”.
2. Large image downloads via undici can fail behind local proxies — curl fallback recommended.
3. Draft (Pollinations painterly) vs Accept (Kontext) style shift is acceptable for identity but should be documented for production draft→accept policy.
4. Spike Success alone does not grant Production Authorization (Three-State rule).

### Recommendation

- [x] **Proceed to Production Review** (completed 2026-07-20)
- [ ] **Continue Research**

**Why Proceed to Production Review:** EC-1…EC-5 met with SiliconFlow Kontext reference path; identity threshold passed at 100% on full 3×6 sample.

**Architect Decision (2026-07-20):** **GRANT WITH CONSTRAINTS (A–F)** — ADR-010 **A3**. Scoped Creator portrait via Port + Deployment Adapter; Constraint F sets Creator Deployment Default = Local with Cloud fallback. Not automatic wiring into Rollout/Copilot/Reader.

Decision owner / date: Spike executor / 2026-07-17 · Architect A3 / 2026-07-20  
**Production Authorization:** **GRANTED (scoped)** — ADR-010 A3 · SPEC-IMG-001 §9a
