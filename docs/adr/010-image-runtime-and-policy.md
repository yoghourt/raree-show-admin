# ADR-010 — Image Runtime, Content Policy & Budget Policy

**Status:** Accepted  
**Type:** Architecture ADR  
**Version:** 1.2  
**Last Updated:** 2026-07-20  
**Owner:** Architect  
**Authority:** `Constitution.md` · `governance/specs/POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC.md`  
**Amendment A1 (2026-07-17):** Grant **Spike Implementation Authorization** only (`docs/spikes/spike-img-001-image-runtime-port.md`). **Production Authorization remains Not Granted.** Clarifies three-state model: Contract Freeze ≠ Spike Authorization ≠ Production Authorization.  
**Amendment A2 (2026-07-20):** Freeze orthogonal **Creator Runtime ⊥ Reader Runtime** surfaces. Provider selection (Local / Cloud) remains Deployment. Evidence: SPIKE-IMG-002 + Architecture Alignment (2026-07-20).

---

## Layer map (read first)

| Layer | This ADR freezes | Explicitly NOT frozen here |
| ----- | ---------------- | -------------------------- |
| **Architecture** | Text Runtime ⊥ Image Runtime; **Creator Runtime ⊥ Reader Runtime**; Image Generation Port / Adapter | Vendor SDKs; Local vs Cloud as architecture constants |
| **Policy** | Content tracks (1/2/3); Budget Policy shape under Mission | Showcase work titles; USD |
| **Runtime Contract** | Port shape; `portrait_limit`, `scene_frame_limit`, `draft_policy`, `accept_policy`; `reference_strategy`, `consistency_policy`; surface-scoped generation posture (D1a) | Provider/model IDs; LoRA; named vendor “character reference”; “Creator = Local” |
| **Deployment** | — (see `docs/deployment/deployment-defaults.md`) | All provider defaults live there |

---

## What

This ADR records architectural decisions for:

1. Independent Image Runtime behind an Image Generation Port.
2. Orthogonal **Creator** and **Reader** runtime surfaces (responsibility / SLO), distinct from Text ⊥ Image (capability).
3. Content Policy tracks for lawful / Mission-aligned publishing.
4. Budget Policy as the only cost-control interface Runtime may read.
5. Image consistency as a Runtime capability expressed via contract knobs—not vendor mechanisms.

It does **not** authorize production implementation in this change set.

**A1:** Spike Implementation Authorization is granted separately via
`docs/spikes/spike-img-001-image-runtime-port.md`. Production Authorization is
still **Not Granted**.

**A2:** Architecture Alignment freezes Creator ⊥ Reader surfaces. It does **not**
bind Creator to Local, grant Production Authorization, or change Port shape.

---

## Why

* Gemini image paths hit quota failures; Image Runtime must not be coupled to Text Runtime providers.
* Constitution Mission requires complex stories and author narrative experience—not encyclopedia pivots—while copyright pressure forbids treating protected franchise IP as default public showcase.
* Embedding USD caps or vendor names in Runtime forces code changes when enterprise budgets or providers change.
* A single global “Production Default” for image **generation** conflates authoring (batch, style, cost) with reading (reliability, latency, availability). SPIKE-IMG-002 showed Local can win on Creator-weighted quality while remaining unfit as a Reader availability dependency.

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
* Replaceable stack / showcase / budget examples: `docs/deployment/deployment-defaults.md`
* Shared governance law: `governance/specs/POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC.md` (submodule source: `raree-governance`)
* Spike Authorization (allowlist / denylist / Exit Criteria / Findings): `docs/spikes/spike-img-001-image-runtime-port.md` · `docs/spikes/spike-img-002-local-image-generation.md`

**Production** Image Runtime wiring remains **out of scope** until a separate Production Authorization grant. A2 does **not** grant Creator Local as Production Default—only freezes surfaces; Deployment authorization is separate.

---

## Alternatives Considered

| Alternative | Rejected because |
| ----------- | ---------------- |
| Bind Runtime to one vendor/model family | Violates Defaults-are-recommendations; couples Mission delivery to one supplier |
| Freeze showcase novels in Policy | Treats Deployment Defaults as Architecture; blocks lawful substitution |
| Put `$20` in Runtime | Forces rewrites for `$200` / `$1000` enterprise caps |
| Freeze LoRA / Ideogram Character Reference as the consistency architecture | Premature technology lock; consistency is a capability, not a vendor feature |
| Single global “Image Production Default” without surfaces | Conflates Creator batch/style goals with Reader availability SLOs (A2) |
| Freeze `Creator Runtime = Local` in Architecture | One machine / one pipeline / one pack is Deployment evidence, not a permanent architecture bind (A2) |

---

## Trade-offs

* Operators must maintain Deployment Defaults explicitly—including **per-surface** provider bindings when generation is enabled on more than one surface.
* Spike evidence may later justify elevating a consistency mechanism into a SPEC—only via a new ADR amendment, not by silent code coupling.
* Creator Local recommendations may drift by hardware; Architecture stays stable by refusing provider freeze.

---

## Validation

Invariant checks (documentation):

- [x] No provider/model/USD/showcase title appears as a frozen Architecture/Policy/Runtime Contract constant in this ADR.
- [x] Creator ⊥ Reader is frozen as surfaces; Local/Cloud are not Architecture constants.
- [x] Deployment Defaults document lists current recommendations as replaceable.
- [x] Governance SPEC states Defaults-are-recommendations.

Executed commands: none (docs-only).

---

## Refs

* Constitution: `governance/Constitution.md`
* Governance: `governance/specs/POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC.md`
* SPEC: `docs/specs/spec-img-001-image-generation-port.md`
* Spike: `docs/spikes/spike-img-001-image-runtime-port.md` · `docs/spikes/spike-img-002-local-image-generation.md`
* Deployment: `docs/deployment/deployment-defaults.md`
* Related: ADR-004 (Human-owned truth; Asset fields); ADR-D2-001 (source / storage legal posture)
* Alignment: Architecture Follow-up Review + Alignment (2026-07-20) — Creator ⊥ Reader
