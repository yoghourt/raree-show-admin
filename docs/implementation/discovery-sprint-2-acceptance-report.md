# Discovery Sprint #2 — Acceptance Report

**Sprint:** #2 Discovery Editorial Realignment  
**Repo:** raree-show-admin only  
**Date:** 2026-07-12

## Verdict

| Gate | Result |
| ---- | ------ |
| Editorial hierarchy Work → Story → Scene | ✓ |
| Runtime Reading / Reader Product Freeze | ✓ |
| Vocabulary (Discovery-facing Scene, not readingRoute product copy) | ✓ |
| Tests (propose / review / staging / API) | ✓ 100 passed |

## What shipped

1. **Contracts:** `DiscoveryCandidateType` `"scene"`; required `SceneCandidateFields.parentStoryCandidateId`; Story staging `sourceCandidateId`; Scene staging `parentStorySourceReviewId` + `parentStoryTitle`.
2. **Propose:** Story-first loop; Scene prompt injects Story list; invalid parents dropped; scene-only retry via `existingStoryCandidates`.
3. **Review:** Accept Scene requires accepted parent Story (`PARENT_STORY_NOT_ACCEPTED`); Story revoke cascade-removes child Scene staging; snapshot tolerant migrate of legacy `"readingRoute"`.
4. **UI / locale:** Nested Review under Story; Editorial Scene copy (`场景候选`); Discovery labels no longer say「阅读路线候选」.
5. **Rollout pass-through:** Zod + queue dual-write `sceneStaging`; parent fields optional for legacy; no Projection redesign.
6. **SPECs:** SPEC-D3-001/002/003 updated for hierarchy and staging shapes.

## Explicit non-goals (frozen)

- No edits to SPEC-RDX-001, RC1, W-01, runtime-architecture.md, or raree-show-web reader modules.
- No Rollout Projection Accept / Runtime Reading Route create redesign.
- Zero reader-visible change.

## Behavior regression note

Admin Discovery / staging only. Runtime catalog Reading Routes and reader surfaces are untouched.

## Test evidence

```text
npx vitest run __tests__/discovery __tests__/api/discovery-propose-route.test.ts __tests__/rollout/sync-discovery-staging.test.ts
→ 9 files, 100 tests passed
```

Covered: story→scene order, parent id required, accept scene without story fails, nested staging parent fields, LLM `readingRoute` parse alias, queue `sceneStaging` read alias.

## Migration

See `docs/implementation/discovery-sprint-2-migration-notes.md`.

---

## ACA-003 — Architect Conformance Checklist

| Check | Status | Evidence |
| ----- | ------ | -------- |
| Editorial Scene always has parent Story at Accept | ✓ | `prepareAcceptReview` + `PARENT_STORY_NOT_ACCEPTED` |
| No Work-level sibling Scene staging from new Accept | ✓ | Staging writes parent Story refs; Review nests under Story |
| Discovery public type is `"scene"` (not product `readingRoute`) | ✓ | `propose-types`, UI copy, SPECs |
| LLM/legacy aliases do not redefine Runtime Reading Route | ✓ | Parse aliases only; Runtime UI retains `domain.readingRoute` |
| Runtime Reading docs / web reader untouched | ✓ | Diff scoped to admin Discovery + staging pass-through |
| Rollout Projection not redesigned | ✓ | Parent fields pass-through on staging/Zod/queue only |
| SPEC-D3-001/002/003 aligned | ✓ | Hierarchy + Accept + staging fields documented |
| Operator migration path documented | ✓ | Sprint #2 migration notes |

**ACA-003 recommendation:** APPROVE for merge pending Architect sign-off.
