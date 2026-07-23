/**
 * Lean showcase completion profile (Plan-as-config).
 * Not a durable table — replaceable without Asset schema change.
 */
export const LEAN_SHOWCASE_PROFILE_ID = "lean_showcase_v1" as const;

export type LeanShowcaseProfile = {
  id: typeof LEAN_SHOWCASE_PROFILE_ID;
  /** Prefer at least one reading route with frames when measuring visual completeness */
  requireCover: boolean;
  requirePortraitForEachCharacter: boolean;
  /** Frames with non-empty caption must have non-empty url for visual complete */
  requireUrlWhenCaptionPresent: boolean;
};

export const leanShowcaseProfile: LeanShowcaseProfile = {
  id: LEAN_SHOWCASE_PROFILE_ID,
  requireCover: true,
  requirePortraitForEachCharacter: true,
  requireUrlWhenCaptionPresent: true,
};

const PLACEHOLDER_HOST = "placehold.co";

export function isMissingPortraitUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return true;
  try {
    const host = new URL(trimmed).hostname;
    return host === PLACEHOLDER_HOST || host.endsWith(`.${PLACEHOLDER_HOST}`);
  } catch {
    return true;
  }
}

export function isEmptyFrameUrl(url: string | null | undefined): boolean {
  return !(url?.trim());
}
