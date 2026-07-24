import { describe, expect, it } from "vitest";

import { createMediaAdmissionProviders } from "@/lib/media-admission/factory";
import {
  assertHttpUrl,
  pasteUrlProvider,
} from "@/lib/media-admission/providers/pasteUrl";
import { buildFrameDraftPrompt } from "@/lib/prompts/frame-draft";

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
    expect(prompt.toLowerCase()).toContain("reading still");
  });

  it("requires caption meaning via non-empty caption string", () => {
    const prompt = buildFrameDraftPrompt({ caption: "  alone  " });
    expect(prompt).toContain("alone");
  });
});
