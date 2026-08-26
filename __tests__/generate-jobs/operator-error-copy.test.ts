import { describe, expect, it } from "vitest";

import {
  assessBlankFromLumaSamples,
  BlankImageError,
  blankImageOperatorMessage,
} from "@/lib/ai/image/blankImageGuard";
import {
  formatGenerateJobErrorForOperator,
  formatImageAttemptError,
} from "@/lib/ai/image/operatorErrorCopy";

describe("blankImageOperatorMessage", () => {
  it("explains near-white blanks for operators", () => {
    const a = assessBlankFromLumaSamples(
      new Uint8Array(64 * 64).fill(255),
      64,
      64
    );
    expect(a.reason).toBe("near_white_flat");
    expect(blankImageOperatorMessage(a)).toContain("空白白图");
    expect(new BlankImageError(a).message).toContain("空白白图");
    expect(new BlankImageError(a).message).not.toMatch(/blank_image_rejected/);
  });
});

describe("formatGenerateJobErrorForOperator", () => {
  it("maps legacy English blank rejection to Chinese", () => {
    const legacy =
      "Creator image generation failed (provider=localai: blank_image_rejected (near_white_flat; mean=255.0 std=0.0))";
    expect(formatGenerateJobErrorForOperator(legacy)).toContain("空白白图");
    expect(formatGenerateJobErrorForOperator(legacy)).not.toMatch(
      /blank_image_rejected|mean=255/
    );
  });

  it("passes through already-friendly Chinese", () => {
    const msg =
      "本地出图失败：生成出了空白白图（几乎没有画面内容），已自动拒绝。可「附修改意见重试」。";
    expect(formatGenerateJobErrorForOperator(msg)).toBe(msg);
  });
});

describe("formatImageAttemptError", () => {
  it("does not mislabel LocalAI timeout as missing base URL", () => {
    const timeout =
      "localai timed out after 600000ms (http://127.0.0.1:8080/v1/images/generations; size 768x432). LocalAI may still be loading or CPU-bound — check LocalAI logs, or lower IMAGE_CREATOR_LOCALAI_MAX_EDGE.";
    const msg = formatImageAttemptError(timeout);
    expect(msg).toContain("超时");
    expect(msg).not.toContain("地址未配置");
  });

  it("advises solo retry when scene frame already at 512", () => {
    const timeout =
      "localai timed out after 600000ms (http://127.0.0.1:8080/v1/images/generations; size 512x512). LocalAI may still be loading or CPU-bound — check LocalAI logs, or lower IMAGE_CREATOR_LOCALAI_MAX_EDGE.";
    const msg = formatImageAttemptError(timeout);
    expect(msg).toContain("单独重试");
    expect(msg).not.toContain("MAX_EDGE");
  });

  it("still maps true missing-base errors", () => {
    const missing =
      "localai adapter requires IMAGE_CREATOR_LOCAL_BASE or IMAGE_CREATOR_LOCALAI_BASE (e.g. http://127.0.0.1:8080)";
    expect(formatImageAttemptError(missing)).toContain("地址未配置");
  });
});
