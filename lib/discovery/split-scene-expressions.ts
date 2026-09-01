/**
 * After Human Split Scene: same-call LLM authors rendererExpression per beat
 * from that beat's confirmed summary (WS1 / scene-frame alignment).
 */

import { callDiscoveryTextLlm } from "@/lib/discovery/discovery-text-llm";
import {
  applyCharacterArchivesToSceneCandidate,
} from "@/lib/discovery/candidate-validate";
import {
  EXPRESSION_CAPABILITY_EXAMPLE,
  EXPRESSION_CAPABILITY_RULES,
} from "@/lib/discovery/expression-capability-rules";
import type { DiscoveryCandidate } from "@/lib/discovery/propose-types";
import type { NarrativeInputBundle } from "@/lib/discovery/types";
import {
  MINIMAL_RENDERER_EXPRESSION,
  parseRendererExpression,
  type RendererExpression,
  type VisualIntent,
} from "@/lib/discovery/visual-contract";
import { workVisualConventionPromptBlock } from "@/lib/prompts/work-visual-convention";

function isSplitExpressionMockMode(): boolean {
  if (process.env.DISCOVERY_PROPOSE_MODE === "live") {
    return false;
  }
  return (
    process.env.DISCOVERY_PROPOSE_MODE === "mock" ||
    process.env.VITEST === "true"
  );
}

export type SplitBeatInput = {
  title: string;
  summary: string;
};

export type SplitBeatExpressionResult = {
  title: string;
  summary: string;
  rendererExpression: RendererExpression;
  visualIntent?: VisualIntent | null;
};

function mockExpressionForBeat(beat: SplitBeatInput): RendererExpression {
  const title = beat.title.trim() || "figures";
  return {
    environment: "story setting from narrative",
    characters: [],
    action: `${title} posed in a static visible still, faces secondary`,
    composition: "medium wide shot, faces secondary",
  };
}

function extractJsonValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      /* fall through */
    }
  }
  const startObj = trimmed.indexOf("{");
  const startArr = trimmed.indexOf("[");
  const start =
    startObj >= 0 && (startArr < 0 || startObj < startArr)
      ? startObj
      : startArr;
  if (start < 0) {
    throw new Error("No JSON object in model output");
  }
  const endChar = trimmed[start] === "[" ? "]" : "}";
  const end = trimmed.lastIndexOf(endChar);
  if (end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("No JSON object in model output");
}

