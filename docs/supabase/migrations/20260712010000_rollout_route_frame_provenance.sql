-- Hotfix Product Recovery — Reading Route / Frame provenance on scenes
-- Apply in Supabase SQL editor after 20260712000000_rollout_scene_projection.sql
-- Reader / raree-show-web: prefer column allowlists; these columns are admin provenance only.

ALTER TABLE scenes
  ADD COLUMN IF NOT EXISTS discovery_source_review_id text;

ALTER TABLE scenes
  ADD COLUMN IF NOT EXISTS frame_provenance_v1 jsonb NOT NULL DEFAULT '[]'::jsonb;

-- One Discovery Story staging → at most one Reading Route per work
CREATE UNIQUE INDEX IF NOT EXISTS idx_scenes_work_discovery_source_review
  ON scenes(work_id, discovery_source_review_id)
  WHERE discovery_source_review_id IS NOT NULL;

COMMENT ON COLUMN scenes.discovery_source_review_id IS
  'Rollout Hotfix: AcceptedStoryUnitStaging.sourceReviewId when Route was persisted from Discovery Story';

COMMENT ON COLUMN scenes.frame_provenance_v1 IS
  'Rollout Hotfix: [{sourceReviewId, frameIndex}] mapping Scene staging → story_images_v2 index; ignored by Reader';
