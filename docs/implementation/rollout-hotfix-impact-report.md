# Rollout Hotfix — Impact Report

**Date:** 2026-07-12  
**Assumption retired:** Editorial Scene → Reading Route conversion

## Modules assuming Scene → Reading Route (before Hotfix)

| Area | Module | Action |
| ---- | ------ | ------ |
| Engine | `lib/rollout/projection-engine.ts` | Rewrite: Scene → Frame on parent Route |
| Adapter | `lib/rollout/reading-route-projection.ts` | Keep path; change semantics to Frame persist |
| Mapper | `lib/rollout/staging-mapper.ts` | Add Frame mapper; Route mapper used for Story→Route |
| Story persist | `lib/rollout/story-units.ts` | Delegate to Route persist / soft-deprecate table writes |
| Route persist | `lib/rollout/reading-route-persist.ts` | **New** — Story → `scenes` |
| Frame persist | `lib/rollout/reading-frame-persist.ts` | **New** — Scene → `story_images_v2` |
| Scenes server | `lib/rollout/scenes-server.ts` | **New** — provenance + frame helpers |
| Approved Scene | `lib/rollout/approved-scene-units.ts` | Soft-deprecate (no happy-path writes) |
| SceneProjectionLink | `lib/rollout/scene-projection-links.ts` | Soft-deprecate |
| Story↔Route links | `lib/rollout/story-scene-links.ts` | Soft-deprecate new-path creates; list may empty |
| API | `app/api/admin/rollout/**` | Semantics change; URLs kept where possible |
| UI | `components/rollout/RolloutPanel.tsx` | Route/Frame copy + parent = Route |
| Hook | `hooks/useRollout.ts` | Parent gate via Route provenance |
| Locale | `lib/locale/zh-CN.ts`, `lib/rollout/ui-copy.ts` | Product terminology |
| Types | `lib/rollout/types.ts`, `lib/rollout/schemas.ts` | Frame projection types |
| Tests | `__tests__/rollout/**` | Remap expectations |
| Shared CRUD | `lib/scenes.ts` | Untouched browser CRUD; server path owns provenance |

## Explicit non-impact (freeze)

| Area | Status |
| ---- | ------ |
| Discovery propose / parse / validate generation | Unchanged |
| SPEC-RDX-001 / RC1 / W-01 | Unchanged |
| raree-show-web Reader | Unchanged |
| ADR-005 / ADR-007 files | Not edited |

## Hidden assumptions closed

1. Story durable ≠ Reading Route → **false**; Story persist **is** Route.  
2. Scene Projection Accept creates a Route → **false**; Scene persist **is** Frame.  
3. `approved_scene_units` required for editorial Scene authority → **false** (soft-deprecated).  
4. Companion `story_scene_links` required because Story ≠ Route → **false** for new path.  
5. Rollout empty “阅读路线” tab when only projection metadata exists → fixed by Route/Frame on `scenes`.
