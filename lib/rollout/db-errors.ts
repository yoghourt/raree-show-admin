/**
 * Supabase / PostgREST relation errors (missing migration tables)
 */

export function isMissingRelationError(error: {
  message?: string;
  code?: string;
}): boolean {
  const message = error.message ?? "";
  return (
    error.code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("Could not find the table") ||
    message.includes("does not exist")
  );
}

export const SCENE_PROJECTION_MIGRATION_HINT =
  "Apply docs/supabase/migrations/20260712000000_rollout_scene_projection.sql in the Supabase SQL editor, then reload.";
