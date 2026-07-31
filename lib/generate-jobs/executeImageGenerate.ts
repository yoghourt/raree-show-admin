import { imageGenerate } from "@/lib/ai/capability";
import { uploadImageBufferToCloudinary } from "@/lib/cloudinary/serverUpload";
import type { RendererExpression } from "@/lib/discovery/visual-contract";
import { formatRequestError } from "@/lib/format-request-error";
import type {
  CharacterPortraitJobInput,
  SceneFrameJobInput,
} from "@/lib/generate-jobs";
import { buildHostedImageResultReference } from "@/lib/generate-jobs/resultReference";
import { buildAvatarPrompt, buildAvatarNegativePrompt } from "@/lib/prompts/avatar";
import {
  buildFrameDraftPrompt,
  buildFrameNegativePrompt,
} from "@/lib/prompts/frame-draft";

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
  rendererExpression?: RendererExpression | null;
}): Promise<ExecuteImageGenerateResult> {
  const started = Date.now();
  const caption = input.caption.trim();
  const hasExpression = Boolean(input.rendererExpression);
  if (!caption && !hasExpression) {
    return {
      ok: false,
      message: "缺少帧说明（Asset Caption）或 Renderer Expression。",
      durationMs: Date.now() - started,
    };
  }

  const routeTitle = input.routeTitle?.trim() || undefined;
  const prompt = buildFrameDraftPrompt({
    caption: caption || " ",
    routeTitle,
    rendererExpression: input.rendererExpression,
  });
  if (!prompt.trim()) {
    return {
      ok: false,
      message: "无法从 Expression/Caption 构造生成 prompt。",
      durationMs: Date.now() - started,
    };
  }

  console.info("[executeSceneFrameImageGenerate] prompt", {
    hasExpr: hasExpression,
    promptLen: prompt.length,
    routeTitle: routeTitle ?? null,
    size: "512x512",
  });

  try {
    const candidate = await imageGenerate({
      surface: "creator",
      assetSlot: "scene_frame",
      prompt,
      negativePrompt: buildFrameNegativePrompt(caption),
      // Option B: square Local-friendly size (spike-aligned). Widescreen 1280×720
      // clamped to 768×432 raised blank-white rate on sd-3.5-medium-ggml.
      size: { width: 512, height: 512 },
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

/**
 * Character portrait generate + Cloudinary host (CPP-C).
 * Does NOT write characters.portrait_url.
 */
export async function executePortraitImageGenerate(input: {
  name: string;
  description?: string;
  referenceUrl?: string;
}): Promise<ExecuteImageGenerateResult> {
  const started = Date.now();
  const name = input.name.trim();
  if (!name) {
    return {
      ok: false,
      message: "缺少角色名称。",
      durationMs: Date.now() - started,
    };
  }

  const description = input.description?.trim() ?? "";
  const prompt = buildAvatarPrompt(name, description);
  const referenceUrl = input.referenceUrl?.trim();

  try {
    const candidate = await imageGenerate({
      surface: "creator",
      assetSlot: "portrait",
      prompt,
      negativePrompt: buildAvatarNegativePrompt(description),
      referenceImages:
        referenceUrl &&
        (referenceUrl.startsWith("http://") ||
          referenceUrl.startsWith("https://"))
          ? [{ url: referenceUrl }]
          : undefined,
      size: { width: 1024, height: 1024 },
    });
    let url: string;
    try {
      url = await uploadImageBufferToCloudinary(
        candidate.bytes,
        candidate.mimeType
      );
    } catch (uploadErr) {
      const uploadMsg = formatRequestError(uploadErr);
      console.warn("[executePortraitImageGenerate] cloudinary upload failed", {
        uploadMsg,
        usedFallback: candidate.usedFallback,
      });
      return {
        ok: false,
        message: `肖像已生成，但托管失败：${uploadMsg}`,
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
    console.warn("[executePortraitImageGenerate]", {
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
  sceneFrame?: SceneFrameJobInput;
  portrait?: CharacterPortraitJobInput;
}): Promise<ExecuteImageGenerateResult> {
  if (input.capabilityId !== "image.generate") {
    return {
      ok: false,
      message: `unsupported capability_id: ${input.capabilityId}`,
      durationMs: 0,
    };
  }
  if (input.portrait) {
    return executePortraitImageGenerate({
      name: input.portrait.name,
      description: input.portrait.description,
      referenceUrl: input.portrait.reference_url,
    });
  }
  if (input.sceneFrame) {
    return executeSceneFrameImageGenerate({
      caption: input.sceneFrame.caption,
      routeTitle: input.sceneFrame.route_title,
      rendererExpression: input.sceneFrame.renderer_expression,
    });
  }
  return {
    ok: false,
    message: "executeImageGenerateJob requires sceneFrame or portrait input",
    durationMs: 0,
  };
}
