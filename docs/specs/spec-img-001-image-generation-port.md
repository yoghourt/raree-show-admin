# SPEC-IMG-001 — Image Generation Port

## Metadata

| Field | Value |
| ----- | ----- |
| Title | Image Generation Port |
| Status | Approved — **Contract Freeze** |
| Spike Implementation Authorization | **GRANTED** — SPIKE-IMG-001 · SPIKE-IMG-002 (allowlists below) |
| Production Authorization | **GRANTED (scoped)** — ADR-010 **A3** · Constraints A–F |
| Version | v0.4 |
| Owner | Architect |
| Last Updated | 2026-07-20 |
| Derived From | ADR-010 (incl. **A2**, **A3**) · `POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC` §6 |
| Supersedes | SPEC-IMG-001 v0.3 (Contract Freeze + A2; Production Not Granted) |

---

## 0. Three-State Authorization (normative)

Per `POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC` §6 (**Three-State Authorization**), these states are separate and MUST NOT be collapsed:

| State | SPEC-IMG-001 |
| ----- | ------------ |
| Contract Freeze | **Yes** (this SPEC Accepted) |
| Spike Implementation Authorization | **Granted** → allowlists in SPIKE-IMG-001 and SPIKE-IMG-002 |
| Production Authorization | **Granted (scoped)** → ADR-010 **A3** · Constraints A–F · §9a |

Spike Authorization does **not** by itself imply Production Authorization.
Production Authorization under A3 does **not** expand beyond the scoped allowlist in §9a.

---

## 1. Purpose

Defines the **Runtime Contract** for Image Runtime: a provider-agnostic Image Generation Port so Text Runtime and Image Runtime remain independently evolvable, and so **Creator Runtime** and **Reader Runtime** may bind providers differently without changing this contract.

This SPEC freezes **contracts, surface posture knobs, and policy knobs**. It does not freeze providers, models, pricing, showcase works, or `Creator = Local` as Architecture. Creator Local as **Deployment Default** is authorized only via ADR-010 **A3 Constraint F** and lives in `config/infra/deployment-defaults.md`.

---

## 2. Layer classification

| Content in this SPEC | Layer |
| -------------------- | ----- |
| Port interface; Text Runtime ⊥ Image Runtime | Architecture / Runtime Contract |
| Creator Runtime ⊥ Reader Runtime; surface-scoped generation posture | Architecture / Runtime Contract (ADR-010 **D1a** / **A2**) |
| Scoped Production Authorization (portrait / Port / Adapter / Human Accept) | Production Authorization (ADR-010 **A3**) — not a Port-shape change |
| `portrait_limit`, `scene_frame_limit`, `draft_policy`, `accept_policy` | Runtime Contract (Budget Policy knobs) |
| `reference_strategy`, `consistency_policy` | Runtime Contract (consistency capability) |
| Named providers / models / USD / Local vs Cloud defaults | **Forbidden here** → `config/infra/deployment-defaults.md` |

---

## 3. Architecture invariants

1. **IMG-INV-01 — Independence.** Image Runtime MUST NOT require Text Runtime’s provider or session model.
2. **IMG-INV-02 — Port only.** Application code that generates images MUST call the Image Generation Port, not a vendor SDK directly (adapters may wrap SDKs behind the Port).
3. **IMG-INV-03 — No vendor lock in contract.** Runtime Contract MUST remain valid if Deployment swaps adapters.
4. **IMG-INV-04 — Orthogonal surfaces (A2).** Capability separation (Text ⊥ Image) is orthogonal to responsibility separation (**Creator Runtime ⊥ Reader Runtime**). Surfaces describe responsibility and SLO, not providers.
5. **IMG-INV-05 — No Creator=Local freeze.** Architecture / Runtime Contract MUST NOT freeze `Creator Runtime = Local` (or any vendor). Local / Cloud bindings are Deployment (A3 Constraint F may set Creator Deployment Default without Architecture freeze).
6. **IMG-INV-06 — Unified published assets.** Generation provider MAY differ by surface; published asset storage (e.g. Cloudinary URLs + canonical DB fields such as `story_images_v2`) MUST remain consumable by Reader without re-generation.

