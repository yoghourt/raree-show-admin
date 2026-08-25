import { describe, expect, it } from "vitest";

import { generateImageCandidate } from "@/lib/ai/image/deploymentAdapter";
import {
  loadCreatorImageDeploymentConfig,
  resolveAcceptFallbackProviderId,
} from "@/lib/ai/image/deploymentConfig";
import type { CreatorImageDeploymentConfig } from "@/lib/ai/image/types";

describe("resolveAcceptFallbackProviderId", () => {
  it("treats unset as no fallback", () => {
    expect(resolveAcceptFallbackProviderId(undefined)).toBe("");
  });

  it("treats none/off as no fallback", () => {
    expect(resolveAcceptFallbackProviderId("none")).toBe("");
    expect(resolveAcceptFallbackProviderId("off")).toBe("");
  });

  it("keeps explicit cloud fallback", () => {
    expect(resolveAcceptFallbackProviderId("siliconflow")).toBe("siliconflow");
  });
});

describe("loadCreatorImageDeploymentConfig fallback", () => {
  it("does not default fallback to siliconflow", () => {
    const cfg = loadCreatorImageDeploymentConfig({
      IMAGE_CREATOR_ACCEPT_PROVIDER: "localai",
    });
    expect(cfg.acceptFallbackProviderId).toBe("");
  });
});

describe("generateImageCandidate without fallback", () => {
  it("fails on primary skip and does not mention siliconflow", async () => {
    const config: CreatorImageDeploymentConfig = {
      ...loadCreatorImageDeploymentConfig({
        IMAGE_CREATOR_ACCEPT_PROVIDER: "localai",
      }),
      localBaseUrl: undefined,
      siliconflowKey: "sk-should-not-be-used",
      skipNetwork: false,
    };

    await expect(
      generateImageCandidate(
        { prompt: "test", assetSlot: "portrait" },
        config
      )
    ).rejects.toThrow(/本地出图/);

    await expect(
      generateImageCandidate(
        { prompt: "test", assetSlot: "portrait" },
        config
      )
    ).rejects.not.toThrow(/SiliconFlow|siliconflow/i);
  });
});
