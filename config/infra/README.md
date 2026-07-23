# config/infra — Deployment & operations configuration (narration)

**Layer:** Deployment / Infra only — **not** Architecture, Policy, or Runtime Contract.

This tree holds **replaceable** deployment recommendations and ops matrices. Changing
values here MUST NOT require amending ADR/SPEC Port shape.

| Document | Purpose |
| -------- | ------- |
| [`deployment-defaults.md`](./deployment-defaults.md) | Image Runtime provider defaults, budget examples, showcase pointers, env knobs |
| [`pd-showcase-recommendation-v1.md`](./pd-showcase-recommendation-v1.md) | Public-domain showcase selection & canon subset counts |

**Code bindings:** `lib/ai/image/deploymentConfig.ts` · `IMAGE_CREATOR_*` env  
**Authority docs (unchanged location):** `docs/adr/` · `docs/specs/` · `docs/spikes/`

Do **not** put Deployment Defaults back under `docs/deployment/` — that path is gitignored.
