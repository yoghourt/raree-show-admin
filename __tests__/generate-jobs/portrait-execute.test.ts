/**
 * Unit tests — generate-jobs portrait / scene_frame parse + execute dispatch
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/capability", () => ({
  imageGenerate: vi.fn(),
}));

vi.mock("@/lib/cloudinary/serverUpload", () => ({
  uploadImageBufferToCloudinary: vi.fn(),
}));

const { imageGenerate } = await import("@/lib/ai/capability");
const { uploadImageBufferToCloudinary } = await import(
  "@/lib/cloudinary/serverUpload"
);
const {
  parseCharacterPortraitJobInput,
  parseSceneFrameJobInput,
} = await import("@/lib/generate-jobs");
const { executeImageGenerateJob } = await import(
  "@/lib/generate-jobs/executeImageGenerate"
);

describe("parseCharacterPortraitJobInput", () => {
  it("parses portrait input_json", () => {
    expect(
      parseCharacterPortraitJobInput({
        asset_slot: "portrait",
        name: "Waymar Royce",
        description: "Night's Watch ranger",
        reference_url: "https://example.com/ref.png",
      })
    ).toEqual({
      asset_slot: "portrait",
      name: "Waymar Royce",
      description: "Night's Watch ranger",
      reference_url: "https://example.com/ref.png",
    });
  });

  it("rejects non-portrait asset_slot", () => {
    expect(() =>
      parseCharacterPortraitJobInput({
        asset_slot: "scene_frame",
        name: "x",
      })
    ).toThrow(/portrait/);
  });
});

describe("executeImageGenerateJob dispatch", () => {
  beforeEach(() => {
    vi.mocked(imageGenerate).mockReset();
    vi.mocked(uploadImageBufferToCloudinary).mockReset();
  });

  it("dispatches portrait to assetSlot=portrait", async () => {
    vi.mocked(imageGenerate).mockResolvedValue({
      bytes: Buffer.from("img"),
      mimeType: "image/png",
      usedFallback: false,
    } as Awaited<ReturnType<typeof imageGenerate>>);
    vi.mocked(uploadImageBufferToCloudinary).mockResolvedValue(
      "https://res.cloudinary.com/demo/portrait.png"
    );

    const result = await executeImageGenerateJob({
      capabilityId: "image.generate",
      portrait: parseCharacterPortraitJobInput({
        asset_slot: "portrait",
        name: "Arya",
        description: "assassin",
      }),
    });

    expect(result.ok).toBe(true);
    expect(imageGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        assetSlot: "portrait",
        size: { width: 1024, height: 1024 },
      })
    );
  });

  it("dispatches scene_frame unchanged", async () => {
    vi.mocked(imageGenerate).mockResolvedValue({
      bytes: Buffer.from("img"),
      mimeType: "image/png",
      usedFallback: false,
    } as Awaited<ReturnType<typeof imageGenerate>>);
    vi.mocked(uploadImageBufferToCloudinary).mockResolvedValue(
      "https://res.cloudinary.com/demo/frame.png"
    );

    const result = await executeImageGenerateJob({
      capabilityId: "image.generate",
      sceneFrame: parseSceneFrameJobInput({
        asset_slot: "scene_frame",
        frame_index: 0,
        caption: "snow falls",
      }),
    });

    expect(result.ok).toBe(true);
    expect(imageGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        assetSlot: "scene_frame",
        size: { width: 1280, height: 720 },
      })
    );
  });
});