---

## 3a. Surface-scoped generation posture (Runtime Contract — A2)

```text
Capability:     Text Runtime  ⊥  Image Runtime
Responsibility: Creator Runtime  ⊥  Reader Runtime
```

| Surface | Responsibility (normative intent) | Image generation posture |
| ------- | --------------------------------- | ------------------------ |
| **Creator Runtime** | Produce and curate story assets (Admin / authoring) | MAY invoke Image Generation Port; optimizes for visual quality, artistic consistency, production cost, batch throughput |
| **Reader Runtime** | Deliver a stable reading experience | MUST NOT depend on author-local generation for availability; optimizes for reliability, availability, predictable latency, maintainability |

**Normative constraints:**

* Creator Runtime **MAY** use Local as a Deployment provider when authorized at Deployment (A3 Constraint F). Cloud (or other hosted) fallback remains a Deployment concern.
* Reader Runtime **MUST NOT** treat an author-laptop Local endpoint as a production availability dependency. If Reader ever invokes generation, binding MUST be hosted/cloud-class Deployment (requires a **new** Production Authorization beyond A3).
* Per-surface provider bindings live in Deployment Defaults — not in this contract schema as vendor names.

---

## 4. Image Provider Contract (normative sketch)

Logical types (TypeScript-shaped; not an implementation mandate):

```text
PortraitRequest {
  prompt: string
  referenceImages?: { url: string }[]
  seed?: number
  size?: { width: number; height: number }
}

PortraitResult {
  bytes: Buffer | Uint8Array
  mimeType: string
  meta: { providerId: string; modelId: string; seed?: number }
}

ImagePortraitProvider {
  name: string                          // opaque deployment id
  capabilities: { referenceImage: boolean }
  generatePortrait(req: PortraitRequest): Promise<PortraitResult>
}
```

`providerId` / `modelId` in `meta` are observational labels for telemetry—not frozen architecture symbols.
Port shape is unchanged by ADR-010 **A2** / **A3**; A3 authorizes *wiring* under constraints, not Port field changes.

---

## 5. Budget Policy knobs (Runtime Contract)

Runtime MAY enforce:

| Knob | Meaning |
| ---- | ------- |
| `portrait_limit` | Max accept-quality portraits per Work (or scoped unit defined by Deployment) |
| `scene_frame_limit` | Max accept-quality story/reading frames per Work |
| `draft_policy` | How draft generations are routed (e.g. free-tier channel vs paid) — **enum/strategy id**, not a vendor name in the contract schema |
| `accept_policy` | How accept/final generations are routed (e.g. cheap vs quality tier) — **strategy id**, not a vendor name |

### Forbidden in this contract

* USD amounts (`$20`, `$200`, …)
* Price per megapixel / per image
* Hard-coded model SKUs as required constants
* Surface-as-provider freezes at Architecture (e.g. requiring Creator→Local in Contract)

Deployment MAY map a `usd_cap` into the knobs above; Runtime reads the knobs.

**A3 Constraint E:** Production Budget **hard enforcement** remains **Not Authorized**. Knobs MAY be observed in production paths; enforcement requires a separate grant.

---

## 6. Consistency capability (Runtime Contract)

| Knob | Meaning |
| ---- | ------- |
| `consistency_policy` | Whether / when consistency is required (e.g. off, reference_required, best_effort) |
| `reference_strategy` | How references are supplied (e.g. none, canonical_portrait_url, multi_ref) |

### Candidate Deployment implementations (non-normative)

Examples that MAY back the knobs without being frozen:

* A model family’s native reference-image API
* A vendor “character reference” product feature
* Per-character LoRA / fine-tune pipelines
* Local Creator pipelines (SPIKE-IMG-002) — Deployment candidate / A3 Default path

Elevating any candidate to a frozen contract requires a new ADR amendment plus SPEC update.

---

## 7. Relationship to Asset fields

