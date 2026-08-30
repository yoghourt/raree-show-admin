/**
 * Creator production: re-author Canonical Visual Expression from the
 * current Frame Narrative (caption). Does not change caption.
 */

import {
  EXPRESSION_CAPABILITY_EXAMPLE,
  EXPRESSION_CAPABILITY_RULES,
} from "@/lib/discovery/expression-capability-rules";
import {
  clipLocalBudgetText,
  LOCAL_ACTION_MAX,
  LOCAL_COMPOSITION_MAX,
  LOCAL_EMPHASIS_MAX,
  LOCAL_ENV_MAX,
  LOCAL_ROLE_MAX,
  LOCAL_VISUAL_MAX,
  packExpressionForLocalTransport,
} from "@/lib/discovery/execution-projection";
import {
  parseRendererExpression,
  type RendererExpression,
} from "@/lib/discovery/visual-contract";

export type FrameExpressionProposeInput = {
  workTitle?: string;
  routeTitle?: string;
  caption: string;
  currentExpression?: string;
  operatorNote?: string;
  characterCues?: Array<{ name: string; visualIdentity?: string }>;
};

const TITLE_PREFIX =
  /^(King|Queen|Prince|Princess|Lord|Lady|Ser|Emperor|Empress)\s+/i;

/** Capitalized name phrases from caption — prompt MUST-CAST, not a dictionary. */
export function captionProperNamePhrases(caption: string): string[] {
  const matches = caption.match(
    /\b(?:King|Queen|Prince|Princess|Lord|Lady|Ser|Emperor|Empress)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*|\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+|\b[A-Z][a-z]{2,}\b/g
  );
  if (!matches) return [];
  const skip = new Set([
    "The",
    "And",
    "With",
    "From",
    "This",
    "That",
    "Hand",
    "North",
    "King",
    "Queen",
    "Prince",
    "Princess",
  ]);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of matches) {
    const t = raw.trim();
    const core = t.replace(TITLE_PREFIX, "").trim();
    if (!core || skip.has(core) || skip.has(t)) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
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
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    return extractJsonObject(fence[1]);
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("No JSON object in model output");
}

/** Parse model output into a Canonical Expression. */
export function parseFrameExpressionProposal(
  raw: string
):
  | { ok: true; value: RendererExpression }
  | { ok: false; errors: string[] } {
  let obj: unknown;
  try {
    obj = extractJsonObject(raw);
  } catch (e) {
    return {
      ok: false,
      errors: [e instanceof Error ? e.message : "Expression JSON 解析失败"],
    };
  }
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const rec = obj as Record<string, unknown>;
    if (rec.rendererExpression && typeof rec.rendererExpression === "object") {
      obj = rec.rendererExpression;
    }
  }
  const parsed = parseRendererExpression(obj);
  if (!parsed.ok) return parsed;
  return { ok: true, value: packExpressionForLocalTransport(parsed.value) };
}

export function buildFrameExpressionProposePrompt(
  input: FrameExpressionProposeInput
): string {
  const work = input.workTitle?.trim() || "(untitled work)";
  const route = input.routeTitle?.trim() || "(untitled route)";
  const caption = input.caption.trim();
  const current = input.currentExpression?.trim() || "(empty)";
  const note = input.operatorNote?.trim() || "(none)";
  const cues =
    !input.characterCues?.length
      ? "(none)"
      : input.characterCues
          .map((c) => {
            const vis = c.visualIdentity?.trim();
            if (!vis) return `- ${c.name}`;
            return `- ${c.name}: ${clipLocalBudgetText(vis, LOCAL_VISUAL_MAX)}`;
          })
          .join("\n");

  const named = captionProperNamePhrases(caption);
  const namedBlock =
    named.length === 0
      ? "(none extracted — still follow the caption's own names)"
      : named.map((n) => `- ${n}`).join("\n");

  return `You re-author Canonical Visual Expression for ONE Reading Frame.
This is Creator still geometry for image generation. Do NOT change the caption.

Work title: ${work}
Route title: ${route}

Frame Narrative (caption) — THIS is the beat. Expression MUST depict this same instant:
${JSON.stringify(caption)}

Caption-named agents (MUST be the Expression cast / visible subjects).
Map nicknames to Work character names (Ned = Eddard Stark). Do NOT add other Work characters the caption does not name:
${namedBlock}

Current Expression (may contradict the caption — if so, REPLACE it, do not polish):
${current}

Operator revision note (must honor if present):
${note}

Work character looks (costume/face ONLY for people already in the caption-named list — NOT a cast menu):
${cues}

Rules:
- OUTPUT LANGUAGE: English (Latin script only).
- Return ONLY valid JSON for rendererExpression (no preamble).
- Shape: ${JSON.stringify(EXPRESSION_CAPABILITY_EXAMPLE)}
- Local execute budget (Creator Default = Local). Longer tails are DROPPED at generate — write WITHIN budget so pose is not cut:
  - characters[].visual ≤ ${LOCAL_VISUAL_MAX} chars. FIRST tokens MUST be pose/blocking (kneeling, mounted, standing, holding X), THEN 1–2 look cues. Do not paste full visual identity.
  - characters[].role ≤ ${LOCAL_ROLE_MAX} chars.
  - action ≤ ${LOCAL_ACTION_MAX} chars — who does what to whom; name each figure's pose.
  - environment ≤ ${LOCAL_ENV_MAX} chars.
  - composition ≤ ${LOCAL_COMPOSITION_MAX} chars.
  - visualEmphasis / lighting / atmosphere / threatPerception ≤ ${LOCAL_EMPHASIS_MAX} chars each.
- FORBIDDEN: long costume paragraphs; repeating every archive cue; putting kneeling/mounted/holding at the END of visual.
- Caption is beat authority. Do not invent a different moment or a more famous adjacent still.
- Cast MUST come from caption-named agents. FORBIDDEN: swapping in other Work characters because they have visual cues.
- FORBIDDEN props/places the caption does not name (raven, letter, parchment, solar, godswood, empty throne) unless the caption names them.
- If caption is travel / riding / procession / going north, environment MUST be the road or approaching host — not an indoor council.
- If caption says someone is dead / absent, they MUST NOT appear alive in action or characters[].
- Convert abstract offers/alliances into visible stills (royal banners, approaching party, two named figures on the road) — not a private letter scene.
- characters[].role MUST be Work character names when they appear; never "man"/"woman".
- Dual-cast / two-figure preference MUST NOT override caption cast. If the beat is a royal progress, show that progress (Robert + retinue or Robert approaching Winterfell), not a two-person solar.
- Dual-cast when the caption actually has two figures: medium-wide, both fully visible, faces secondary.

WRONG beat example (do not do this):
caption: King Robert traveling north to offer Ned the Hand and a Joffrey–Sansa marriage.
bad expression: Catelyn and Eddard looking at a raven parchment in Winterfell solar.
good expression: kingsroad / northern approach; Robert Baratheon with royal party traveling; Ned may await the host; marriage alliance as banners or named escort — not a letter.

${EXPRESSION_CAPABILITY_RULES}

Creator production override: field lengths MUST fit the Local execute budgets above. Pose/blocking first in every visual. Ignore Discovery "do not shrink to Local prompt budget" for this re-propose.`.trim();
}