function normalizeNarrative(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * True when Expression.action is the Reader summary pasted through
 * (the split-fill bug: caption and action identical).
 */
export function actionCopiesBeatNarrative(
  action: string,
  summary: string
): boolean {
  const a = normalizeNarrative(action);
  const s = normalizeNarrative(summary);
  if (!a || !s) return false;
  if (a === s) return true;
  const s80 = s.slice(0, 80).trim();
  const s120 = s.slice(0, 120).trim();
  return a === s80 || a === s120;
}

function extractExpressionRows(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return [];
  const rec = parsed as Record<string, unknown>;
  for (const key of ["expressions", "beats", "items", "scenes"]) {
    if (Array.isArray(rec[key])) return rec[key];
  }
  return [];
}

function rawExpressionFromRow(row: unknown): unknown {
  if (!row || typeof row !== "object" || Array.isArray(row)) return undefined;
  const rec = row as Record<string, unknown>;
  return rec.rendererExpression ?? rec.expression ?? rec.visualExpression ?? row;
}

function buildSplitExpressionPrompt(params: {
  workTitle: string;
  visualConvention?: string;
  narrative: NarrativeInputBundle;
  beats: SplitBeatInput[];
  characterCandidates: DiscoveryCandidate[];
  retryNote?: string;
}): string {
  const roleLines =
    params.characterCandidates.length === 0
      ? "(none)"
      : params.characterCandidates
          .map((c) => {
            const archive =
              "characterArchive" in c.fields ? c.fields.characterArchive : null;
            const cues = archive
              ? [
                  ...(archive.costumeCues ?? []),
                  ...(archive.propCues ?? []),
                ].join("; ")
              : "";
            return `- ${c.displayName}${cues ? ` | cues: ${cues}` : ""}`;
          })
          .join("\n");

  const beatBlock = params.beats
    .map(
      (b, i) =>
        `${i + 1}. title: ${JSON.stringify(b.title)}\n   summary: ${JSON.stringify(b.summary)}`
    )
    .join("\n");

  const retryBlock = params.retryNote
    ? `\nRETRY — previous output was rejected:\n${params.retryNote}\n`
    : "";
  const conventionBlock = workVisualConventionPromptBlock(params.visualConvention);
  const conventionLead = conventionBlock ? `\n${conventionBlock}\n` : "";

  return `You author Canonical Visual Expression for Human-split Scene beats.
Work title: ${params.workTitle}${conventionLead}

Locked narrative bundle (JSON):
${JSON.stringify(params.narrative, null, 2)}

Role archives (optional cue source):
${roleLines}

Beats (emit ONE expression object per beat, SAME order, SAME count = ${params.beats.length}):
${beatBlock}
${retryBlock}
Rules:
- OUTPUT LANGUAGE: English (Latin script only) for all Expression strings.
- Each expression MUST depict the SAME instant as that beat's summary — not another beat.
- summary is Reader narrative (the story turn). rendererExpression.action is visible still geometry (who is posed where, what can be drawn). They MUST NOT be the same string.
- FORBIDDEN: copying the beat summary/caption into rendererExpression.action verbatim or near-verbatim (including truncating it).
- WRONG: summary "Zhang Jue rises in yellow cloth." → action "Zhang Jue rises in yellow cloth."
- GOOD: summary "Zhang Jue rises in yellow cloth." → action "Zhang Jue standing center, yellow headcloth, banner raised, followers kneeling at reading distance"
- Prefer identity color / props when the beat needs them.
- Do NOT change titles or summaries — Expression only.
- FORBIDDEN stub placeholders: "empty scene", "unspecified place".

${EXPRESSION_CAPABILITY_RULES}

Return ONLY valid JSON:
{"expressions":[{"rendererExpression":${JSON.stringify(EXPRESSION_CAPABILITY_EXAMPLE)},"visualIntent":{"relationship":"...","purpose":"..."}}]}
Array length MUST equal ${params.beats.length}. visualIntent is optional per item.`;
}

type ParsedSplitExpressions = {
  expressions: RendererExpression[];
  intents: Array<VisualIntent | null | undefined>;
  copiedNarrative: number[];
  parseFailed: number[];
};

export function parseSplitBeatExpressions(
  raw: string,
  beats: SplitBeatInput[]
): ParsedSplitExpressions {
  let parsed: unknown;
  try {
    parsed = extractJsonValue(raw);
  } catch {
    return {
      expressions: beats.map(() => ({ ...MINIMAL_RENDERER_EXPRESSION })),
      intents: beats.map(() => undefined),
      copiedNarrative: [],
      parseFailed: beats.map((_, i) => i),
    };
  }
  const rows = extractExpressionRows(parsed);
  const copiedNarrative: number[] = [];
  const parseFailed: number[] = [];
  const intents: Array<VisualIntent | null | undefined> = [];

  const expressions = beats.map((beat, i) => {
    const row = rows[i];
    if (row && typeof row === "object" && !Array.isArray(row)) {
      const intent = (row as Record<string, unknown>).visualIntent;
      if (
        intent &&
        typeof intent === "object" &&
        !Array.isArray(intent)
      ) {
        intents[i] = intent as VisualIntent;
      } else {
        intents[i] = undefined;
      }
    } else {
      intents[i] = undefined;
    }

    const result = parseRendererExpression(rawExpressionFromRow(row));
    if (!result.ok) {
      parseFailed.push(i);
      return { ...MINIMAL_RENDERER_EXPRESSION };
    }
    if (actionCopiesBeatNarrative(result.value.action, beat.summary || beat.title)) {
      copiedNarrative.push(i);
      return { ...MINIMAL_RENDERER_EXPRESSION };
    }
    return result.value;
  });

  return { expressions, intents, copiedNarrative, parseFailed };
}

function foldBeatExpressions(params: {
  workId: string;
  beats: SplitBeatInput[];
  expressions: RendererExpression[];
  intents: Array<VisualIntent | null | undefined>;
  characterCandidates: DiscoveryCandidate[];
}): SplitBeatExpressionResult[] {
  return params.beats.map((beat, i) => {
    const expr = params.expressions[i] ?? MINIMAL_RENDERER_EXPRESSION;
    const synthetic: DiscoveryCandidate = {
      candidateId: `split_expr_${i}`,
      candidateType: "scene",
      workId: params.workId,
      displayName: beat.title || `Beat ${i + 1}`,
      summary: beat.summary || beat.title,
      fields: {
        parentStoryCandidateId: "n/a",
        chapter_number: 1,
        title: beat.title || `Beat ${i + 1}`,
        summary: beat.summary || beat.title,
        rendererExpression: expr,
        ...(params.intents[i] ? { visualIntent: params.intents[i] } : {}),
      },
    };
    const applied = applyCharacterArchivesToSceneCandidate(
      synthetic,
      params.characterCandidates
    );
    const fields = applied.fields as {
      rendererExpression: RendererExpression;
      visualIntent?: VisualIntent | null;
    };
    return {
      title: beat.title,
      summary: beat.summary,
      rendererExpression: fields.rendererExpression,
      visualIntent: fields.visualIntent,
    };
  });
}

function parsedSplitIsUsable(
  parsed: ParsedSplitExpressions,
  beatCount: number
): boolean {
  if (parsed.parseFailed.length > 0 || parsed.copiedNarrative.length > 0) {
    return false;
  }
  return parsed.expressions.length === beatCount;
}

/**
 * Author rendererExpression for each split beat (one LLM call, one retry).
 * MUST NOT paste beat summary into action. Fail loud instead of silent copy.
 */
export async function authorExpressionsForSplitBeats(params: {
  workId: string;
  workTitle: string;
  visualConvention?: string;
  narrative: NarrativeInputBundle;
  beats: SplitBeatInput[];
  characterCandidates?: DiscoveryCandidate[];
}): Promise<{
  beats: SplitBeatExpressionResult[];
  error?: { code: string; message: string };
}> {
  const beats = params.beats
    .map((b) => ({
      title: b.title.trim(),
      summary: b.summary.trim(),
    }))
    .filter((b) => b.title || b.summary);

  if (beats.length < 2) {
    return {
      beats: [],
      error: {
        code: "SPLIT_NEED_TWO",
        message: "At least two beats required",
      },
    };
  }

  const characterCandidates = params.characterCandidates ?? [];

  if (isSplitExpressionMockMode()) {
    return {
      beats: beats.map((beat) => ({
        ...beat,
        rendererExpression: mockExpressionForBeat(beat),
      })),
    };
  }

  const promptParams = {
    workTitle: params.workTitle,
    visualConvention: params.visualConvention,
    narrative: params.narrative,
    beats,
    characterCandidates,
  };

  try {
    let raw = await callDiscoveryTextLlm(
      buildSplitExpressionPrompt(promptParams),
      { geminiJsonObject: true }
    );
    let parsed = parseSplitBeatExpressions(raw, beats);

    if (!parsedSplitIsUsable(parsed, beats.length)) {
      const reasons: string[] = [];
      if (parsed.parseFailed.length) {
        reasons.push(
          `parse failed for beat(s) ${parsed.parseFailed.map((n) => n + 1).join(", ")}`
        );
      }
      if (parsed.copiedNarrative.length) {
        reasons.push(
          `action copied summary for beat(s) ${parsed.copiedNarrative.map((n) => n + 1).join(", ")}`
        );
      }
      console.warn(
        "[split-scene-expressions] first pass rejected (%s); retrying",
        reasons.join("; ") || "unusable output"
      );
      raw = await callDiscoveryTextLlm(
        buildSplitExpressionPrompt({
          ...promptParams,
          retryNote:
            "Do NOT copy summary into action. action MUST be visible still geometry (poses, placement, props). Keep summary as Reader narrative only.",
        }),
        { geminiJsonObject: true }
      );
      parsed = parseSplitBeatExpressions(raw, beats);
    }

    if (!parsedSplitIsUsable(parsed, beats.length)) {
      return {
        beats: [],
        error: {
          code: "SPLIT_EXPRESSION_FAILED",
          message:
            "Split Expression authorship copied Reader summary into action, or the model output could not be parsed. Retry the split.",
        },
      };
    }

    return {
      beats: foldBeatExpressions({
        workId: params.workId,
        beats,
        expressions: parsed.expressions,
        intents: parsed.intents,
        characterCandidates,
      }),
    };
  } catch (e) {
    return {
      beats: [],
      error: {
        code: "SPLIT_EXPRESSION_FAILED",
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }
}
