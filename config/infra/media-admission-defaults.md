# Media Admission — Deployment defaults (Phase 1)

**Layer:** Deployment / Infra only — **not** Architecture or Runtime Contract.  
**Authority:** SPIKE-AA-001 Phase 1 implementation grant · SPEC-CPP-001 Gates A/E.

## Purpose

Replaceable knobs for **Media Admission** candidate providers used by CPP Batch Frame Completion.

Providers supply **ephemeral candidate URLs only**. They MUST NOT write Assets (`story_images_v2`). Human「写入作品」remains the sole Accept path.

## Enabled providers (Phase 1)

| Provider id | UI label | Behavior |
| ----------- | -------- | -------- |
| `local_upload` | 上传 | Cloudinary unsigned upload → candidate URL |
| `paste_url` | 粘贴 URL | Validate `http(s)` → candidate URL (no re-upload) |

**Out of scope:** scene-frame AI (ADR-010 A3 Constraint B unchanged).

## Code bindings

- Port / providers: `lib/media-admission/`
- CPP UI: `components/production/BatchFrameCompletion.tsx`
- Accept write: `lib/scenes.patchSceneFrameUrls`

## Non-goals

No durable `media_candidates` table as Truth · no auto-write on provider success · no Temporal / queue for Phase 1.
