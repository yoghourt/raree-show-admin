/**
 * Propose generation error taxonomy (parse vs transport)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXCERPT_BUNDLE_MIN_PROSE } from "@/lib/discovery/constants";
import type { NarrativeInputBundle } from "@/lib/discovery/types";

const callDiscoveryTextLlm = vi.fn();

vi.mock("@/lib/discovery/discovery-text-llm", () => ({
  callDiscoveryTextLlm: (...args: unknown[]) => callDiscoveryTextLlm(...args),
}));

function makeProse(length: number): string {
  const unit = "Narrative prose sentence. ";
  let out = "";
  while (out.length < length) out += unit;
  return out.slice(0, length);
}

const narrative: NarrativeInputBundle = {
  excerpts: [{ text: makeProse(EXCERPT_BUNDLE_MIN_PROSE), orderIndex: 0 }],
  operatorSummary: null,
  inputMode: "excerpt_bundle",
  summaryAttested: false,
};

describe("propose generation error taxonomy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("DISCOVERY_PROPOSE_MODE", "live");
    callDiscoveryTextLlm.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps parseCandidateArray throw to GENERATION_PARSE_FAILED", async () => {
    callDiscoveryTextLlm.mockResolvedValue("definitely not candidate json");
    const { proposeCandidateTypes } = await import(
      "@/lib/discovery/propose-service"
    );
    const { errors, candidates } = await proposeCandidateTypes({
      workId: "w",
      workTitle: "T",
      narrative,
      candidateTypes: ["character"],
    });
    expect(candidates).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe("GENERATION_PARSE_FAILED");
  });

  it("maps provider/transport errors to GENERATION_FAILED", async () => {
    callDiscoveryTextLlm.mockRejectedValue(
      new Error("Gemini API 速率限制 (429)，请等待约 60 秒后重试。")
    );
    const { proposeCandidateTypes } = await import(
      "@/lib/discovery/propose-service"
    );
    const { errors } = await proposeCandidateTypes({
      workId: "w",
      workTitle: "T",
      narrative,
      candidateTypes: ["character"],
    });
    expect(errors[0]?.code).toBe("GENERATION_FAILED");
  });
});
