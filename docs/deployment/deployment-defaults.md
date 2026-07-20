# Deployment Defaults — Image Runtime & Content Showcase

**Status:** Current recommendations (replaceable)  
**Last Updated:** 2026-07-20  
**Layer:** **Deployment only**  
**Authority:** MUST remain compatible with ADR-010 · SPEC-IMG-001 · `POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC`

> **Rule:** Default values are recommendations, not architectural constraints.
> Replacing any value below MUST NOT require changes to Mission, Policy, or Runtime Contracts.

Architecture surfaces (ADR-010 **A2**): **Creator Runtime ⊥ Reader Runtime** (orthogonal to Text ⊥ Image).  
Provider selection is **per surface** and remains replaceable here.

---

## 1. Image Generation — Default Deployment Profile

Bindings are **surface-scoped**. Do not read a single global row as applying to both Creator and Reader.

### 1a. Creator Runtime (authoring / Admin / batch asset production)

| Knob / binding | Current recommendation | Notes |
| -------------- | ---------------------- | ----- |
| `creator_draft_provider` | Pollinations (or free-tier) **or** Local when evidence supports | Replaceable |
| `creator_accept_provider` | Cloud accept (fal / SiliconFlow / …) **by default** until Deployment Authorization for Local | SPIKE-IMG-002: Local **may** become Creator default when ops evidence supports; **not** frozen as Architecture |
| `creator_accept_fallback` | Cloud hosted accept | Required when Local is primary on a given machine |
| `accept_model` | FLUX family or Local model id (deployment-selected) | Exact id is env/config |

**SPIKE-IMG-002 observational recommendation (not authorization):** Local (e.g. sdxl-turbo on Apple Silicon) may be preferred for illustration tone + cross-image consistency in offline Creator batches; warm P50 ≈ 35s is acceptable for batch, not for Reader interactive paths. **Creator Local as Production Default requires separate Deployment Authorization**—A2 only permits the *possibility*.

### 1b. Reader Runtime (reading experience)

| Knob / binding | Current recommendation | Notes |
| -------------- | ---------------------- | ----- |
| Image generation | **Do not invoke** Image Generation Port on the Reader hot path | Serve published assets only |
| If future on-demand generation | Hosted Cloud (or equivalent) only | **MUST NOT** depend on author-local Local endpoints |

### 1c. Cross-surface asset rule

Published assets (e.g. Cloudinary URLs + DB fields such as `story_images_v2`) are **unified**. Creator may generate via Local or Cloud; Reader consumes stored URLs only.

### Explicitly not frozen

fal · Pollinations · Ideogram · FLUX · Gemini Imagen · OpenAI Images · Local MPS/MLX · pricing · “Creator = Local”.

---

## 2. Budget — Deployment Configuration examples

Runtime reads **Budget Policy knobs** only. Currency is Deployment Configuration.

| Example profile | `usd_cap` (ops only) | Illustrative knob mapping |
| --------------- | -------------------- | ------------------------- |
| Lean public V1 | `$20` / Work (ops ceiling) | e.g. `portrait_limit≈40`, `scene_frame_limit≈60`, `draft_policy=free_channel`, `accept_policy=cheap_tier` |
| Growth | `$200` / Work | Higher limits and/or quality accept tier |
| Enterprise | `$1000` / Work | Customer-specific limits |

**Typical lean outcome (observational, not a contract):** with free drafts and cheap accepts, spend may land around a few USD per Work—still governed by knobs, not by a Runtime `$` constant. Creator Local batches may drive `usd_cap` spend near zero while still respecting portrait/scene **count** knobs.

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
| Local pipeline (SPIKE-IMG-002) | Candidate Creator Deployment; reference_url still optional/unimplemented in sample server |

None of the above are Runtime Contract constants.

---

## 5. Change procedure

1. Edit this file (and env/config) for provider/model/showcase/`usd_cap` / per-surface binding changes.
2. Do **not** amend Constitution, ADR-010 Architecture/Policy sections, or SPEC-IMG-001 contracts unless the **shape** of Policy/Contract must change (A2 surface freeze already landed in ADR-010).
3. After `raree-governance` updates, bump the admin `governance` submodule via the repo’s governance sync/bootstrap path—do not hand-edit the submodule working tree as source of truth.

---

## 6. Spike vs Production (authorization)

| State | Status |
| ----- | ------ |
| Contract Freeze | Yes (ADR-010 / SPEC-IMG-001) including **A2 Creator ⊥ Reader** |
| Spike Implementation Authorization | **Granted** — `docs/spikes/spike-img-001-image-runtime-port.md` · `docs/spikes/spike-img-002-local-image-generation.md` |
| Production Authorization | **Not granted** |
| Creator Local as Deployment Default | **Not authorized** (recommendation only; needs Deployment Authorization) |
| Reader generation default | N/A (no hot-path generation); future hosted only |

Spike may use temporary `IMAGE_SPIKE_*` (or equivalent) configuration. Production Admin/Rollout/Copilot paths MUST NOT be modified under Spike Authorization.
