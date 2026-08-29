-- SPEC-CHAR-001 — Creator visual identity on Role (characters row)
-- Apply in Supabase SQL editor before using visualIdentity in Admin.

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS visual_identity text NOT NULL DEFAULT '';

COMMENT ON COLUMN characters.visual_identity IS
  'Creator-only stable visual identity for portrait generation (not Reader description).';
