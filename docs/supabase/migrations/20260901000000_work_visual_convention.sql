-- Creator-only work visual convention (era / style / forbids).
-- Not Reader description. Apply in Supabase SQL editor before using the Work form field.

ALTER TABLE works
  ADD COLUMN IF NOT EXISTS visual_convention text NOT NULL DEFAULT '';

COMMENT ON COLUMN works.visual_convention IS
  'Creator-only stable visual convention for this work (style family, era/materials, forbids). Used at propose and image execute. Not Reader copy.';
