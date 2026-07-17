# SPEC-IMG-001 — Image Generation Port

## Metadata

| Field | Value |
| ----- | ----- |
| Title | Image Generation Port |
| Status | Approved (contract freeze; implementation not authorized by this SPEC alone) |
| Version | v0.1 |
| Owner | Architect |
| Last Updated | 2026-07-17 |
| Derived From | ADR-010 · `POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC` |

---

## 1. Purpose

Defines the **Runtime Contract** for Image Runtime: a provider-agnostic Image Generation Port so Text Runtime and Image Runtime remain independently evolvable.

This SPEC freezes **contracts and policy knobs**. It does not freeze providers, models, pricing, or showcase works.

---

## 2. Layer classification

| Content in this SPEC | Layer |
| -------------------- | ----- |
| Port interface; independence from Text Runtime | Architecture / Runtime Contract |
| `portrait_limit`, `scene_frame_limit`, `draft_policy`, `accept_policy` | Runtime Contract (Budget Policy knobs) |
| `reference_strategy`, `consistency_policy` | Runtime Contract (consistency capability) |
| Named providers / models / USD | **Forbidden here** → `docs/deployment/deployment-defaults.md` |

---

## 3. Architecture invariants

1. **IMG-INV-01 — Independence.** Image Runtime MUST NOT require Text Runtime’s provider or session model.
2. **IMG-INV-02 — Port only.** Application code that generates images MUST call the Image Generation Port, not a vendor SDK directly (adapters may wrap SDKs behind the Port).
3. **IMG-INV-03 — No vendor lock in contract.** Runtime Contract MUST remain valid if Deployment swaps adapters.

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

Deployment MAY map a `usd_cap` into the knobs above; Runtime reads the knobs.

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

Elevating any candidate to a frozen contract requires a new ADR amendment plus SPEC update.

---

## 7. Relationship to Asset fields

Character `portraitUrl` and Reading Route `story_images_v2` remain **Asset** fields under ADR-004 classification. This Port produces bytes/URLs that humans Accept into those fields; AI is not Canonical Truth authority.

---

## 8. Out of scope

* Production wiring of Admin actions
* LoRA training pipelines
* Multi-provider fallback graphs
* Video generation

---

## 9. Refs

* ADR-010
* `governance/specs/POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC.md`
* `docs/deployment/deployment-defaults.md`
