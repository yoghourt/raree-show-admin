# Media Admission — Deployment defaults (Phase 1 + A4)

**Layer:** Deployment / Infra only — **not** Architecture or Runtime Contract.  
**Authority:** SPIKE-AA-001 · ADR-010 A3/A4 · SPEC-CPP-001 Gates A/E.

## Purpose

Replaceable knobs for Media Admission candidate supply on CPP Batch Frame Completion.

Candidates are **ephemeral**. Providers / Generate MUST NOT write Assets (`story_images_v2`). Human「写入作品」remains the sole Accept path.

## Media Admission source channels (Phase 1)

| Channel id | UI label | Behavior |
| ---------- | -------- | -------- |
| `local_upload` | 上传 | Cloudinary unsigned upload → candidate URL |
| `paste_url` | 粘贴 URL | Validate `http(s)` → candidate URL (no re-upload) |

**Not authorized:** Scene-Frame-specific Media Admission Provider hierarchy.

## Scene Frame Generate (A4)

| Item | Value |
| ---- | ----- |
| Slot action |「生成草稿」on Batch Frame Completion |
| Path | Caption → derived Prompt → Image Generation Port (`generateImageCandidate`, `assetSlot=scene_frame`) → Deployment (Local default / Cloud fallback) → hosted URL → ephemeral Candidate |
| Prompt owner | Derived Job input only; business intent = Asset Caption |
| Logistics | No download / Finder / PNG manage / re-upload / URL copy |

## Code bindings

- MA channels: `lib/media-admission/`
- Frame Generate action: `app/actions/generateFrameDraft.ts`
- Prompt derive: `lib/prompts/frame-draft.ts`
- CPP UI: `components/production/BatchFrameCompletion.tsx`
- Accept write: `lib/scenes.patchSceneFrameUrls`

## Non-goals

No durable `media_candidates` table as Truth · no auto-write on Generate · no Temporal / queue · no Prompt business object.
