-- SPEC-ROL-001 — story_units + story_scene_links (v1 minimum)
-- Apply in Supabase SQL editor before using Rollout API.

CREATE TABLE IF NOT EXISTS story_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  source_review_id text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  boundary_hint text,
  approved_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_story_units_work_id ON story_units(work_id);
CREATE INDEX IF NOT EXISTS idx_story_units_work_status ON story_units(work_id, status);

CREATE TABLE IF NOT EXISTS story_scene_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  story_unit_id uuid NOT NULL REFERENCES story_units(id) ON DELETE CASCADE,
  scene_tsid text NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  linked_by uuid NOT NULL,
  source text NOT NULL DEFAULT 'operator_projection_accept',
  CONSTRAINT story_scene_links_unique_pair UNIQUE (story_unit_id, scene_tsid)
);

CREATE INDEX IF NOT EXISTS idx_story_scene_links_work_id ON story_scene_links(work_id);
CREATE INDEX IF NOT EXISTS idx_story_scene_links_scene ON story_scene_links(work_id, scene_tsid);
