-- IMPLEMENT-WMA-001 — Work Map Authority (SPEC-WMA-001)
-- Apply in Supabase SQL editor after 20260901000000_work_visual_convention.sql

-- Work map capability knob (default off)
ALTER TABLE works
  ADD COLUMN IF NOT EXISTS map_capability text NOT NULL DEFAULT 'off';

ALTER TABLE works
  DROP CONSTRAINT IF EXISTS works_map_capability_check;

ALTER TABLE works
  ADD CONSTRAINT works_map_capability_check
  CHECK (map_capability IN ('off', 'required'));

COMMENT ON COLUMN works.map_capability IS
  'IMPLEMENT-WMA-001: off = no map surface; required = Work Map Authority must be map-ready. Deployment/authoring choice.';

-- Thin published asset identity (URL is resolved representation only)
CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE media_assets IS
  'IMPLEMENT-WMA-001: opaque media asset identity. Consumers resolve id → url; do not treat url as Work Map Authority.';

-- Work-scoped map authority (0..1 per Work)
CREATE TABLE IF NOT EXISTS work_maps (
  work_id uuid PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
  geometry_id text,
  geometry_accepted_at timestamptz,
  published_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  published_asset_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE work_maps IS
  'IMPLEMENT-WMA-001: Work Map Authority. geometry_id = canonical spatial reference frame; published_asset_id = published visual identity.';

COMMENT ON COLUMN work_maps.geometry_id IS
  'Stable opaque identity of the canonical spatial reference frame. Same id = same frame, not visual resemblance.';

COMMENT ON COLUMN work_maps.published_asset_id IS
  'Published Work Map Asset identity (media_assets.id). MUST NOT store a URL here.';

-- Location pin geometry binding
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS map_focus_geometry_id text;

COMMENT ON COLUMN locations.map_focus_geometry_id IS
  'IMPLEMENT-WMA-001: geometry_id this map_focus_x/y was authored against. Required when x/y present; must match Work geometry_id for validity.';
