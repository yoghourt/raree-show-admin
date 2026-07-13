# Rollout Sprint #1 — Migration Notes

**Date:** 2026-07-12  
**Sprint:** Projection Completion (ACA-004)

## Database

Apply after `20260705000000_rollout_story_units.sql`:

```text
docs/supabase/migrations/20260712000000_rollout_scene_projection.sql
```

Creates `approved_scene_units` and `scene_projection_links`.

**If Rollout page errors with `Could not find the table 'public.approved_scene_units'`:** open Supabase Dashboard → SQL Editor → paste and run that migration file → refresh the admin app. Until then, GET Rollout degrades to empty projection lists so the page can still load.

## Operator steps for in-flight queues

1. **Parent Story first:** Persist the parent Story unit before Projection Accept. Staging without `parentStorySourceReviewId` cannot project (re-accept from Discovery Sprint #2 if missing).
2. **Re-project after Unproject:** Unproject no longer deletes the Reading Route. It removes SceneProjectionLink (+ companion Story link). Re-project may `link_existing` to the leftover Route.
3. **Client cache:** `projectedReadingRoutes` in sessionStorage remains a UX cache; server `scene_projection_links` is truth after refresh.

## Unproject semantics change

| Before | After (Sprint #1) |
| ------ | ----------------- |
| `create` mode deleted Runtime Reading Route | Link metadata removed only; Route + Approved Scene retained |
| Body used `sceneTsid` + `mode` | Prefer `sourceReviewId` or `sceneProjectionLinkId` |

## Compatibility

- GET `/api/admin/rollout` now returns `approvedSceneUnits` + `sceneProjectionLinks`
- Transport path remains `/api/admin/rollout/reading-route-projection`
