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
  const summary = beat.summary.trim() || beat.title.trim() || "scene";
  return {
    environment: "story setting from narrative",
    characters: [],
    action: summary.slice(0, 120),
    composition: "medium wide shot, faces secondary",
  };
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      /* fall through */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("No JSON object in model output");
}

function buildSplitExpressionPrompt(params: {
  workTitle: string;
  narrative: NarrativeInputBundle;
  beats: SplitBeatInput[];
  characterCandidates: DiscoveryCandidate[];
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

  return `You author Canonical Visual Expression for Human-split Scene beats.
Work title: ${params.workTitle}

Locked narrative bundle (JSON):
${JSON.stringify(params.narrative, null, 2)}

Role archives (optional cue source):
${roleLines}

Beats (emit ONE expression object per beat, SAME order, SAME count = ${params.beats.length}):
${beatBlock}

Rules:
- OUTPUT LANGUAGE: English (Latin script only) for all Expression strings.
- Each expression MUST depict the SAME instant as that beat's summary — not another beat.
- Prefer identity color / props when the beat needs them.
- Do NOT change titles or summaries — Expression only.
- FORBIDDEN stub placeholders: "empty scene", "unspecified place".

${EXPRESSION_CAPABILITY_RULES}

Return ONLY valid JSON:
{"expressions":[{"rendererExpression":${JSON.stringify(EXPRESSION_CAPABILITY_EXAMPLE)},"visualIntent":{"relationship":"...","purpose":"..."}}]}
Array length MUST equal ${params.beats.length}. visualIntent is optional per item.`;
}

function parseExpressionsFromRaw(
  raw: string,
  beats: SplitBeatInput[]
): RendererExpression[] {
  const parsed = extractJsonObject(raw) as {
    expressions?: unknown;
  };
  const rows = Array.isArray(parsed.expressions) ? parsed.expressions : [];
  return beats.map((beat, i) => {
    const row = rows[i];
    const rawExpr =
      row && typeof row === "object" && !Array.isArray(row)
        ? (row as Record<string, unknown>).rendererExpression ?? row
        : undefined;
    const result = parseRendererExpression(rawExpr);
    if (result.ok) return result.value;
    return {
      ...MINIMAL_RENDERER_EXPRESSION,
      action: (beat.summary || beat.title).slice(0, 80) || "empty scene",
    };
  });
}

function parseVisualIntentsFromRaw(
  raw: string,
  count: number
): Array<VisualIntent | null | undefined> {
  try {
    const parsed = extractJsonObject(raw) as { expressions?: unknown };
    const rows = Array.isArray(parsed.expressions) ? parsed.expressions : [];
    return Array.from({ length: count }, (_, i) => {
      const row = rows[i];
      if (!row || typeof row !== "object" || Array.isArray(row)) return undefined;
      const intent = (row as Record<string, unknown>).visualIntent;
      if (intent == null) return undefined;
      if (typeof intent !== "object" || Array.isArray(intent)) return undefined;
      return intent as VisualIntent;
    });
  } catch {
    return Array.from({ length: count }, () => undefined);
  }
}

/**
 * Author rendererExpression for each split beat (one LLM call).
 * On total failure returns stubs so Human can still edit.
 */
export async function authorExpressionsForSplitBeats(params: {
  workId: string;
  workTitle: string;
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

  try {
    const prompt = buildSplitExpressionPrompt({
      workTitle: params.workTitle,
      narrative: params.narrative,
      beats,
      characterCandidates,
    });
    const raw = await callDiscoveryTextLlm(prompt, { geminiJsonObject: true });
    const expressions = parseExpressionsFromRaw(raw, beats);
    const intents = parseVisualIntentsFromRaw(raw, beats.length);

    const folded = expressions.map((expr, i) => {
      const beat = beats[i]!;
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
          ...(intents[i] ? { visualIntent: intents[i] } : {}),
        },
      };
      const applied = applyCharacterArchivesToSceneCandidate(
        synthetic,
        characterCandidates
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

    return { beats: folded };
  } catch (e) {
    return {
      beats: beats.map((beat) => ({
        ...beat,
        rendererExpression: mockExpressionForBeat(beat),
      })),
      error: {
        code: "SPLIT_EXPRESSION_FAILED",
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }
}
