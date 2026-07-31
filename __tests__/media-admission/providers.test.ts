import { describe, expect, it } from "vitest";

import { createMediaAdmissionProviders } from "@/lib/media-admission/factory";
import {
  assertHttpUrl,
  pasteUrlProvider,
} from "@/lib/media-admission/providers/pasteUrl";
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
  it("derives from Asset Caption without becoming a stored object", () => {
    const prompt = buildFrameDraftPrompt({
      caption: "街垒夜战",
      routeTitle: "巴黎起义",
    });
    expect(prompt).toContain("街垒夜战");
    expect(prompt).toContain("巴黎起义");
    expect(prompt.toLowerCase()).toContain("narrative reading still");
    expect(prompt).toContain("Scene content (authoritative):");
    expect(prompt).toContain("Must match scene:");
  });

  it("requires caption meaning via non-empty caption string", () => {
    const prompt = buildFrameDraftPrompt({ caption: "  alone  " });
    expect(prompt).toContain("alone");
  });

  it("promotes operator revision ahead of scene caption", () => {
    const prompt = buildFrameDraftPrompt({
      caption: "街垒夜战\n\n[操作员修改意见] 雨夜、火光更强、少一点人",
      routeTitle: "巴黎起义",
    });
    expect(prompt.indexOf("OPERATOR OVERRIDE")).toBeLessThan(
      prompt.indexOf("街垒夜战")
    );
    expect(prompt).toContain("雨夜、火光更强、少一点人");
    expect(prompt).toContain("巴黎起义");
    expect(prompt.indexOf("Remember operator override")).toBeGreaterThan(
      prompt.indexOf("Must match scene:")
    );
  });

  it("repeats scene caption for weak local models", () => {
    const prompt = buildFrameDraftPrompt({ caption: "桥上诀别" });
    const hits = prompt.split("桥上诀别").length - 1;
    expect(hits).toBeGreaterThanOrEqual(3);
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
    });
    expect(prompt).toContain("couple parting on bridge");
    expect(prompt).not.toContain("legacy caption");
    expect(prompt).not.toContain("Scene content (authoritative)");
    expect(prompt.length).toBeLessThan(600);
  });

  it("frame negatives allow groups unlike avatar", () => {
    const neg = buildFrameNegativePrompt("街垒夜战多人");
    expect(neg).toContain("blank");
    expect(neg).toContain("caption overlay");
    expect(neg).not.toMatch(/\bcrowd\b/);
    expect(neg).not.toMatch(/\bmultiple characters\b/);
  });
});
