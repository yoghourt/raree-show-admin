import { describe, expect, it } from "vitest";

import {
  CLOUD_CAPABILITY,
  SD35_CAPABILITY,
  Z_IMAGE_TURBO_CAPABILITY,
  lookupRendererCapabilityByModel,
  resolveRendererCapability,
} from "@/lib/ai/image/rendererCapability";
import { expressionToPrompt } from "@/lib/discovery/execution-projection";

describe("lookupRendererCapabilityByModel", () => {
  it("maps Z-Image and sd-3.5 ids", () => {
    expect(lookupRendererCapabilityByModel("Z-Image-Turbo").family).toBe(
      "z-image"
    );
    expect(lookupRendererCapabilityByModel("sd-3.5-medium-ggml").family).toBe(
      "sd35"
    );
    expect(lookupRendererCapabilityByModel("FLUX.1-dev").family).toBe("cloud");
  });

  it("treats Local placeholder sdxl-turbo as Z-Image", () => {
    expect(
      resolveRendererCapability({
        providerId: "local",
        modelId: "sdxl-turbo",
      }).id
    ).toBe(Z_IMAGE_TURBO_CAPABILITY.id);
    expect(
      resolveRendererCapability({ providerId: "localai" }).family
    ).toBe("z-image");
  });

  it("uses cloud row for non-local providers", () => {
    expect(
      resolveRendererCapability({
        providerId: "siliconflow",
        modelId: "black-forest-labs/FLUX.1-dev",
      }).family
    ).toBe("cloud");
    expect(
      resolveRendererCapability({ providerId: "siliconflow" }).promptBodyMaxChars
    ).toBe(CLOUD_CAPABILITY.promptBodyMaxChars);
  });
});

describe("execute join reads the table", () => {
  const longAction =
    "kneeling cloaked man, standing armored corpse leaning over him with both gauntlets clamped around his throat; broken hilt unused on the snow";

  it("Z-Image body budget is the official 512-token conservative chars", () => {
    expect(Z_IMAGE_TURBO_CAPABILITY.promptBodyMaxChars).toBe(1800);
    expect(Z_IMAGE_TURBO_CAPABILITY.negativePromptEffective).toBe(false);
    expect(SD35_CAPABILITY.promptBodyMaxChars).toBe(520);
  });

  it("repairs a trailing bare name at execute without persist pack", () => {
    const prompt = expressionToPrompt(
      {
        environment: "camp courtyard",
        action:
          "Li Su stands left presenting the Red Hare horse and treasure chests of gold and jade; Lü Bu",
        composition: "medium-wide",
        characters: [
          {
            role: "Li Su",
            visual: "standing on left, holding reins of Red Hare horse",
          },
          {
            role: "Lü Bu",
            visual: "standing center, looking intently at the horse",
          },
        ],
      },
      "local",
      Z_IMAGE_TURBO_CAPABILITY
    );
    expect(prompt).toMatch(/Lü Bu/i);
    expect(prompt).toMatch(/standing center/i);
    expect(prompt).not.toMatch(/;\s*Lü Bu\s*[.]?$/i);
  });

  it("sd-3.5 action budget still clips a long overlay clause", () => {
    const sd = expressionToPrompt(
      {
        environment: "forest snow",
        action: longAction,
        composition: "medium-wide",
        characters: [
          { role: "Will", visual: "kneeling in snow, black wool cloak" },
          {
            role: "Ser Waymar Royce",
            visual: "standing corpse, glowing blue eyes, gauntlets on throat",
          },
        ],
      },
      "local",
      SD35_CAPABILITY
    );
    expect(sd.length).toBeLessThanOrEqual(SD35_CAPABILITY.promptBodyMaxChars);
    expect(sd).not.toMatch(/broken hilt unused on the snow/i);
  });
});
