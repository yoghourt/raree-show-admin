import { describe, expect, it } from "vitest";

import { withSceneFrameRendererExpression } from "@/lib/generate-jobs";
import type { RendererExpression } from "@/lib/discovery/visual-contract";

const OLD: RendererExpression = {
  environment: "palace hall",
  characters: [{ role: "Yuan Shao", visual: "robe, sword drawn" }],
  action: "Yuan Shao draws on Dong Zhuo",
  composition: "two figures facing",
};

const NEXT: RendererExpression = {
  environment: "palace courtyard",
  characters: [
    { role: "Yuan Shao", visual: "robe, sword lowered" },
    { role: "Dong Zhuo", visual: "heavy build, blade at side" },
  ],
  action: "Yuan Shao storms out while Dong Zhuo stays",
  composition: "Yuan exiting left, Dong still right",
};

describe("withSceneFrameRendererExpression", () => {
  it("replaces renderer_expression and keeps caption/index", () => {
    const next = withSceneFrameRendererExpression(
      {
        asset_slot: "scene_frame",
        frame_index: 2,
        caption: "Yuan Shao storms out",
        route_title: "Luoyang",
        renderer_expression: OLD,
      },
      NEXT
    );
    expect(next.frame_index).toBe(2);
    expect(next.caption).toBe("Yuan Shao storms out");
    expect(next.route_title).toBe("Luoyang");
    expect(next.renderer_expression).toEqual(NEXT);
  });
});
