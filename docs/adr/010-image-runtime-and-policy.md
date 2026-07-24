# ADR-010 — Image Runtime, Content Policy & Budget Policy

**Status:** Accepted  
**Type:** Architecture ADR  
**Version:** 1.4  
**Last Updated:** 2026-07-24  
**Owner:** Architect  
**Authority:** `Constitution.md` · `governance/specs/POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC.md`  
**Amendment A1 (2026-07-17):** Grant **Spike Implementation Authorization** only (`docs/spikes/spike-img-001-image-runtime-port.md`). Clarifies three-state model: Contract Freeze ≠ Spike Authorization ≠ Production Authorization.  
**Amendment A2 (2026-07-20):** Freeze orthogonal **Creator Runtime ⊥ Reader Runtime** surfaces. Provider selection (Local / Cloud) remains Deployment. Evidence: SPIKE-IMG-002 + Architecture Alignment (2026-07-20).  
**Amendment A3 (2026-07-20):** Grant **scoped Production Authorization** for Creator Runtime character portrait generation via the Image Generation Port and Deployment Adapter, subject to Constraints A–F. **Constraint F** sets Creator Deployment Default to **Local** with **Cloud fallback** — Deployment Policy only; does **not** freeze any Local vendor, does **not** amend Port/Contract shape, and does **not** authorize Reader generation.  
**Amendment A4 (2026-07-24):** Grant **conditional scoped Production Authorization** for Creator **Scene Frame draft generation** via the **existing** Image Generation Port + Deployment Adapter, admitted only as Media Admission **ephemeral Candidates** then Human Accept → Assets. **Does not** introduce a Scene-Frame-specific Provider, fourth Runtime, or Prompt Truth. Runtime Validation: `docs/spikes/spike-aa-001-asset-acquisition.md` § Runtime Validation.

---

## Layer map (read first)

| Layer | This ADR freezes | Explicitly NOT frozen here |
| ----- | ---------------- | -------------------------- |
| **Architecture** | Text Runtime ⊥ Image Runtime; **Creator Runtime ⊥ Reader Runtime**; Image Generation Port / Adapter | Vendor SDKs; Local vs Cloud as architecture constants |
| **Policy** | Content tracks (1/2/3); Budget Policy shape under Mission | Showcase work titles; USD |
| **Runtime Contract** | Port shape; `portrait_limit`, `scene_frame_limit`, `draft_policy`, `accept_policy`; `reference_strategy`, `consistency_policy`; surface-scoped generation posture (D1a) | Provider/model IDs; LoRA; named vendor “character reference”; “Creator = Local” |
| **Deployment** | — (see `config/infra/deployment-defaults.md`) | All provider defaults live there (incl. Creator Local Default + Cloud fallback per A3 Constraint F) |

---

## What

This ADR records architectural decisions for:

1. Independent Image Runtime behind an Image Generation Port.
2. Orthogonal **Creator** and **Reader** runtime surfaces (responsibility / SLO), distinct from Text ⊥ Image (capability).
3. Content Policy tracks for lawful / Mission-aligned publishing.
4. Budget Policy as the only cost-control interface Runtime may read.
5. Image consistency as a Runtime capability expressed via contract knobs—not vendor mechanisms.

**A1:** Spike Implementation Authorization is granted separately via
`docs/spikes/spike-img-001-image-runtime-port.md` (and SPIKE-IMG-002 for Local adapter research).

**A2:** Architecture Alignment freezes Creator ⊥ Reader surfaces. It does **not**
bind Creator to Local at Architecture, or change Port shape.

**A3:** Scoped Production Authorization is granted for Creator character portraits
(Port + Deployment Adapter + Human Accept). Constraints A–F apply. Constraint F
authorizes **Local as Creator Deployment Default** with **Cloud fallback** without
freezing Architecture to Local.

