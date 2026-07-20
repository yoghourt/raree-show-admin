# Repository AI Adapter

## Governance Authority

Read (authoritative; do not duplicate locally):

- `/governance/FOUNDATION.md`
- `/governance/RETRIEVAL.md`
- `/governance/NAVIGATION.md`
- `/governance/STREAMING.md`
- `/governance/ADR_RULES.md`

These files are the authoritative governance source. Load from the local filesystem at `/governance` only.

`AGENTS.md` declares entrypoints and repo-local runtime paths only; it does not redefine shared governance rules.

### Operationally relevant specs (read from `/governance/specs/`)

- `/governance/specs/CHANGE_TELEMETRY_SPEC.md` — PR/commit narration contract
- `/governance/specs/AUTHORITY_BOUNDARY_AND_PRECEDENCE_SPEC.md` — authority layers and conflict semantics
- `/governance/specs/POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC.md` — Mission → Policy → Runtime Contract → Deployment; **defaults are recommendations**

> After `raree-governance` merges the SPEC above, sync the admin `governance` submodule (`npm run bootstrap` / sync path). Do not edit `governance/` as the source of truth.

### PR templates (transport only; authority = telemetry spec)

- Source: `/governance/templates/PR_TEMPLATE.md` (default)
- Consumer adapter: `.github/pull_request_template.md` (regenerate via `npm run sync:governance`)
- `/governance/templates/ADR_TEMPLATE.md`, `SPIKE_TEMPLATE.md`, `DEBUG_TEMPLATE.md` as applicable

Before governance-aware work, run `npm run check:governance`. Missing governance MUST fail deterministically (`npm run bootstrap`). `npm run dev` runs bootstrap first and syncs `/governance` to `origin/main` latest.

## Repository Runtime Notes

<!-- BEGIN:nextjs-agent-rules -->
### Next.js

This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

### Raree Show Admin (consumer)

- Branch naming: `feat/xxx` or `fix/xxx`
- Auth: Supabase Auth via `middleware.ts` — unauthenticated users redirect to `/login`; authenticated users on `/login` redirect to `/works`
- Data access: `lib/supabase` (browser), `lib/supabase-server` (`createSupabaseServerClient` for Server Components / Route Handlers); entity modules `lib/scenes.ts`, `lib/characters.ts`, `lib/locations.ts`, `lib/works.ts`
- Image upload: Cloudinary unsigned preset `raree-show-admin`, cloud name `dnuxz94n5` (`lib/cloudinary.ts`, `lib/cloudinary/serverUpload.ts`)
- Business IDs: `char_` / `loc_` / `scene_` prefixed TSIDs; `works.id` is uuid; characters/locations use tsid
- `scenes.tsid` is the business ID for WHERE clauses (not `scenes.id`)
- `story_images_v2` jsonb shape: `[{url, caption}]`
- Map coordinates: stored as 0–1 floats (`MapPicker` in `components/locations/MapPicker.tsx`)
- SQL column: `order_index` (not `order`)
- Repo specs under `docs/specs/` and ADRs under `docs/adr/` supplement governance for this codebase; on conflict with `/governance/*`, governance wins unless architecture explicitly updates local ADR/Spec
- Image Runtime (docs): ADR-010 · `docs/specs/spec-img-001-image-generation-port.md` · replaceable stack in `docs/deployment/deployment-defaults.md` (providers/models/USD/showcase titles are **Deployment**, not Runtime constants)
- Runtime surfaces (ADR-010 **A2**): **Creator Runtime ⊥ Reader Runtime** (orthogonal to Text ⊥ Image). Provider Local/Cloud is Deployment per surface — do **not** freeze `Creator = Local` in Architecture
- Image Runtime Spike: **Spike Authorized** / **Production Not Authorized** — `docs/spikes/spike-img-001-image-runtime-port.md` · local optional adapter research `docs/spikes/spike-img-002-local-image-generation.md` (allowlist: `lib/ai/image/**`, `scripts/**` spike runners only)
- Public showcase (Deployment): `docs/deployment/pd-showcase-recommendation-v1.md` — Les Misérables (primary) + Three Kingdoms (visual co-track), canon subset only; GoT not public default

### Runtime Reading Governance (RC1)

Baseline for Reader implementation — authority in this repo only:

```text
SPEC-ROL-001 → SPEC-ROL-002 → SPEC-RDX-001 → docs/specs/runtime-reading-governance-rc1.md
```

Web realization: `raree-show-web` W-01 + `runtime-architecture.md` (cite only; do not redefine capability).
