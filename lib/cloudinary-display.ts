/**
 * Cloudinary delivery helpers.
 * Asset identity remains the stored URL / media_assets.id;
 * these transforms only produce a resolved display representation.
 */

const CLOUDINARY_UPLOAD =
  /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload)\/(.*)$/i;

export type CloudinaryDisplayOptions = {
  /** Long-edge max pixels (c_limit). Default 2400. */
  maxEdge?: number;
  /** Cloudinary `q_` value, e.g. `auto`, `auto:good`, `auto:best`, `80`. */
  quality?: string;
};

/**
 * Work-map pin / Reader-grade delivery. 2400 + `q_auto` is too soft once the
 * picker zooms past fit; original atlas PNGs are multi-MB.
 * 4200 + `q_auto:best` matches raree-show-web work-map display.
 */
export const WORK_MAP_DISPLAY_OPTIONS: CloudinaryDisplayOptions = {
  maxEdge: 4200,
  quality: "auto:best",
};

/**
 * Insert (or refresh) display transforms after `/upload/` without changing public_id.
 * Non-Cloudinary URLs are returned unchanged.
 */
export function cloudinaryDisplayUrl(
  url: string,
  options?: CloudinaryDisplayOptions
): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  const match = CLOUDINARY_UPLOAD.exec(trimmed);
  if (!match) return trimmed;

  const base = match[1];
  let rest = match[2];

  // Drop a leading transform segment if present (no version/folder yet).
  // Cloudinary: transforms are comma-separated tokens before v123/ or bare public_id.
  // Strip known display transforms we manage so re-applying is idempotent.
  rest = stripManagedDisplayTransforms(rest);

  const maxEdge = options?.maxEdge ?? 2400;
  const quality = options?.quality?.trim() || "auto";
  const transforms = `w_${maxEdge},c_limit,f_auto,q_${quality}`;
  return `${base}/${transforms}/${rest}`;
}

/** Remove prior w_/c_limit/f_auto/q_auto segment(s) we may have injected. */
function stripManagedDisplayTransforms(rest: string): string {
  // Pattern: optional transform path segments ending before /v123/ or public_id
  // e.g. "f_auto,q_auto/v1/foo" or "w_2400,c_limit,f_auto,q_auto/v1788/id.png"
  const parts = rest.split("/");
  if (parts.length === 0) return rest;

  const first = parts[0] ?? "";
  // A transform segment contains commas or underscore-prefixed ops, and is NOT a version (v123)
  // and NOT a bare public_id without commas (ambiguous — keep if looks like public_id only).
  if (isTransformSegment(first)) {
    return parts.slice(1).join("/");
  }
  return rest;
}

function isTransformSegment(segment: string): boolean {
  if (!segment) return false;
  if (/^v\d+$/i.test(segment)) return false;
  // Transform tokens look like w_2400,c_limit,f_auto,q_auto
  return /(?:^|,)(?:w_|h_|c_|f_|q_|fl_|dpr_)/.test(segment);
}