**A4:** Conditional scoped Production Authorization is granted for Creator Scene
Frame **drafts** through the same Image Generation Port + Deployment Adapter.
Results are Media Admission Candidates only until Human Accept. No Scene-Frame
Provider hierarchy; Prompt remains derived from Asset Caption; zero image logistics.

---

## Why

* Gemini image paths hit quota failures; Image Runtime must not be coupled to Text Runtime providers.
* Constitution Mission requires complex stories and author narrative experience—not encyclopedia pivots—while copyright pressure forbids treating protected franchise IP as default public showcase.
* Embedding USD caps or vendor names in Runtime forces code changes when enterprise budgets or providers change.
* A single global “Production Default” for image **generation** conflates authoring (batch, style, cost) with reading (reliability, latency, availability). SPIKE-IMG-002 showed Local can win on Creator-weighted quality while remaining unfit as a Reader availability dependency.
* Creator-only phase prioritizes content production cost; Local as replaceable Deployment Default (with Cloud fallback) is a Deployment Policy choice under A3 Constraint F—not a Contract freeze.

Governing pressure: Mission Before Features · Convergence Before Expansion · Defaults Are Recommendations (`POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC`).

---

## Decision

### D1 — Image Runtime independence (Architecture)

* Text Runtime and Image Runtime are **independent**.
* Image generation is accessed only through an **Image Generation Port / Adapter**.
* Runtime MUST NOT depend on any specific image provider.

### D1a — Creator Runtime ⊥ Reader Runtime (Architecture) — A2

Two **orthogonal** separations:

```text
Capability:     Text Runtime  ⊥  Image Runtime
Responsibility: Creator Runtime  ⊥  Reader Runtime
```

| Surface | Responsibility (normative intent) | Image generation posture |
| ------- | --------------------------------- | ------------------------ |
| **Creator Runtime** | Produce and curate story assets (Admin / authoring) | MAY invoke Image Generation Port; optimizes for visual quality, artistic consistency, production cost, batch throughput |
| **Reader Runtime** | Deliver a stable reading experience | MUST NOT depend on author-local generation for availability; optimizes for reliability, availability, predictable latency, maintainability |

**Normative constraints:**

* Surfaces describe **responsibility and SLO**, not providers.
* **MUST NOT** freeze `Creator Runtime = Local` (or any vendor) at Architecture / Runtime Contract layers.
* Creator Runtime **MAY** use Local as its default **Deployment** provider when deployment evidence supports it; Cloud (or other hosted) fallback remains a Deployment concern.
* Reader Runtime **MUST NOT** treat an author laptop Local endpoint as a production availability dependency. If Reader ever invokes generation, binding MUST be hosted/cloud-class Deployment (separate authorization).
* **Published asset storage is cross-surface unified** (e.g. Cloudinary + canonical DB fields). Generation provider MAY differ by surface; published URLs/assets MUST remain consumable by Reader without re-generation.

### D1b — Scoped Production Authorization (A3)

**Granted scope:**

| Item | Authorized |
| ---- | ---------- |
| Creator Runtime | Yes |
| Character Portrait generation | Yes |
| Image Generation Port | Yes |
| Deployment Adapter | Yes |
| Local as Creator Production Default | Yes — **Deployment only** (Constraint F) |
| Cloud as Fallback / Accept Baseline | Yes |
| Human Accept → Asset fields (e.g. `portraitUrl`) | Yes (ADR-004) |

**Constraints A–F (normative for this grant):**

