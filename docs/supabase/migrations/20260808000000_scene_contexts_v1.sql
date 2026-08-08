-- IMPLEMENT-SCC-001-S1 — Scene Context runtime representation (additive)
-- Apply in Supabase SQL editor after 20260712010000_rollout_route_frame_provenance.sql
--
-- Storage host = Reading Route row (scenes). Storage host ≠ ownership.
-- Scene Context owns narrative context; Frame remains {url,caption};
-- Route character_ids / location_id are NOT removed (migration debt).

ALTER TABLE scenes
  ADD COLUMN IF NOT EXISTS scene_contexts_v1 jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN scenes.scene_contexts_v1 IS
  'IMPLEMENT-SCC-001-S1: Scene Context ownership records [{contextId, editorialAssociation, narrativeMoment, characterAppearanceContext, locationContext, creationFacingVisualExpression, projectsToFrameIndex, ...}]. Delivery host storage only — Route does not own narrative context. Ignored by Reader URL topology.';