Character `portraitUrl` and Reading Route `story_images_v2` remain **Asset** fields under ADR-004 classification. This Port produces bytes/URLs that humans Accept into those fields; AI is not Canonical Truth authority.

Published Asset URLs are the cross-surface handoff from Creator generation to Reader consumption (IMG-INV-06).
Under A3, only **character portrait** Accept into Asset fields (e.g. `portraitUrl`) is Production-authorized; `story_images_v2` batch generation remains out of A3 scope.

---

## 8. Out of scope

* LoRA training pipelines
* Multi-provider fallback graphs beyond Deployment Adapter Local↔Cloud switch
* Video generation
* Production Budget hard enforcement (A3 Constraint E)
* Database schema changes
* Freezing Creator Local (or any provider) as Architecture
* Reader hot-path generation
* Scene-frame / `story_images_v2` production generation
* Rollout / Discovery / production Copilot auto-image

---

## 9. Spike Implementation Authorization (granted)

| Spike | Authorized artifact | Role |
| ----- | ------------------- | ---- |
| SPIKE-IMG-001 | `docs/spikes/spike-img-001-image-runtime-port.md` | Port + cloud draft/accept + reference consistency |
| SPIKE-IMG-002 | `docs/spikes/spike-img-002-local-image-generation.md` | Optional Local Deployment adapter research |

**Allowlist (union):** `lib/ai/image/**`, `scripts/**` (spike runners, including local HTTP helpers used only by spikes), temporary spike adapters/config, spike Findings updates, gitignored spike outputs.

**Denylist (Spike-only):** Rollout, Discovery, production Copilot, Reader runtime, DB schema, production Cloudinary contract redesign, any Runtime Truth path outside Spike allowlist **except** as separately granted under §9a.

**Exit Criteria & Findings:** defined in each Spike document. Passing a Spike does **not** auto-grant Production Authorization.

---

## 9a. Production Authorization (granted — scoped, A3)

**Authority:** ADR-010 Amendment **A3** · Architect Decision 2026-07-20 — GRANT WITH CONSTRAINTS (A–F)

### Authorized

| Item | Status |
| ---- | ------ |
| Creator Runtime | Authorized |
| Character Portrait via Image Generation Port | Authorized |
| Deployment Adapter | Authorized |
| Local as Creator Production Default | Authorized — **Deployment only** (Constraint F) |
| Cloud as Fallback / Accept Baseline | Authorized |
| Human Accept → `portraitUrl` (ADR-004) | Authorized |

### Production allowlist (MAY modify under A3)

* `app/actions/generateCharacterAvatar.ts` (and tightly coupled Creator portrait UI wiring)
* `lib/ai/image/**` (Port, factory, Deployment Adapter bindings used by production Creator path)
* Creator-facing config/env for Deployment Adapter (Local default + Cloud fallback)
* Existing Cloudinary **upload** usage for Accept into Asset URLs (no contract redesign)

### Production denylist (MUST NOT under A3)

* Reader runtime / `raree-show-web` generation hot path
* Rollout / Discovery / production Copilot auto-image
* DB schema / migrations
* `story_images_v2` / scene-frame production generation
* Production Budget hard enforcement
* Freezing any Local vendor/model in Architecture or this Contract

### Constraint F (Deployment Default)

```text
Creator Runtime
        ↓
Deployment Adapter
        ├── Local  (Production Default)
        └── Cloud  (Fallback / Accept Baseline)
```

Narrated in `config/infra/deployment-defaults.md`. Replaceable. Not a Contract constant.

---

## 10. Refs

* ADR-010 (v1.3 · Amendments **A1**, **A2**, **A3**)
* SPIKE-IMG-001: `docs/spikes/spike-img-001-image-runtime-port.md`
* SPIKE-IMG-002: `docs/spikes/spike-img-002-local-image-generation.md`
* `governance/specs/POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC.md` §6 (Three-State Authorization)
* `config/infra/deployment-defaults.md` (Creator Local Default + Cloud fallback)