| ID | Constraint |
| -- | ---------- |
| **A — Surface** | Creator Runtime only. Reader MUST NOT depend on generation hot path; consumes published assets only. |
| **B — Capability** | Character Portrait **Accept** path; Scene Frame **draft Candidates** via Image Port only (A4). No automatic `story_images_v2` Asset writes; no Rollout / Discovery / Copilot auto-image; no Scene-Frame-specific Provider hierarchy. |
| **C — Port only** | Production wiring MUST call the Image Generation Port; business paths MUST NOT call vendor SDKs directly. |
| **D — Human gate** | Generated bytes/URLs enter Assets only via Human Accept; AI is not Canonical Truth. |
| **E — Budget** | This grant does **not** authorize production Budget hard enforcement (USD / hard limits). Knobs MAY be observed; enforcement requires a separate grant. |
| **F — Deployment Default** | Creator Deployment Adapter Production Default = **Local**; **Cloud** remains Fallback / Accept Baseline. Replaceable. MUST NOT freeze Local vendor/model. MUST remain config-switchable to Cloud. Does **not** amend Port/Contract. Does **not** authorize Reader Local. |

**Constraint F topology (Deployment narration only):**

```text
Creator Runtime
        ↓
Deployment Adapter
        ├── Local  (Production Default)
        └── Cloud  (Fallback / Accept Baseline)
```

**Still denied under A3:** Reader hot-path generation; DB schema/migrations; elevating any vendor name into Architecture/Contract; production Budget hard enforcement.

### D1c — Conditional Scoped Production Authorization (A4)

**Granted (2026-07-24)** after Runtime Validation (Prompt Truth + Zero-Logistics) in SPIKE-AA-001:

| Item | Authorized |
| ---- | ---------- |
| Creator Scene Frame **draft** generation | Yes — via **existing** Image Generation Port |
| Deployment Adapter (Local default / Cloud fallback) | Yes — same Constraint F topology |
| Media Admission ephemeral Candidate | Yes |
| Human Accept → `story_images_v2[].url` | Yes (sole Truth write) |
| Scene-Frame-specific Provider / fourth Runtime | **No** |
| Prompt as business object / Prompt library | **No** |
| Auto Accept / Candidate Truth store | **No** |
| CPP Progress from Generate/Job/Candidate | **No** — Progress from Assets only |

**A4 mandatory invariants:**

* Prompt = derived Job input from Asset Caption; Caption owns generation intent.  
* Generate → Port → Deployment → Candidate in-slot; operator MUST NOT download / manage PNG / Finder / re-upload / copy URL.  
* Generate / Job / Candidate success MUST NOT advance CPP Progress.

**Still denied under A4:** Discovery integration; queue/workflow redesign; automatic Asset writes; durable Candidate authority.

### D2 — Image Provider Contract (Runtime Contract)

Runtime defines a provider-agnostic contract (normative detail in SPEC-IMG-001), including at minimum:

* `generatePortrait(request) → result`
* optional `referenceImages` input
* provider capability flags (e.g. whether reference is supported)

Concrete adapters and per-surface provider bindings are Deployment concerns.

### D3 — Content Policy tracks (Policy)

| Track | Name | Publishing posture |
| ----- | ---- | ------------------ |
| **1** | Public Domain + User-owned / Licensed | Default public / commercial-capable path when rights are clear |
| **2** | Protected IP | **Internal validation only** (no public/paid showcase without license) |
| **3** | Licensed commercial publishing | Public only under written license |

Specific titles (e.g. a given public-domain novel) are **Deployment Defaults** (“Default Public Showcase”), not architectural constants.

### D4 — Budget Policy stack (Policy → Runtime)

```text
Mission → Content Policy → Budget Policy → Runtime
```

Runtime Contract MAY include:

* `portrait_limit`
* `scene_frame_limit`
* `draft_policy`
* `accept_policy`

Runtime Contract / Budget Policy MUST NOT include:

* USD values
* pricing tables
* model unit costs

Those belong in Deployment Configuration (may *derive* limits from a `usd_cap`, but Runtime reads limits/policies—not currency).

### D5 — Image consistency (Runtime Contract)

* Runtime **supports** image consistency.
* Contract includes `reference_strategy` and `consistency_policy`.
* Vendor mechanisms (e.g. LoRA, a specific model family’s reference API, a vendor “character reference” product) are **candidate Deployment implementations**, not frozen architecture.

