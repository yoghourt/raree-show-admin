# Rollout Hotfix — Acceptance Report

**Date:** 2026-07-12  
**Scope:** Product Target Recovery (option 1 — shared `scenes` / `story_images_v2`)

## Acceptance checklist

| Criterion | Status |
| --------- | ------ |
| Discovery Story maps to Admin Reading Route (`scenes`) | ✓ |
| Discovery Scene maps to Admin Reading Frame (`story_images_v2` on parent Route) | ✓ |
| Rollout performs Runtime materialization only (no Scene→Route conversion) | ✓ |
| Runtime Reading RC1 / SPEC-RDX-001 / raree-show-web unchanged | ✓ (no Reader edits) |
| No new ADRs | ✓ |
| Soft-deprecate `story_units` / `approved_scene_units` / SPL as editorial authority | ✓ |
| Tests updated for Hotfix mapping | ✓ |

## Deliverables

| Artifact | Path |
| -------- | ---- |
| Product recovery note | `docs/implementation/rollout-hotfix-product-recovery.md` |
| Architecture | `docs/implementation/rollout-projection-architecture-sprint-1.md` |
| Impact report | `docs/implementation/rollout-hotfix-impact-report.md` |
| Migration notes | `docs/implementation/rollout-hotfix-migration-notes.md` |
| SPEC amendments | `docs/specs/spec-rol-001-governed-projection.md`, `spec-rol-002-projection-semantics.md` |
| SQL | `docs/supabase/migrations/20260712010000_rollout_route_frame_provenance.sql` |

## Key code

| Module | Role |
| ------ | ---- |
| `lib/rollout/reading-route-persist.ts` | Story → Route |
| `lib/rollout/reading-frame-persist.ts` | Scene → Frame |
| `lib/rollout/projection-engine.ts` | Frame validate/execute/unpersist |
| `lib/rollout/story-units.ts` | Facade (ApprovedStoryUnit shape, id = route tsid) |

## Explicit non-goals verified

- No Discovery generation redesign
- No DROP of deprecated tables
- No Reader / web behavior changes
