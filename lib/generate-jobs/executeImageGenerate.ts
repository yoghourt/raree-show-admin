import { imageGenerate } from "@/lib/ai/capability";
import { loadCreatorImageDeploymentConfig } from "@/lib/ai/image/deploymentConfig";
import { uploadImageBufferToCloudinary } from "@/lib/cloudinary/serverUpload";
import {
  resolveProjectionProfile,
  sceneFrameSizeForProfile,
} from "@/lib/discovery/execution-projection";
import {
  assessSceneFaceSafety,
  type SceneFaceSafetyAssessment,
} from "@/lib/discovery/expression-capability-rules";
import {
  executableRendererExpression,
  type RendererExpression,
} from "@/lib/discovery/visual-contract";
import { formatRequestError } from "@/lib/format-request-error";
import type {
  CharacterPortraitJobInput,
  SceneFrameJobInput,
} from "@/lib/generate-jobs";
import { buildHostedImageResultReference } from "@/lib/generate-jobs/resultReference";
import {
  buildAvatarPrompt,
  buildAvatarNegativePrompt,
  PORTRAIT_IMAGE_SIZE,
} from "@/lib/prompts/avatar";
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
  /** Rule 6 Face Safety — advisory for Human Accept (scene_frame only). */
  faceSafety?: SceneFaceSafetyAssessment;
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
  /**
   * Explicit operator override for restricted full-face Expression (Rule 6).
   * Does not skip Human Accept — only records override on the safety assessment.
   */
  faceSafetyOverride?: boolean;
}): Promise<ExecuteImageGenerateResult> {
  const started = Date.now();
  const caption = input.caption.trim();
  const rendererExpression = executableRendererExpression(
    input.rendererExpression
  );
  const hasExpression = Boolean(rendererExpression);
  if (!caption && !hasExpression) {
    return {
      ok: false,
      message: "缺少帧说明（Asset Caption）或 Renderer Expression。",
      durationMs: Date.now() - started,
    };
  }

  const faceSafety = rendererExpression
    ? assessSceneFaceSafety(rendererExpression, {
        explicitOverride: input.faceSafetyOverride === true,
      })
    : undefined;

  if (faceSafety) {
    console.info("[executeSceneFrameImageGenerate] faceSafety", {
      safety_status: faceSafety.safety_status,
      reason: faceSafety.reason,
      inferredVisibility: faceSafety.inferredVisibility,
      sceneRisk: faceSafety.sceneRisk,
      requiresExplicitOverride: faceSafety.requiresExplicitOverride,
    });
  }

  // Restricted without override: block before Port (propose should already reject).
  if (
    faceSafety?.safety_status === "restricted" &&
    faceSafety.requiresExplicitOverride &&
    !input.faceSafetyOverride
  ) {
    return {
      ok: false,
      message: `Face Safety restricted (${faceSafety.reason}): scene_frame full-face Expression requires explicit override + Human Accept.`,
      durationMs: Date.now() - started,
    };
  }

  const routeTitle = input.routeTitle?.trim() || undefined;
  const deployment = loadCreatorImageDeploymentConfig();
  const projectionProfile = resolveProjectionProfile(
    deployment.acceptProviderId
  );
  const frameSize = sceneFrameSizeForProfile(projectionProfile);
  const prompt = buildFrameDraftPrompt({
    caption: caption || " ",
    routeTitle,
    rendererExpression,
    projectionProfile,
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
    projectionProfile,
    size: `${frameSize.width}x${frameSize.height}`,
  });

  try {
    const candidate = await imageGenerate({
      surface: "creator",
      assetSlot: "scene_frame",
      prompt,
      negativePrompt: buildFrameNegativePrompt(caption, {
        castCount: rendererExpression?.characters?.length,
      }),
      // A5: Local profile 512² (blank mitigation); Cloud profile 1024².
      size: frameSize,
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
      ...(faceSafety
        ? {
            faceSafety: {
              safety_status: faceSafety.safety_status,
              reason: faceSafety.reason,
            },
          }
        : {}),
    });

    return {
      ok: true,
      resultReference,
      url,
      mimeType: candidate.mimeType,
      usedFallback: candidate.usedFallback,
      durationMs: Date.now() - started,
      ...(faceSafety ? { faceSafety } : {}),
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
  const negativePrompt = buildAvatarNegativePrompt(description);
  const referenceUrl = input.referenceUrl?.trim();

  console.info("[executePortraitImageGenerate] prompt", {
    name,
    promptLen: prompt.length,
    negativeLen: negativePrompt.length,
    size: PORTRAIT_IMAGE_SIZE,
  });

  try {
    const candidate = await imageGenerate({
      surface: "creator",
      assetSlot: "portrait",
      prompt,
      negativePrompt,
      referenceImages:
        referenceUrl &&
        (referenceUrl.startsWith("http://") ||
          referenceUrl.startsWith("https://"))
          ? [{ url: referenceUrl }]
          : undefined,
      size: { ...PORTRAIT_IMAGE_SIZE },
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
      faceSafetyOverride: input.sceneFrame.face_safety_override === true,
    });
  }
  return {
    ok: false,
    message: "executeImageGenerateJob requires sceneFrame or portrait input",
    durationMs: 0,
  };
}
