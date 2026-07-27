import { imageGenerate } from "@/lib/ai/capability";
import { uploadImageBufferToCloudinary } from "@/lib/cloudinary/serverUpload";
import { formatRequestError } from "@/lib/format-request-error";
import type { SceneFrameJobInput } from "@/lib/generate-jobs";
import { buildHostedImageResultReference } from "@/lib/generate-jobs/resultReference";
import { buildFrameDraftPrompt } from "@/lib/prompts/frame-draft";

export type ExecuteImageGenerateOk = {
  ok: true;
  resultReference: string;
  url: string;
  mimeType: string;
  usedFallback: boolean;
  durationMs: number;
};

export type ExecuteImageGenerateErr = {
  ok: false;
  message: string;
  durationMs: number;
};

export type ExecuteImageGenerateResult =
  | ExecuteImageGenerateOk
  | ExecuteImageGenerateErr;

/**
 * Shared Capability path for scene-frame generate + Cloudinary host.
 * Used by Local Worker and sync generateFrameDraft (compat).
 * Does NOT write Assets / story_images_v2.
 */
export async function executeSceneFrameImageGenerate(input: {
  caption: string;
  routeTitle?: string;
}): Promise<ExecuteImageGenerateResult> {
  const started = Date.now();
  const caption = input.caption.trim();
  if (!caption) {
    return {
      ok: false,
      message: "缺少帧说明（Asset Caption）。",
      durationMs: Date.now() - started,
    };
  }

  const routeTitle = input.routeTitle?.trim() || undefined;
  const prompt = buildFrameDraftPrompt({ caption, routeTitle });

  try {
    const candidate = await imageGenerate({
      surface: "creator",
      assetSlot: "scene_frame",
      prompt,
      size: { width: 1280, height: 720 },
    });
    let url: string;
    try {
      url = await uploadImageBufferToCloudinary(
        candidate.bytes,
        candidate.mimeType
      );
    } catch (uploadErr) {
      const uploadMsg = formatRequestError(uploadErr);
      console.warn("[executeSceneFrameImageGenerate] cloudinary upload failed", {
        uploadMsg,
        usedFallback: candidate.usedFallback,
      });
      return {
        ok: false,
        message: `画面已生成，但托管失败：${uploadMsg}`,
        durationMs: Date.now() - started,
      };
    }

    const resultReference = buildHostedImageResultReference({
      url,
      mimeType: candidate.mimeType,
      capabilityId: "image.generate",
      usedFallback: candidate.usedFallback,
    });

    return {
      ok: true,
      resultReference,
      url,
      mimeType: candidate.mimeType,
      usedFallback: candidate.usedFallback,
      durationMs: Date.now() - started,
    };
  } catch (e) {
    const message = formatRequestError(e);
    console.warn("[executeSceneFrameImageGenerate]", {
      ok: false,
      message,
      raw: e instanceof Error ? e.message : String(e),
    });
    return {
      ok: false,
      message,
      durationMs: Date.now() - started,
    };
  }
}

export async function executeImageGenerateJob(input: {
  capabilityId: string;
  sceneFrame: SceneFrameJobInput;
}): Promise<ExecuteImageGenerateResult> {
  if (input.capabilityId !== "image.generate") {
    return {
      ok: false,
      message: `unsupported capability_id: ${input.capabilityId}`,
      durationMs: 0,
    };
  }
  return executeSceneFrameImageGenerate({
    caption: input.sceneFrame.caption,
    routeTitle: input.sceneFrame.route_title,
  });
}
