/**
 * Scene chapter_number parsing — shared by Discovery Accept and Rollout projection
 */

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
  return n !== null && n >= 1;
}
