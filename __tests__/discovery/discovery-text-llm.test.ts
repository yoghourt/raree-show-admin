/**
 * Discovery text LLM routing — defaults & fallback eligibility
 */

import { afterEach, describe, expect, it, vi } from "vitest";

describe("discovery-text-llm resolve", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to gemini + gemini-3.5-flash-lite", async () => {
    vi.stubEnv("DISCOVERY_TEXT_PROVIDER", "");
    vi.stubEnv("DISCOVERY_TEXT_MODEL", "");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const mod = await import("@/lib/discovery/discovery-text-llm");
    expect(mod.resolveDiscoveryTextProvider()).toBe("gemini");
    expect(mod.resolveDiscoveryTextModel("gemini")).toBe(
      "gemini-3.5-flash-lite"
    );
  });

  it("honors explicit DISCOVERY_TEXT_* overrides", async () => {
    vi.stubEnv("DISCOVERY_TEXT_PROVIDER", "openrouter");
    vi.stubEnv("DISCOVERY_TEXT_MODEL", "openai/gpt-oss-20b:free");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const mod = await import("@/lib/discovery/discovery-text-llm");
    expect(mod.resolveDiscoveryTextProvider()).toBe("openrouter");
    expect(mod.resolveDiscoveryTextModel("openrouter")).toBe(
      "openai/gpt-oss-20b:free"
    );
  });

  it("disables fallback when set to none or same as primary", async () => {
    vi.stubEnv("DISCOVERY_TEXT_PROVIDER", "gemini");
    vi.stubEnv("DISCOVERY_TEXT_FALLBACK_PROVIDER", "none");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const mod = await import("@/lib/discovery/discovery-text-llm");
    expect(mod.resolveDiscoveryTextFallbackProvider("gemini")).toBeNull();

    vi.stubEnv("DISCOVERY_TEXT_FALLBACK_PROVIDER", "gemini");
    vi.resetModules();
    const mod2 = await import("@/lib/discovery/discovery-text-llm");
    expect(mod2.resolveDiscoveryTextFallbackProvider("gemini")).toBeNull();
  });

  it("classifies transport vs non-transport failures", async () => {
    const { isDiscoveryTransportFailure } = await import(
      "@/lib/discovery/discovery-text-llm"
    );
    expect(
      isDiscoveryTransportFailure(new Error("Gemini API 速率限制 (429)"))
    ).toBe(true);
    expect(
      isDiscoveryTransportFailure(
        new Error("LLM output is not a JSON array of candidates")
      )
    ).toBe(false);
  });
});
