# config/infra — Deployment & operations configuration (narration)

**Layer:** Deployment / Infra only — **not** Architecture, Policy, or Runtime Contract.

This tree holds **replaceable** deployment recommendations and ops matrices. Changing
values here MUST NOT require amending ADR/SPEC Port shape.

| Document | Purpose |
| -------- | ------- |
| [`deployment-defaults.md`](./deployment-defaults.md) | Image Runtime provider defaults, budget examples, showcase pointers, env knobs |
| [`renderer-capability-defaults.md`](./renderer-capability-defaults.md) | Model-keyed execute prompt/size budgets (Z-Image official tokens vs this-host YAML) |
| [`pd-showcase-recommendation-v1.md`](./pd-showcase-recommendation-v1.md) | Public-domain showcase selection & canon subset counts |
| [`media-admission-defaults.md`](./media-admission-defaults.md) | Media Admission Phase 1 providers (upload · paste URL) |
| [`discovery-text-defaults.md`](./discovery-text-defaults.md) | Discovery propose text provider/model (gemini-3.5-flash-lite primary) |
| [`scene-context-defaults.md`](./scene-context-defaults.md) | IMPLEMENT-SCC-001-S1 Context-aware projection env knobs + rollback |

**Code bindings:** `lib/ai/image/deploymentConfig.ts` · `IMAGE_CREATOR_*` env · `lib/media-admission/`  
**Authority docs (unchanged location):** `docs/adr/` · `docs/specs/` · `docs/spikes/`

Do **not** put Deployment Defaults back under `docs/deployment/` — that path is gitignored.
