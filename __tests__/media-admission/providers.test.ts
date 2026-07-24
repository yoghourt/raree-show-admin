import { describe, expect, it } from "vitest";

import { createMediaAdmissionProviders } from "@/lib/media-admission/factory";
import {
  assertHttpUrl,
  pasteUrlProvider,
} from "@/lib/media-admission/providers/pasteUrl";

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
  it("lists Phase 1 providers by default", () => {
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
