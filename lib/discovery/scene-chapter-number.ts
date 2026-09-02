/**
 * Scene chapter_number parsing — shared by Discovery Accept and Rollout projection.
 * Sortable index: 0 = prologue / front matter, then 1, 2, … (POV labels go in chapter_title).
 */

export const MIN_SCENE_CHAPTER_NUMBER = 0;

export function parseSceneChapterNumber(
  value: number | string | null | undefined
): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const trimmed = String(value).trim();
  if (trimmed === "") {
    return null;
  }
  const n = Number(trimmed);
  if (Number.isNaN(n)) {
    return null;
  }
  return Math.trunc(n);
}

export function isValidSceneChapterNumber(
  value: number | string | null | undefined
): boolean {
  const n = parseSceneChapterNumber(value);
  return n !== null && n >= MIN_SCENE_CHAPTER_NUMBER;
}
