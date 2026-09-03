import { describe, expect, it } from "vitest";

import { createMediaAdmissionProviders } from "@/lib/media-admission/factory";
import {
  assertHttpUrl,
  pasteUrlProvider,
} from "@/lib/media-admission/providers/pasteUrl";
import { Z_IMAGE_TURBO_CAPABILITY } from "@/lib/ai/image/rendererCapability";
import { buildFrameDraftPrompt, buildFrameNegativePrompt } from "@/lib/prompts/frame-draft";

describe("pasteUrl provider", () => {
  it("accepts https URLs", async () => {
    const candidate = await pasteUrlProvider.obtainCandidate({
      url: "https://cdn.example.com/frame.png",
    });
    expect(candidate.source).toBe("paste_url");
    expect(candidate.url).toBe("https://cdn.example.com/frame.png");
  });

  it("rejects non-http(s) schemes", () => {
    expect(() => assertHttpUrl("ftp://files.example.com/a.jpg")).toThrow(
      /http\(s\)/
    );
    expect(() => assertHttpUrl("javascript:alert(1)")).toThrow(/http\(s\)/);
    expect(() => assertHttpUrl("not-a-url")).toThrow();
  });
});

describe("media admission factory", () => {
  it("lists Phase 1 channels only (no scene-frame provider)", () => {
    const ids = createMediaAdmissionProviders().map((p) => p.id);
    expect(ids).toEqual(["local_upload", "paste_url"]);
  });

  it("respects enabled filter", () => {
    const ids = createMediaAdmissionProviders({
      enabled: ["paste_url"],
    }).map((p) => p.id);
    expect(ids).toEqual(["paste_url"]);
  });
});

describe("frame draft prompt (derived Job input)", () => {
  it("derives a short Local caption prompt without triple-repeat wrapper", () => {
    const prompt = buildFrameDraftPrompt({
      caption: "街垒夜战",
      routeTitle: "巴黎起义",
      projectionProfile: "local",
    });
    expect(prompt).toContain("街垒夜战");
    expect(prompt).toContain("Scene:");
    expect(prompt).not.toMatch(/VISUAL LOCK/i);
    expect(prompt).toMatch(/cinematic historical|painterly/i);
    expect(prompt).not.toMatch(/digital illustration/i);
    expect(prompt).not.toContain("巴黎起义");
    expect(prompt).not.toContain("Scene content (authoritative):");
    expect(prompt).not.toContain("Must match scene:");
    expect(prompt.length).toBeLessThanOrEqual(
      Z_IMAGE_TURBO_CAPABILITY.promptBodyMaxChars
    );
  });

  it("rewrites recruitment-notice cues that paint glyphs on Local", () => {
    const prompt = buildFrameDraftPrompt({
      caption:
        "Prefect Liu Yan posts the official recruitment notice in Zhuozhou.",
      projectionProfile: "local",
    });
    expect(prompt).not.toMatch(/recruitment notice/i);
    expect(prompt).toMatch(/blank unmarked board|no writing/i);
    expect(prompt).not.toMatch(/VISUAL LOCK/i);
  });

  it("requires caption meaning via non-empty caption string", () => {
    const prompt = buildFrameDraftPrompt({
      caption: "  alone  ",
      projectionProfile: "local",
    });
    expect(prompt).toContain("alone");
  });

  it("promotes operator revision ahead of scene caption", () => {
    const prompt = buildFrameDraftPrompt({
      caption: "街垒夜战\n\n[操作员修改意见] 雨夜、火光更强、少一点人",
      routeTitle: "巴黎起义",
      projectionProfile: "local",
    });
    expect(prompt.indexOf("OPERATOR OVERRIDE")).toBeLessThan(
      prompt.indexOf("街垒夜战")
    );
    expect(prompt).toContain("雨夜、火光更强、少一点人");
    expect(prompt).not.toContain("巴黎起义");
    expect(prompt.split("雨夜、火光更强、少一点人").length - 1).toBe(1);
    expect(prompt).not.toContain("Remember operator override");
  });

  it("does not triple-repeat caption on Local", () => {
    const prompt = buildFrameDraftPrompt({
      caption: "桥上诀别",
      projectionProfile: "local",
    });
    const hits = prompt.split("桥上诀别").length - 1;
    expect(hits).toBe(1);
  });

  it("keeps dense caption wrapper on cloud profile", () => {
    const prompt = buildFrameDraftPrompt({
      caption: "街垒夜战",
      routeTitle: "巴黎起义",
      projectionProfile: "cloud",
    });
    expect(prompt).toContain("Scene content (authoritative):");
    expect(prompt).toContain("Must match scene:");
    expect(prompt.toLowerCase()).toContain("narrative reading still");
  });

  it("prefers short rendererExpression transport over caption wrapper", () => {
    const prompt = buildFrameDraftPrompt({
      caption: "legacy caption",
      rendererExpression: {
        environment: "bridge at dusk",
        characters: [{ role: "lovers", visual: "facing each other" }],
        action: "couple parting on bridge",
        composition: "centered couple, river below",
      },
      projectionProfile: "local",
    });
    expect(prompt).toContain("couple parting on bridge");
    expect(prompt).not.toContain("legacy caption");
    expect(prompt).not.toContain("Scene content (authoritative)");
    expect(prompt.length).toBeLessThanOrEqual(
      Z_IMAGE_TURBO_CAPABILITY.promptBodyMaxChars
    );
  });

  it("frame negatives allow groups unlike avatar", () => {
    const neg = buildFrameNegativePrompt("街垒夜战多人");
    expect(neg).toContain("blank");
    expect(neg).toContain("caption overlay");
    expect(neg).not.toMatch(/\bcrowd\b/);
    expect(neg).not.toMatch(/\bmultiple characters\b/);
  });
});
