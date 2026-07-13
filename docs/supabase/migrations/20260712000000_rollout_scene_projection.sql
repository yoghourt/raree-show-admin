-- SPEC-ROL-002 / Sprint #1 — Approved Scene units + SceneProjectionLink
-- Apply in Supabase SQL editor after 20260705000000_rollout_story_units.sql

CREATE TABLE IF NOT EXISTS approved_scene_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  parent_story_unit_id uuid NOT NULL REFERENCES story_units(id) ON DELETE RESTRICT,
  source_review_id text NOT NULL,
  title text NOT NULL,
  chapter_number integer NOT NULL,
  chapter_title text,
  summary text,
  approved_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid NOT NULL,
  CONSTRAINT approved_scene_units_unique_source UNIQUE (work_id, source_review_id)
);

CREATE INDEX IF NOT EXISTS idx_approved_scene_units_work_id
  ON approved_scene_units(work_id);
CREATE INDEX IF NOT EXISTS idx_approved_scene_units_parent
  ON approved_scene_units(parent_story_unit_id);

CREATE TABLE IF NOT EXISTS scene_projection_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  approved_scene_unit_id uuid NOT NULL REFERENCES approved_scene_units(id) ON DELETE CASCADE,
  reading_route_tsid text NOT NULL,
  projection_mode text NOT NULL CHECK (projection_mode IN ('create', 'link_existing')),
  source_review_id text NOT NULL,
  companion_story_link_id uuid REFERENCES story_scene_links(id) ON DELETE SET NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  accepted_by uuid NOT NULL,
  CONSTRAINT scene_projection_links_unique_pair UNIQUE (approved_scene_unit_id, reading_route_tsid)
);

-- P01: one Approved Scene → at most one Reading Route until Unproject
CREATE UNIQUE INDEX IF NOT EXISTS idx_scene_projection_links_one_route_per_scene
  ON scene_projection_links(approved_scene_unit_id);

CREATE INDEX IF NOT EXISTS idx_scene_projection_links_work_id
  ON scene_projection_links(work_id);
CREATE INDEX IF NOT EXISTS idx_scene_projection_links_route
  ON scene_projection_links(work_id, reading_route_tsid);
