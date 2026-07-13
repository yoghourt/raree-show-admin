# Rollout Hotfix — Migration Notes

**Date:** 2026-07-12

## Apply

Run in Supabase SQL editor (after Sprint #1 projection migration if present):

`docs/supabase/migrations/20260712010000_rollout_route_frame_provenance.sql`

Adds on `scenes`:

- `discovery_source_review_id text` — Story staging provenance
- `frame_provenance_v1 jsonb` — Scene staging → Frame index map
- Unique partial index `(work_id, discovery_source_review_id)` where not null

## raree-show-web / Reader

- **Do not** rely on `SELECT *` for Reader if new columns must stay admin-only; prefer explicit column allowlists.
- Frame Reader contract remains `{url, caption}` inside `story_images_v2`.
- New columns are ignored by RC1 / SPEC-RDX-001 consumers that already select known fields.

## Soft-deprecated tables (no DROP)

| Table | Notes |
| ----- | ----- |
| `story_units` | No longer written on happy path |
| `approved_scene_units` | Orphan rows OK; operator may clear manually |
| `scene_projection_links` | Orphan rows OK |
| `story_scene_links` | Not created on new Frame path |

## Operator cleanup

Existing Sprint #1 StoryUnit / ApprovedScene / SPL rows do not auto-migrate into `scenes` provenance. Re-persist Story staging and re-write Frames from Rollout queue if needed.
