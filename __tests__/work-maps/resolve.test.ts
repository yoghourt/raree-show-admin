import { describe, expect, it } from "vitest";

import {
  isValidLocationPin,
  normalizeLocationPinForPersist,
  resolveWorkMap,
} from "@/lib/work-maps/resolve";

describe("resolveWorkMap", () => {
  it("returns not_applicable when capability is off", () => {
    expect(
      resolveWorkMap({
        map_capability: "off",
        work_map: null,
        published_asset_url: null,
      })
    ).toEqual({ status: "not_applicable" });
  });

  it("returns not_map_ready when required but no row", () => {
    const r = resolveWorkMap({
      map_capability: "required",
      work_map: null,
      published_asset_url: null,
    });
    expect(r.status).toBe("not_map_ready");
    if (r.status === "not_map_ready") {
      expect(r.reasons).toContain("missing_work_map_row");
    }
  });

  it("returns not_map_ready when geometry or asset incomplete", () => {
    const r = resolveWorkMap({
      map_capability: "required",
      work_map: {
        geometry_id: null,
        geometry_accepted_at: null,
        published_asset_id: null,
        published_asset_accepted_at: null,
      },
      published_asset_url: null,
    });
    expect(r.status).toBe("not_map_ready");
    if (r.status === "not_map_ready") {
      expect(r.reasons).toContain("geometry_not_accepted");
      expect(r.reasons).toContain("published_asset_missing");
    }
  });

  it("returns ready with asset id and resolved url", () => {
    const r = resolveWorkMap({
      map_capability: "required",
      work_map: {
        geometry_id: "geom_a",
        geometry_accepted_at: "2026-09-08T00:00:00Z",
        published_asset_id: "asset_1",
        published_asset_accepted_at: "2026-09-08T00:01:00Z",
      },
      published_asset_url: "https://cdn.example/map.png",
    });
    expect(r).toEqual({
      status: "ready",
      geometry_id: "geom_a",
      published_asset_id: "asset_1",
      published_asset_url: "https://cdn.example/map.png",
    });
  });
});

describe("isValidLocationPin", () => {
  it("rejects Westeros-era pins missing geometry_id", () => {
    expect(
      isValidLocationPin(
        { map_focus_x: 0.4, map_focus_y: 0.2, map_focus_geometry_id: null },
        "geom_a"
      )
    ).toBe(false);
  });

  it("rejects pin bound to a different geometry", () => {
    expect(
      isValidLocationPin(
        {
          map_focus_x: 0.4,
          map_focus_y: 0.2,
          map_focus_geometry_id: "geom_old",
        },
        "geom_a"
      )
    ).toBe(false);
  });

  it("accepts pin matching current geometry", () => {
    expect(
      isValidLocationPin(
        {
          map_focus_x: 0.4,
          map_focus_y: 0.2,
          map_focus_geometry_id: "geom_a",
        },
        "geom_a"
      )
    ).toBe(true);
  });

  it("rejects mixed x/y presence", () => {
    expect(
      isValidLocationPin(
        { map_focus_x: 0.4, map_focus_y: null, map_focus_geometry_id: "geom_a" },
        "geom_a"
      )
    ).toBe(false);
  });
});

describe("normalizeLocationPinForPersist", () => {
  it("clears all three fields when coords absent", () => {
    expect(
      normalizeLocationPinForPersist(
        { map_focus_x: null, map_focus_y: null, map_focus_geometry_id: "x" },
        "geom_a"
      )
    ).toEqual({
      map_focus_x: null,
      map_focus_y: null,
      map_focus_geometry_id: null,
    });
  });

  it("binds geometry_id when pinning", () => {
    expect(
      normalizeLocationPinForPersist(
        { map_focus_x: 0.5, map_focus_y: 0.25, map_focus_geometry_id: null },
        "geom_a"
      )
    ).toEqual({
      map_focus_x: 0.5,
      map_focus_y: 0.25,
      map_focus_geometry_id: "geom_a",
    });
  });

  it("throws when pinning without Work geometry", () => {
    expect(() =>
      normalizeLocationPinForPersist(
        { map_focus_x: 0.5, map_focus_y: 0.25, map_focus_geometry_id: null },
        null
      )
    ).toThrow(/geometry_id/);
  });
});
