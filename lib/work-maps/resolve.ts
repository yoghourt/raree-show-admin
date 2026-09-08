/**
 * IMPLEMENT-WMA-001 / SPEC-WMA-001 — Work Map resolve + pin validity (pure).
 */

export type MapCapability = "off" | "required";

export type WorkMapNotReadyReason =
  | "missing_work_map_row"
  | "geometry_not_accepted"
  | "published_asset_missing"
  | "published_asset_not_accepted";

export type WorkMapResolution =
  | { status: "not_applicable" }
  | { status: "not_map_ready"; reasons: WorkMapNotReadyReason[] }
  | {
      status: "ready";
      geometry_id: string;
      published_asset_id: string;
      /** Resolved runtime representation — not Asset identity. */
      published_asset_url: string;
    };

export type WorkMapAuthorityInput = {
  map_capability: MapCapability;
  work_map: {
    geometry_id: string | null;
    geometry_accepted_at: string | null;
    published_asset_id: string | null;
    published_asset_accepted_at: string | null;
  } | null;
  /** Resolved URL for published_asset_id when present. */
  published_asset_url: string | null;
};

export type LocationPinInput = {
  map_focus_x: number | null | undefined;
  map_focus_y: number | null | undefined;
  map_focus_geometry_id: string | null | undefined;
};

export function resolveWorkMap(input: WorkMapAuthorityInput): WorkMapResolution {
  if (input.map_capability === "off") {
    return { status: "not_applicable" };
  }

  const reasons: WorkMapNotReadyReason[] = [];
  const row = input.work_map;

  if (!row) {
    reasons.push("missing_work_map_row");
    return { status: "not_map_ready", reasons };
  }

  const geometryId = row.geometry_id?.trim() || "";
  if (!geometryId || !row.geometry_accepted_at) {
    reasons.push("geometry_not_accepted");
  }

  const assetId = row.published_asset_id?.trim() || "";
  if (!assetId) {
    reasons.push("published_asset_missing");
  } else if (!row.published_asset_accepted_at) {
    reasons.push("published_asset_not_accepted");
  } else if (!input.published_asset_url?.trim()) {
    reasons.push("published_asset_missing");
  }

  if (reasons.length > 0) {
    return { status: "not_map_ready", reasons };
  }

  return {
    status: "ready",
    geometry_id: geometryId,
    published_asset_id: assetId,
    published_asset_url: input.published_asset_url!.trim(),
  };
}

/** SPEC-WMA-001 §8 — pin valid iff geometry accepted + pair in [0,1] + geometry bind matches. */
export function isValidLocationPin(
  pin: LocationPinInput,
  currentGeometryId: string | null | undefined
): boolean {
  const geometryId = currentGeometryId?.trim() || "";
  if (!geometryId) return false;

  const x = pin.map_focus_x;
  const y = pin.map_focus_y;
  const bind = pin.map_focus_geometry_id?.trim() || "";

  const xMissing = x == null || Number.isNaN(x);
  const yMissing = y == null || Number.isNaN(y);

  if (xMissing && yMissing) return false;
  if (xMissing !== yMissing) return false;
  if (typeof x !== "number" || typeof y !== "number") return false;
  if (x < 0 || x > 1 || y < 0 || y > 1) return false;
  if (!bind || bind !== geometryId) return false;

  return true;
}

/** Pairing rules for persist: both null or both present with geometry_id. */
export function normalizeLocationPinForPersist(
  pin: LocationPinInput,
  currentGeometryId: string | null | undefined
): {
  map_focus_x: number | null;
  map_focus_y: number | null;
  map_focus_geometry_id: string | null;
} {
  const x = pin.map_focus_x;
  const y = pin.map_focus_y;
  const xMissing = x == null || Number.isNaN(Number(x));
  const yMissing = y == null || Number.isNaN(Number(y));

  if (xMissing && yMissing) {
    return {
      map_focus_x: null,
      map_focus_y: null,
      map_focus_geometry_id: null,
    };
  }

  if (xMissing || yMissing) {
    throw new Error("map_focus_x and map_focus_y must both be set or both null");
  }

  const geometryId = currentGeometryId?.trim() || "";
  if (!geometryId) {
    throw new Error("Cannot pin Location without accepted Work geometry_id");
  }

  const nx = Math.min(1, Math.max(0, Number(x)));
  const ny = Math.min(1, Math.max(0, Number(y)));

  return {
    map_focus_x: nx,
    map_focus_y: ny,
    map_focus_geometry_id: geometryId,
  };
}

export function mintGeometryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `geom_${crypto.randomUUID()}`;
  }
  return `geom_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
