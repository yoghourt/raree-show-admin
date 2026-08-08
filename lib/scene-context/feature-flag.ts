/**
 * IMPLEMENT-SCC-001-S1 — Context-aware projection enablement.
 *
 * Default OFF → legacy Hot Path (Scene staging → Frame).
 * Rollback: unset SCENE_CONTEXT_PROJECTION_ENABLED (or set to 0/false).
 */

function truthy(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * Global switch for Context-aware projection path.
 */
export function isSceneContextProjectionGloballyEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return truthy(env.SCENE_CONTEXT_PROJECTION_ENABLED);
}

/**
 * Optional Work allowlist. Empty / unset = all works when globally enabled.
 */
export function getSceneContextWorkAllowlist(
  env: NodeJS.ProcessEnv = process.env
): Set<string> | null {
  const raw = env.SCENE_CONTEXT_WORK_ALLOWLIST?.trim();
  if (!raw) return null;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length ? new Set(ids) : null;
}

/**
 * Whether Context-aware projection is active for a Work.
 */
export function isSceneContextProjectionEnabledForWork(
  workId: string,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (!isSceneContextProjectionGloballyEnabled(env)) return false;
  const allow = getSceneContextWorkAllowlist(env);
  if (!allow) return true;
  return allow.has(workId.trim());
}
