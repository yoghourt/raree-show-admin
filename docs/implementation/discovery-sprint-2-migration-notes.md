# Discovery Sprint #2 — Migration Notes

**Scope:** raree-show-admin Discovery Editorial Realignment (Work → Story → Scene)  
**Date:** 2026-07-12  
**Reader / Runtime Reading:** unchanged (Product Freeze)

## What changed for operators

1. Discovery Candidate type `"readingRoute"` is now `"scene"` (Editorial Scene).
2. Propose order is Story-first: character → location → **story → scene**.
3. Every Scene Candidate requires `parentStoryCandidateId` pointing at a Story Candidate in the same batch.
4. Accept Scene requires the parent Story to be accepted first.
5. Review UI nests Scenes under Stories (no parallel Work-level Scene section).
6. Revoking Story Accept cascade-removes child Scene staging from Discovery and the Rollout pending queue.

## localStorage / sessionStorage

| Key | Change |
| --- | ------ |
| `discovery_review_snapshot:*` | On load, `candidateType: "readingRoute"` is migrated to `"scene"`. Scene staging without `parentStorySourceReviewId` is dropped (operator must re-accept after re-propose). Story staging missing `sourceCandidateId` is filled from the matching review item when available. |
| `rollout_queue:*` | Writes dual-key `sceneStaging` + in-memory `readingRouteStaging`. Reads prefer `readingRouteStaging`, then legacy `sceneStaging`. Parent Story fields on scene staging are pass-through only (no Projection redesign). |

## Operator action for in-flight sessions

If a Discovery review session was opened before Sprint #2:

1. Prefer **全部重新生成** (full re-propose) on a locked narrative so Scenes receive valid parent Story ids.
2. Re-accept Story, then Scene.
3. If Accept Scene fails with `PARENT_STORY_NOT_ACCEPTED`, accept the parent Story first.
4. Old Rollout queue items without parent metadata remain projectable; new Accepts always include parent refs.

## Compatibility aliases (LLM / parse only)

Parse still accepts JSON keys: `scene`, `scenes`, `scene_candidates`, `readingRoute`, `reading_routes`, etc.  
Public API / UI / types use `"scene"` only.
