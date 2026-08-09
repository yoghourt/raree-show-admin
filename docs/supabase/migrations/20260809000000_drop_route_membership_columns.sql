-- IMPLEMENT-SCC-001-L3-C — Route membership schema sunset
-- Drop non-authoritative narrative ownership columns from Reading Route (scenes).
-- Appearance / location ownership lives on scene_contexts_v1 (Scene Context).
--
-- Apply in Supabase SQL editor after L3-A/B and scene_contexts_v1 migration.
-- Reader / raree-show-web: must not select these columns (allowlist preferred).

ALTER TABLE scenes
  DROP COLUMN IF EXISTS character_ids;

ALTER TABLE scenes
  DROP COLUMN IF EXISTS location_id;

COMMENT ON TABLE scenes IS
  'Reading Route delivery host; narrative cast/place ownership is Scene Context (scene_contexts_v1), not Route columns';
