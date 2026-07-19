# Deployment Defaults — Image Runtime & Content Showcase

**Status:** Current recommendations (replaceable)  
**Last Updated:** 2026-07-19  
**Layer:** **Deployment only**  
**Authority:** MUST remain compatible with ADR-010 · SPEC-IMG-001 · `POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC`

> **Rule:** Default values are recommendations, not architectural constraints.
> Replacing any value below MUST NOT require changes to Mission, Policy, or Runtime Contracts.

---

## 1. Image Generation — Default Deployment Profile

| Knob / binding | Current default | Notes |
| -------------- | --------------- | ----- |
| `draft_provider` | Pollinations (or equivalent free tier) | Replaceable; used for draft iteration under `draft_policy` |
| `accept_provider` | fal | Replaceable Image Port adapter |
| `accept_model` | FLUX family (deployment-selected variant) | Family recommendation; exact model id is env/config |
| Text Runtime provider | Unchanged / independent | Image defaults MUST NOT imply Text Runtime coupling |

### Explicitly not frozen

fal · Pollinations · Ideogram · FLUX · Gemini Imagen · OpenAI Images · pricing.

---

## 2. Budget — Deployment Configuration examples

Runtime reads **Budget Policy knobs** only. Currency is Deployment Configuration.

| Example profile | `usd_cap` (ops only) | Illustrative knob mapping |
| --------------- | -------------------- | ------------------------- |
| Lean public V1 | `$20` / Work (ops ceiling) | e.g. `portrait_limit≈40`, `scene_frame_limit≈60`, `draft_policy=free_channel`, `accept_policy=cheap_tier` |
| Growth | `$200` / Work | Higher limits and/or quality accept tier |
| Enterprise | `$1000` / Work | Customer-specific limits |

**Typical lean outcome (observational, not a contract):** with free drafts and cheap accepts, spend may land around a few USD per Work—still governed by knobs, not by a Runtime `$` constant.

---

## 3. Default Public Showcase (Content Deployment)

Content Policy tracks are frozen in ADR-010. **Titles below are current showcase defaults only.**

Recommendation package (matrix + canon subsets): `docs/deployment/pd-showcase-recommendation-v1.md` (ROI Decision Package v1).

| Role | Current default showcase | Track | v1 scope |
| ---- | ------------------------ | ----- | -------- |
| International primary | Les Misérables | Track 1 (pin verified PD English translation) | **Canon subset only** — not full-text ingest |
| Visual / Chinese co-track | Romance of the Three Kingdoms（《三国演义》） | Track 1 (pin edition) | **Canon subset only** |

### Replaceable

《西游记》、War and Peace、Pride and Prejudice (text-first MVP), other PD ensemble novels, user-owned works—swap via Deployment / ops without amending ADR-010.

### Not a public default

Protected franchise IP (e.g. Game of Thrones / ASOIAF, contemporary TV/novel franchises without license) → Content Policy **Track 2** (internal validation only). **GoT is not a public showcase dataset.**

---

## 4. Consistency — candidate implementations

Contract knobs: `consistency_policy`, `reference_strategy` (SPEC-IMG-001).

| Candidate | Role |
| --------- | ---- |
| FLUX-family reference images via accept adapter | Candidate for `reference_strategy` |
| Ideogram Character Reference | Candidate alternate adapter |
| Per-character LoRA | Candidate; not required for V1 |

None of the above are Runtime Contract constants.

---

## 5. Change procedure

1. Edit this file (and env/config) for provider/model/showcase/`usd_cap` changes.
2. Do **not** amend Constitution, ADR-010 Policy sections, or SPEC-IMG-001 contracts unless the **shape** of Policy/Contract must change.
3. After `raree-governance` updates, bump the admin `governance` submodule via the repo’s governance sync/bootstrap path—do not hand-edit the submodule working tree as source of truth.

---

## 6. Spike vs Production (authorization)

| State | Status |
| ----- | ------ |
| Contract Freeze | Yes (ADR-010 / SPEC-IMG-001) |
| Spike Implementation Authorization | **Granted** — `docs/spikes/spike-img-001-image-runtime-port.md` · `docs/spikes/spike-img-002-local-image-generation.md` |
| Production Authorization | **Not granted** |
| Image Production Default | **Cloud** draft/accept (section 1) |
| Local generation | Research / optional adapter only — **not** Production Default |

Spike may use temporary `IMAGE_SPIKE_*` (or equivalent) configuration. Production Admin/Rollout/Copilot paths MUST NOT be modified under Spike Authorization.
