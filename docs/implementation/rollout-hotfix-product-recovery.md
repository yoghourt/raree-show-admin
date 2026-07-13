# Rollout Hotfix — Product Target Recovery

**Date:** 2026-07-12  
**Priority:** P0 — Product Alignment  
**No new ADRs.**

## Product freeze

Must not change: raree-show-web, Runtime Reading RC1, W-01, SPEC-RDX-001, Reader Step / Assistant / Navigation / Retrieval / URL / Progress / Animation.

## Recovered mapping

```text
Discovery (candidate vocabulary unchanged: Story / Scene)
  Story Candidate staging  →  Rollout Persist  →  Reading Route (scenes)
  Scene Candidate staging  →  Rollout Persist  →  Reading Frame (story_images_v2[] on parent Route)

Runtime Reader consumes the same scenes + story_images_v2 (identity store).
```

Editorial authority for **new** writes: `scenes` / `story_images_v2` only.

Soft-deprecated as editorial targets: `story_units`, `approved_scene_units`, `scene_projection_links`, `story_scene_links` (no DROP this sprint).

## ADR-005 / ADR-007 note (supersession, not amendment)

- ADR-005 cognitive vocabulary (Story / Scene) still names **Discovery candidates**.
- Storage / product target for Rollout Hotfix is **Reading Route / Reading Frame**.
- Sprint #1 Scene → Reading Route conversion is **retired** for admin Rollout happy path.
- ADRs are not edited; this implementation recovery note records the product freeze supersession for admin Rollout only.

## Projection meaning (Hotfix)

Rollout materializes Runtime entities in the shared store. It does **not** redefine editorial topology via StoryUnit / ApprovedScene intermediates.
