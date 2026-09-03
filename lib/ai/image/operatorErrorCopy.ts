/**
 * Operator-facing copy for Creator image generation failures.
 * Technical detail stays in logs; Job.error / Admin UI use these strings.
 *
 * Client-safe: must NOT import sharp / blankImageGuard (Node-only).
 */

export function imageProviderLabel(providerId: string): string {
  const id = providerId.trim().toLowerCase();
  if (id === "local" || id === "localai") return "本地出图";
  if (id === "siliconflow") return "云端出图（SiliconFlow）";
  if (id === "fal") return "云端出图（fal）";
  if (id === "gemini") return "云端出图（Gemini）";
  if (id === "skip-network") return "跳过网络（测试）";
  return providerId.trim() || "出图服务";
}

function softSkipOperatorMessage(raw: string): string | null {
  // Narrow match: do NOT treat IMAGE_CREATOR_LOCALAI_MAX_EDGE / TIMEOUT_MS as "not set".
  if (
    /IMAGE_CREATOR_LOCAL(?:AI)?_BASE\b/i.test(raw) &&
    /not set|requires/i.test(raw)
  ) {
    return "本地出图服务地址未配置（检查 IMAGE_CREATOR_LOCALAI_BASE / IMAGE_CREATOR_LOCAL_BASE）";
  }
  if (
    /SILICONFLOW(?:_API)?_KEY|IMAGE_CREATOR_SILICONFLOW_KEY/i.test(raw) &&
    /not set|requires/i.test(raw)
  ) {
    return "云端出图（SiliconFlow）密钥未配置";
  }
  if (
    /(?:FAL_KEY|IMAGE_CREATOR_FAL_KEY)/i.test(raw) &&
    /not set|requires/i.test(raw)
  ) {
    return "云端出图（fal）密钥未配置";
  }
  if (
    /(?:GEMINI_API_KEY|IMAGE_CREATOR_GEMINI_KEY)/i.test(raw) &&
    /not set|requires/i.test(raw)
  ) {
    return "云端出图（Gemini）密钥未配置";
  }
  return null;
}

function hostingOperatorMessage(raw: string): string | null {
  if (!/托管失败|cloudinary|api\.cloudinary\.com/i.test(raw)) return null;
  return "画面已生成，但图片托管失败（连不上 Cloudinary）。请检查到 api.cloudinary.com 的网络或 HTTPS_PROXY 后重试；不必降低 IMAGE_CREATOR_LOCALAI_MAX_EDGE。";
}

function timeoutOperatorMessage(raw: string): string | null {
  if (hostingOperatorMessage(raw)) return null;
  if (!/timed out|timeout/i.test(raw)) return null;
  // Scene frames already request 512² — MAX_EDGE advice is usually a red herring.
  if (/size\s*512\s*x\s*512/i.test(raw)) {
    return "本地出图超时（LocalAI 过慢或冷启动）。请确认 LocalAI 空闲后单独重试该帧；避免一次连排多帧。可检查 LocalAI 日志。";
  }
  return "本地出图超时（LocalAI 仍在计算或机器过慢）。可降低 IMAGE_CREATOR_LOCALAI_MAX_EDGE、检查 LocalAI 日志，或稍后再试。";
}

/** Normalize a caught primary/fallback error into short operator text. */
export function formatImageAttemptError(err: unknown): string {
  // Avoid importing BlankImageError (pulls sharp via blankImageGuard) into client bundles.
  if (err instanceof Error && err.name === "BlankImageError") {
    return err.message;
  }
  const raw = err instanceof Error ? err.message : String(err);
  const soft = softSkipOperatorMessage(raw);
  if (soft) return soft;
  const hosting = hostingOperatorMessage(raw);
  if (hosting) return hosting;
  const timeout = timeoutOperatorMessage(raw);
  if (timeout) return timeout;
  // Already operator-facing blank copy
  if (/空白白图|全黑图|空白或无效画面|生成结果无效/.test(raw)) {
    return raw;
  }
  // Legacy technical blank_image_rejected payloads
  if (/blank_image_rejected/i.test(raw)) {
    if (/near_white_flat/i.test(raw)) {
      return "生成出了空白白图（几乎没有画面内容），已自动拒绝。可「附修改意见重试」。";
    }
    if (/near_black_flat/i.test(raw)) {
      return "生成出了全黑图（几乎没有画面内容），已自动拒绝。可「附修改意见重试」。";
    }
    return "生成结果不可用（空白或无效画面），已自动拒绝。可「附修改意见重试」。";
  }
  return raw.slice(0, 240);
}

export function formatCreatorImageFailure(input: {
  providerId: string;
  error: unknown;
}): string {
  const detail = formatImageAttemptError(input.error);
  return `${imageProviderLabel(input.providerId)}失败：${detail}`;
}

export function formatCreatorImagePrimaryAndFallbackFailure(input: {
  primaryProviderId: string;
  primaryError: unknown;
  fallbackProviderId: string;
  fallbackError: unknown;
}): string {
  const primary = formatImageAttemptError(input.primaryError);
  const fallback = formatImageAttemptError(input.fallbackError);
  return (
    `出图失败。` +
    `主通道（${imageProviderLabel(input.primaryProviderId)}）：${primary}；` +
    `备用通道（${imageProviderLabel(input.fallbackProviderId)}）：${fallback}`
  );
}

/**
 * Map stored Job.error (including legacy English) to operator-facing Chinese.
 * Safe to call on already-friendly strings — returns as-is when no pattern matches.
 */
export function formatGenerateJobErrorForOperator(
  error: string | null | undefined
): string | null {
  if (error == null) return null;
  const raw = error.trim();
  if (!raw) return null;

  const hosting = hostingOperatorMessage(raw);
  if (hosting) return hosting;

  // Timeout must win over soft-skip substring false positives in stored English.
  const timeout = timeoutOperatorMessage(raw);
  if (timeout) {
    return `本地出图失败：${timeout}`;
  }

  if (
    /blank_image_rejected/i.test(raw) ||
    /Creator image generation failed/i.test(raw)
  ) {
    if (/near_white_flat/i.test(raw) || /mean=255/i.test(raw)) {
      return "本地出图失败：生成出了空白白图（几乎没有画面内容），已自动拒绝。可「附修改意见重试」。";
    }
    if (/near_black_flat/i.test(raw)) {
      return "本地出图失败：生成出了全黑图（几乎没有画面内容），已自动拒绝。可「附修改意见重试」。";
    }
    if (/blank_image_rejected/i.test(raw)) {
      return "本地出图失败：生成结果不可用（空白或无效画面），已自动拒绝。可「附修改意见重试」。";
    }
    const soft = softSkipOperatorMessage(raw);
    if (soft) {
      return `出图失败：${soft}`;
    }
    // Strip noisy English wrapper when possible
    const inner = raw.match(
      /Creator image generation failed\s*\((?:provider|primary)=([^:]+):\s*([^)]+)\)/i
    );
    if (inner?.[1] && inner[2]) {
      return `${imageProviderLabel(inner[1])}失败：${formatImageAttemptError(inner[2].trim())}`;
    }
    return "出图失败。可「附修改意见重试」，或检查出图服务是否正常。";
  }

  return raw;
}
