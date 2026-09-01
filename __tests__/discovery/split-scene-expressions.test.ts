import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  actionCopiesBeatNarrative,
  parseSplitBeatExpressions,
} from "@/lib/discovery/split-scene-expressions";
import { isStubRendererExpression } from "@/lib/discovery/visual-contract";
import type { NarrativeInputBundle } from "@/lib/discovery/types";

const callDiscoveryTextLlm = vi.fn();

vi.mock("@/lib/discovery/discovery-text-llm", () => ({
  callDiscoveryTextLlm: (...args: unknown[]) => callDiscoveryTextLlm(...args),
}));

const beats = [
  { title: "Rise", summary: "Zhang Jue rises in yellow cloth." },
  { title: "Recruit", summary: "Liu Yan posts recruitment boards." },
];

const narrative: NarrativeInputBundle = {
  excerpts: [{ text: "Yellow Turbans rise. Officers call recruits.", orderIndex: 0 }],
  operatorSummary: null,
  inputMode: "excerpt_bundle",
};

function visualExpr(action: string) {
  return {
    environment: "village road",
    characters: [{ role: "Zhang Jue", visual: "yellow headcloth" }],
    action,
    composition: "medium wide shot, faces secondary",
  };
}

describe("actionCopiesBeatNarrative", () => {
  it("detects verbatim caption paste into action", () => {
    expect(
      actionCopiesBeatNarrative(
        "Zhang Jue rises in yellow cloth.",
        "Zhang Jue rises in yellow cloth."
      )
    ).toBe(true);
  });

  it("detects the old slice(0, 80) fallback", () => {
    const summary =
      "Zhang Jue rises in yellow cloth and calls the faithful to gather at the county gate before dawn.";
    expect(actionCopiesBeatNarrative(summary.slice(0, 80), summary)).toBe(true);
  });

  it("allows a visible-geometry rewrite of the same instant", () => {
    expect(
      actionCopiesBeatNarrative(
        "Zhang Jue standing center, yellow headcloth, banner raised",
        "Zhang Jue rises in yellow cloth."
      )
    ).toBe(false);
  });
});

describe("parseSplitBeatExpressions", () => {
  it("does not paste summary into action when parse fails", () => {
    const parsed = parseSplitBeatExpressions("not json at all {", beats);
    expect(parsed.parseFailed).toEqual([0, 1]);
    expect(
      parsed.expressions.every((e) => isStubRendererExpression(e))
    ).toBe(true);
    expect(parsed.expressions[0]!.action).not.toEqual(beats[0]!.summary);
  });

  it("rejects verbatim summary-as-action even when JSON is valid", () => {
    const raw = JSON.stringify({
      expressions: [
        {
          rendererExpression: visualExpr("Zhang Jue rises in yellow cloth."),
        },
        {
          rendererExpression: visualExpr(
            "Liu Yan standing at the gate, blank recruitment board centered"
          ),
        },
      ],
    });
    const parsed = parseSplitBeatExpressions(raw, beats);
    expect(parsed.copiedNarrative).toEqual([0]);
    expect(isStubRendererExpression(parsed.expressions[0])).toBe(true);
    expect(parsed.expressions[1]!.action).toMatch(/recruitment board/i);
  });

  it("accepts expressions nested under beats[]", () => {
    const raw = JSON.stringify({
      beats: [
        visualExpr("Zhang Jue standing center, yellow headcloth, banner raised"),
        visualExpr("Liu Yan at the county gate, blank board centered"),
      ],
    });
    const parsed = parseSplitBeatExpressions(raw, beats);
    expect(parsed.parseFailed).toEqual([]);
    expect(parsed.copiedNarrative).toEqual([]);
    expect(parsed.expressions[0]!.action).toMatch(/banner/i);
  });
});

describe("authorExpressionsForSplitBeats (live)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("DISCOVERY_PROPOSE_MODE", "live");
    callDiscoveryTextLlm.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("retries once when the first pass copies summary into action", async () => {
    callDiscoveryTextLlm
      .mockResolvedValueOnce(
        JSON.stringify({
          expressions: [
            { rendererExpression: visualExpr(beats[0]!.summary) },
            { rendererExpression: visualExpr(beats[1]!.summary) },
          ],
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          expressions: [
            {
              rendererExpression: visualExpr(
                "Zhang Jue standing center, yellow headcloth, banner raised"
              ),
            },
            {
              rendererExpression: visualExpr(
                "Liu Yan at the county gate, blank board centered"
              ),
            },
          ],
        })
      );

    const { authorExpressionsForSplitBeats } = await import(
      "@/lib/discovery/split-scene-expressions"
    );
    const result = await authorExpressionsForSplitBeats({
      workId: "work-1",
      workTitle: "Romance of the Three Kingdoms",
      narrative,
      beats,
    });

    expect(callDiscoveryTextLlm).toHaveBeenCalledTimes(2);
    expect(result.error).toBeUndefined();
    expect(result.beats[0]!.rendererExpression.action).not.toEqual(
      beats[0]!.summary
    );
    expect(result.beats[0]!.rendererExpression.action).toMatch(/banner/i);
  });

  it("fails loud instead of returning caption-as-action", async () => {
    callDiscoveryTextLlm.mockResolvedValue(
      JSON.stringify({
        expressions: [
          { rendererExpression: visualExpr(beats[0]!.summary) },
          { rendererExpression: visualExpr(beats[1]!.summary) },
        ],
      })
    );

    const { authorExpressionsForSplitBeats } = await import(
      "@/lib/discovery/split-scene-expressions"
    );
    const result = await authorExpressionsForSplitBeats({
      workId: "work-1",
      workTitle: "Romance of the Three Kingdoms",
      narrative,
      beats,
    });

    expect(result.beats).toEqual([]);
    expect(result.error?.code).toBe("SPLIT_EXPRESSION_FAILED");
  });
});
