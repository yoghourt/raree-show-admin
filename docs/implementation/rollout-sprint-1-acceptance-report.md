# Rollout Sprint #1 — Acceptance Report (ACA-004)

**Sprint:** Projection Completion  
**Repo:** raree-show-admin only  
**Date:** 2026-07-12

## Verdict

| Gate | Result |
| ---- | ------ |
| Projection explicit (validate → execute → Runtime) | ✓ |
| Projection validation (parent Story, belonging, accepted, completeness) | ✓ |
| Ownership isolated to Rollout | ✓ |
| Runtime entities only through Projection Accept | ✓ |
| Reader / RC1 / W-01 / SPEC-RDX-001 unchanged | ✓ |
| Discovery Sprint #2 hierarchy preserved | ✓ |
| ADR-007 / SPEC-ROL-001 / SPEC-ROL-002 realized | ✓ |

## What shipped

1. Projection Engine (`lib/rollout/projection-engine.ts`)
2. Durable `approved_scene_units` + `scene_projection_links`
3. API wiring: GET rollout lists; Projection Accept / Unproject via engine
4. UI: projection validation checklist; Editorial → Projection → Runtime copy
5. OQ-ROL2-P01–P06 closed in SPEC-ROL-002; ROL-001 §4.4 note
6. Architecture + migration notes

## Explicit non-goals (frozen)

- No Reader Step / Frame / Assistant / URL / progress changes
- No SPEC-RDX-001 / RC1 / W-01 / runtime-architecture edits
- No Discovery redesign
- No Scene↔Reading Frame mapping

## Test evidence

```text
npx vitest run __tests__/rollout
→ 5 files, 27 tests passed
npx tsc --noEmit → clean
```

## ACA-004 — Architect Conformance Checklist

| Check | Status | Evidence |
| ----- | ------ | -------- |
| Projection is explicit capability | ✓ | validate → execute pipeline |
| Parent Story persisted before Scene projection | ✓ | `PARENT_STORY_NOT_PERSISTED` |
| Scene belongs under Story | ✓ | parent sourceReviewId → story_units |
| SceneProjectionLink durable | ✓ | `scene_projection_links` |
| StoryProjectionLink distinct (P06) | ✓ | separate `story_scene_links` |
| Unproject does not silent-delete Route/Approved Scene | ✓ | ROL2-PR-06 |
| Runtime topology unchanged | ✓ | still `scenes` / `story_images_v2` |
| No RDX / reader drift | ✓ | admin Rollout only |
| Discovery Sprint #2 unchanged | ✓ | no Discovery Accept rewrite |

**ACA-004 recommendation:** APPROVE for merge pending Architect sign-off (after applying DB migration in target environments).
