# Rollout Projection Architecture — Hotfix Product Recovery

**Date:** 2026-07-12  
**Authority:** Product Freeze Contract (Hotfix); SPEC-ROL-001/002 Hotfix amendments  
**Supersedes:** Sprint #1 Scene → Reading Route conversion model for admin Rollout

## Boundary

```text
Editorial ingress (Discovery Accept / staging only)
        ↓
Rollout Persist Reading Route   ← Story staging → scenes
        ↓
Rollout Persist Reading Frame   ← Scene staging → story_images_v2[] on parent Route
        ↓
Runtime Representation = same rows (Reader / RDX unchanged)
```

Projection **ends** when Route and/or Frame rows exist in `scenes` / `story_images_v2`.  
Reader Step / Frame navigation / RDX remain **out of scope** (RC1 freeze).

## Modules

| Module | Role |
| ------ | ---- |
| `lib/rollout/reading-route-persist.ts` | Story staging → Reading Route (`scenes`) |
| `lib/rollout/reading-frame-persist.ts` | Scene staging → Reading Frame on parent Route |
| `lib/rollout/projection-engine.ts` | validate → execute Frame persist / unpersist Frame |
| `lib/rollout/reading-route-projection.ts` | Thin API adapter (legacy path names) |
| `lib/rollout/scenes-server.ts` | Server helpers: provenance, frames, CRUD |

## Persistence

Migration: `docs/supabase/migrations/20260712010000_rollout_route_frame_provenance.sql`

- `scenes.discovery_source_review_id` — Story staging provenance (unique per work when set)
- `scenes.frame_provenance_v1` — Scene staging → Frame index map (admin-only; Reader ignores)

Soft-deprecated tables (no happy-path writes): `story_units`, `approved_scene_units`, `scene_projection_links`, `story_scene_links`.

## Validation gates

1. Staging `workId` match  
2. Scene: `parentStorySourceReviewId` present  
3. Parent Reading Route persisted (`discovery_source_review_id` match)  
4. Frame field mapping valid (title → caption)  
5. Not already framed for same `sourceReviewId` (idempotent update)  

## Terminology

Discovery candidates: Story / Scene (ADR-005 vocabulary).  
Product storage: Reading Route / Reading Frame.  
Discovery Accept ≠ Rollout Persist.
