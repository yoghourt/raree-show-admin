import { describe, expect, it } from "vitest";

import {
  cloudinaryDisplayUrl,
  WORK_MAP_DISPLAY_OPTIONS,
} from "@/lib/cloudinary-display";

describe("cloudinaryDisplayUrl", () => {
  it("injects display transforms after /upload/", () => {
    const src =
      "https://res.cloudinary.com/dnuxz94n5/image/upload/v1788861483/vnsuqggr4fo6rxw08mhk.png";
    expect(cloudinaryDisplayUrl(src)).toBe(
      "https://res.cloudinary.com/dnuxz94n5/image/upload/w_2400,c_limit,f_auto,q_auto/v1788861483/vnsuqggr4fo6rxw08mhk.png"
    );
  });

  it("is idempotent when transforms already present", () => {
    const once = cloudinaryDisplayUrl(
      "https://res.cloudinary.com/dnuxz94n5/image/upload/v1/raree-show/maps/westeros"
    );
    expect(cloudinaryDisplayUrl(once)).toBe(once);
  });

  it("respects maxEdge", () => {
    const src =
      "https://res.cloudinary.com/dnuxz94n5/image/upload/v1/foo.png";
    expect(cloudinaryDisplayUrl(src, { maxEdge: 1200 })).toContain("w_1200");
  });

  it("applies work-map display quality", () => {
    const src =
      "https://res.cloudinary.com/dnuxz94n5/image/upload/v1788861483/vnsuqggr4fo6rxw08mhk.png";
    expect(cloudinaryDisplayUrl(src, WORK_MAP_DISPLAY_OPTIONS)).toBe(
      "https://res.cloudinary.com/dnuxz94n5/image/upload/w_4200,c_limit,f_auto,q_auto:best/v1788861483/vnsuqggr4fo6rxw08mhk.png"
    );
  });

  it("leaves non-cloudinary URLs unchanged", () => {
    const src = "https://cdn.example/map.png";
    expect(cloudinaryDisplayUrl(src)).toBe(src);
  });
});
