# Deployment Defaults — Image Runtime & Content Showcase

**Status:** Current recommendations (replaceable)  
**Last Updated:** 2026-08-24  
**Path:** `config/infra/deployment-defaults.md`  
**Layer:** **Deployment only**  
**Authority:** MUST remain compatible with ADR-010 (incl. **A3**) · SPEC-IMG-001 · `POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC`

> **Rule:** Default values are recommendations, not architectural constraints.
> Replacing any value below MUST NOT require changes to Mission, Policy, or Runtime Contracts.

Architecture surfaces (ADR-010 **A2**): **Creator Runtime ⊥ Reader Runtime** (orthogonal to Text ⊥ Image).  
Provider selection is **per surface** and remains replaceable here.  
ADR-010 **A3 Constraint F** sets Creator Production Default = **Local** with **Cloud** fallback — still replaceable Deployment Policy, not Architecture.

---

## 1. Image Generation — Default Deployment Profile

Bindings are **surface-scoped**. Do not read a single global row as applying to both Creator and Reader.

### 1a. Creator Runtime (authoring / Admin / batch asset production)

```text
Creator Runtime
        ↓
Deployment Adapter
        ├── Local  (Production Default)     ← A3 Constraint F
        └── Cloud  (Fallback / Accept Baseline)
```

| Knob / binding | Current recommendation | Notes |
| -------------- | ---------------------- | ----- |
| `creator_draft_provider` | Local **or** free-tier draft (e.g. Pollinations) | Replaceable |
| `creator_accept_provider` | **Local** (Production Default) | A3 Constraint F; env `IMAGE_CREATOR_ACCEPT_PROVIDER` (default `local`) |
| `creator_accept_fallback` | **Opt-in Cloud** (SiliconFlow when set) | env `IMAGE_CREATOR_ACCEPT_FALLBACK` — **unset / none = no fallback** (do not silently hit Cloud). Set `siliconflow` to enable. |
| `accept_model` | **LocalAI Creator Default:** `Z-Image-Turbo` (RSD-002). Rollback: `sd-3.5-medium-ggml`. Cloud T2I unchanged. | `IMAGE_CREATOR_ACCEPT_MODEL` / `IMAGE_CREATOR_FALLBACK_MODEL` (default Cloud T2I: `FLUX.1-dev`; Kontext only when reference image is present). Provider unchanged. |
| Local endpoint | Operator HTTP portrait server | `IMAGE_CREATOR_LOCAL_BASE` (e.g. `http://127.0.0.1:8191`) |

**A3 Constraint F:** Creator Production Default = Local via Deployment Adapter; Cloud remains Fallback / Accept Baseline. MUST NOT freeze Local vendor/model. MUST remain replaceable without amending ADR-010 Contract / SPEC-IMG-001 Port shape. Reader Runtime is unaffected.

**SPIKE-IMG-002 observational context:** Local (e.g. sdxl-turbo on Apple Silicon) can win on Creator-weighted illustration tone + consistency for offline batches; warm P50 ≈ 35s is acceptable for Creator batch, not for Reader interactive paths. Cloud remains quality/availability baseline for fallback.

### 1b. Reader Runtime (reading experience)

| Knob / binding | Current recommendation | Notes |
| -------------- | ---------------------- | ----- |
| Image generation | **Do not invoke** Image Generation Port on the Reader hot path | Serve published assets only |
| If future on-demand generation | Hosted Cloud (or equivalent) only | **MUST NOT** depend on author-local Local endpoints; requires Production Authorization beyond A3 |

### 1c. Cross-surface asset rule

Published assets (e.g. Cloudinary URLs + DB fields such as `story_images_v2`) are **unified**. Creator may generate via Local or Cloud; Reader consumes stored URLs only.

### Explicitly not frozen

fal · Pollinations · Ideogram · FLUX · Gemini Imagen · OpenAI Images · Local MPS/MLX · pricing · any specific Local vendor · “Creator = Local” as Architecture.

---

## 2. Budget — Deployment Configuration examples

Runtime reads **Budget Policy knobs** only. Currency is Deployment Configuration.

| Example profile | `usd_cap` (ops only) | Illustrative knob mapping |
| --------------- | -------------------- | ------------------------- |
| Lean public V1 | `$20` / Work (ops ceiling) | e.g. `portrait_limit≈40`, `scene_frame_limit≈60`, `draft_policy=free_channel`, `accept_policy=cheap_tier` |
| Growth | `$200` / Work | Higher limits and/or quality accept tier |
| Enterprise | `$1000` / Work | Customer-specific limits |

**Typical lean outcome (observational, not a contract):** with free drafts and cheap accepts, spend may land around a few USD per Work—still governed by knobs, not by a Runtime `$` constant. Creator Local batches may drive `usd_cap` spend near zero while still respecting portrait/scene **count** knobs.

**A3 Constraint E:** Production Budget **hard enforcement** is not authorized by A3; knobs may be observed only until a separate grant.

---

## 3. Default Public Showcase (Content Deployment)

Content Policy tracks are frozen in ADR-010. **Titles below are current showcase defaults only.**

Recommendation package (matrix + canon subsets): [`pd-showcase-recommendation-v1.md`](./pd-showcase-recommendation-v1.md) (ROI Decision Package v1).

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
| Local Creator pipeline (SPIKE-IMG-002) | Creator Production Default path (Constraint F); reference_url may still be optional/unimplemented in sample server |
| FLUX-family reference images via Cloud accept adapter | Cloud Fallback / Accept Baseline candidate for `reference_strategy` |
| Ideogram Character Reference | Candidate alternate adapter |
| Per-character LoRA | Candidate; not required for V1 |

None of the above are Runtime Contract constants.

---

## 5. Change procedure

1. Edit this file (and env/config) for provider/model/showcase/`usd_cap` / per-surface binding changes — including switching Creator Default Local ↔ Cloud.  
   Location: **`config/infra/`** (not under `docs/`).  
2. Do **not** amend Constitution, ADR-010 Architecture/Policy/Contract sections, or SPEC-IMG-001 Port contracts unless the **shape** of Policy/Contract must change (A2 surface freeze and A3 scoped Production Authorization already landed in ADR-010).  
3. After `raree-governance` updates, bump the admin `governance` submodule via the repo’s governance sync/bootstrap path—do not hand-edit the submodule working tree as source of truth.

---

## 6. Spike vs Production (authorization)

| State | Status |
| ----- | ------ |
| Contract Freeze | Yes (ADR-010 / SPEC-IMG-001) including **A2 Creator ⊥ Reader** |
| Spike Implementation Authorization | **Granted** — `docs/spikes/spike-img-001-image-runtime-port.md` · `docs/spikes/spike-img-002-local-image-generation.md` |
| Production Authorization | **Granted (scoped)** — ADR-010 **A3** · Constraints A–F · SPEC-IMG-001 §9a |
| Creator Local as Deployment Default | **Authorized** as replaceable Deployment Default (A3 Constraint F); Cloud fallback required |
| Reader generation default | N/A (no hot-path generation); future hosted only; **not** in A3 |

Under A3, Creator portrait production paths listed in SPEC-IMG-001 §9a MAY be modified. Spike-only paths remain isolated. Broader surfaces/capabilities still require a new Production Authorization grant.