---

## How

* Normative port fields: `docs/specs/spec-img-001-image-generation-port.md`
* Replaceable stack / showcase / budget examples: `config/infra/deployment-defaults.md`
* Shared governance law: `governance/specs/POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC.md` (submodule source: `raree-governance`)
* Spike Authorization (allowlist / denylist / Exit Criteria / Findings): `docs/spikes/spike-img-001-image-runtime-port.md` · `docs/spikes/spike-img-002-local-image-generation.md`

**A3:** Production wiring for **Creator character portraits** via Port + Deployment Adapter is **in scope** under Constraints A–F. Broader surfaces/capabilities remain out of scope until a new Production Authorization grant.

**A4:** Creator Scene Frame **drafts** via the same Port + Deployment Adapter are **in scope** as Media Admission Candidates only (Human Accept → Assets). Scene-Frame-specific Providers, Prompt Truth, auto Accept, and CPP Progress from Generate remain out of scope.

---

## Alternatives Considered

| Alternative | Rejected because |
| ----------- | ---------------- |
| Bind Runtime to one vendor/model family | Violates Defaults-are-recommendations; couples Mission delivery to one supplier |
| Freeze showcase novels in Policy | Treats Deployment Defaults as Architecture; blocks lawful substitution |
| Put `$20` in Runtime | Forces rewrites for `$200` / `$1000` enterprise caps |
| Freeze LoRA / Ideogram Character Reference as the consistency architecture | Premature technology lock; consistency is a capability, not a vendor feature |
| Single global “Image Production Default” without surfaces | Conflates Creator batch/style goals with Reader availability SLOs (A2) |
| Freeze `Creator Runtime = Local` in Architecture | One machine / one pipeline / one pack is Deployment evidence, not a permanent architecture bind (A2); A3 Constraint F sets Deployment Default only |

---

## Trade-offs

* Operators must maintain Deployment Defaults explicitly—including **per-surface** provider bindings when generation is enabled on more than one surface.
* Spike evidence may later justify elevating a consistency mechanism into a SPEC—only via a new ADR amendment, not by silent code coupling.
* Creator Local recommendations may drift by hardware; Architecture stays stable by refusing provider freeze.
* A3 Local Default lowers Creator content cost but requires Cloud fallback discipline and does not improve Reader availability.

---

## Validation

Invariant checks (documentation):

- [x] No provider/model/USD/showcase title appears as a frozen Architecture/Policy/Runtime Contract constant in this ADR.
- [x] Creator ⊥ Reader is frozen as surfaces; Local/Cloud are not Architecture constants (A3 F is Deployment Default only).
- [x] Deployment Defaults document lists current recommendations as replaceable.
- [x] Governance SPEC states Defaults-are-recommendations.
- [x] A3 Production Authorization is scoped and constrained (A–F); Reader generation remains denied.
- [x] A4 Conditional Production Authorization: Scene Frame drafts via Port → Candidate → Accept; no Scene-Frame Provider hierarchy.

Executed commands: none (docs-only).

---

## Refs

* Constitution: `governance/Constitution.md`
* Governance: `governance/specs/POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC.md` §6 (Three-State Authorization)
* SPEC: `docs/specs/spec-img-001-image-generation-port.md`
* Spike: `docs/spikes/spike-img-001-image-runtime-port.md` · `docs/spikes/spike-img-002-local-image-generation.md`
* Deployment: `config/infra/deployment-defaults.md` (Creator Local Default + Cloud fallback per A3 Constraint F)
* Related: ADR-004 (Human-owned truth; Asset fields); ADR-D2-001 (source / storage legal posture)
* Alignment: Architecture Follow-up Review + Alignment (2026-07-20) — Creator ⊥ Reader
* Production Review: Architect Decision 2026-07-20 — GRANT WITH CONSTRAINTS (A–F)
