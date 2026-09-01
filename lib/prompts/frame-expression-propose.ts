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
    /\b(?:King|Queen|Prince|Princess|Lord|Lady|Ser|Emperor|Empress)\s+\p{Lu}\p{L}+(?:\s+\p{Lu}\p{L}+)*|\b\p{Lu}\p{L}+(?:\s+\p{Lu}\p{L}+)+|\b\p{Lu}\p{L}{2,}\b/gu
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
    "Emperor",
    "Empress",
  ]);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of matches) {
    const t = raw.trim();
    const core = t.replace(TITLE_PREFIX, "").trim();
    if (!core || skip.has(core) || skip.has(t)) continue;
    if (isSentenceInitialNonName(caption, t)) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** "Backed by…" / "Enticed by…" — sentence-initial verb, not a character. */
function isSentenceInitialNonName(caption: string, name: string): boolean {
  const trimmed = caption.trim();
  if (!trimmed.startsWith(name)) return false;
  if (/\s/.test(name)) return false;
  const after = trimmed.slice(name.length).trim();
  if (/^(by|with|from|after|while|when|as|upon)\b/i.test(after)) return true;
  return name.length > 3 && /(?:ed|ing)$/i.test(name);
}

const AGENCY_PHRASE =
  /\b(?:on behalf of|sent by|by order(?:s)? of|in the name of)\s+/gi;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Names that appear only inside on-behalf-of / sent-by phrasing. */
export function captionAgencyOnlyNames(caption: string): string[] {
  const names = captionProperNamePhrases(caption);
  return names.filter((name) => {
    const stripped = caption.replace(
      new RegExp(
        `${AGENCY_PHRASE.source}(${escapeRegExp(name)})\\b`,
        "gi"
      ),
      " "
    );
    return !new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(stripped);
  });
}

/** Caption names that belong on stage (excludes agency-only principals). */
export function captionOnStageNames(caption: string): string[] {
  const agency = new Set(
    captionAgencyOnlyNames(caption).map((n) => n.toLowerCase())
  );
  return captionProperNamePhrases(caption).filter(
    (n) => !agency.has(n.toLowerCase())
  );
}

const CHILD_LIFE_STAGE =
  /\b(child emperor|boy emperor|girl empress|young boy|young girl|youthful|child|youth|teen(?:ager)?|infant|toddler)\b/i;
const ELDER_LIFE_STAGE =
  /\b(elderly|elder(?:ly)?|aged man|aged woman|white-haired)\b/i;
const ADULT_FACE_INVENTED =
  /\b((?:grey|gray)(?:-streaked)?\s+(?:goatee|beard)|white beard|long beard|goatee|middle-?aged|lined (?:face|complexion)|old man)\b/i;

function cueMatchesRole(role: string, cueName: string): boolean {
  const r = role.trim().toLowerCase();
  const n = cueName.trim().toLowerCase();
  if (!r || !n) return false;
  return r === n || r.includes(n) || n.includes(r);
}

/** Compact life-stage look from Work visual identity (survives Local visual budget). */
export function lifeStageLookFromIdentity(
  visualIdentity: string | undefined
): string | null {
  const raw = visualIdentity?.trim() ?? "";
  if (!raw) return null;
  const child = raw.match(CHILD_LIFE_STAGE);
  if (child?.[1]) return `${child[1]}, no beard`;
  const elder = raw.match(ELDER_LIFE_STAGE);
  return elder?.[1] ?? null;
}

export function findLifeStageContradictions(
  expression: RendererExpression,
  characterCues: Array<{ name: string; visualIdentity?: string }>
): string[] {
  const errors: string[] = [];
  for (const ch of expression.characters) {
    const cue = characterCues.find((c) => cueMatchesRole(ch.role, c.name));
    const stage = lifeStageLookFromIdentity(cue?.visualIdentity);
    if (!stage || !CHILD_LIFE_STAGE.test(stage)) continue;
    if (ADULT_FACE_INVENTED.test(ch.visual)) {
      errors.push(
        `${ch.role}: visual invents an adult face (${ch.visual}) against looks (${stage})`
      );
    }
  }
  return errors;
}

/** Put archive life-stage immediately after pose so Local clip keeps it. */
export function applyCharacterLifeStageLooks(
  expression: RendererExpression,
  characterCues: Array<{ name: string; visualIdentity?: string }>
): RendererExpression {
  if (!characterCues.length) return expression;
  return {
    ...expression,
    characters: expression.characters.map((ch) => {
      const cue = characterCues.find((c) => cueMatchesRole(ch.role, c.name));
      const stage = lifeStageLookFromIdentity(cue?.visualIdentity);
      if (!stage) return ch;
      if (new RegExp(escapeRegExp(stage.split(",")[0] ?? stage), "i").test(ch.visual)) {
        return ch;
      }
      const parts = ch.visual
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((p) => !ADULT_FACE_INVENTED.test(p));
      const pose = parts[0] || "standing";
      const rest = parts.slice(1);
      return {
        ...ch,
        visual: clipLocalBudgetText([pose, stage, ...rest].join(", "), LOCAL_VISUAL_MAX),
      };
    }),
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

  const named = captionOnStageNames(caption);
  const namedBlock =
    named.length === 0
      ? "(none extracted — still follow the caption's own names)"
      : named.map((n) => `- ${n}`).join("\n");
  const agency = captionAgencyOnlyNames(caption);
  const agencyBlock =
    agency.length === 0
      ? "(none)"
      : agency.map((n) => `- ${n}`).join("\n");
  const lifeStages = (input.characterCues ?? [])
    .map((c) => {
      const stage = lifeStageLookFromIdentity(c.visualIdentity);
      return stage ? `- ${c.name}: ${stage}` : null;
    })
    .filter((line): line is string => line != null);
  const lifeStageBlock =
    lifeStages.length === 0
      ? "(none in Work looks — still do not invent a mature bearded adult when Work looks or the caption mark a child or youth)"
      : lifeStages.join("\n");

  return `You re-author Canonical Visual Expression for ONE Reading Frame.
This is Creator still geometry for image generation. Do NOT change the caption.

Work title: ${work}
Route title: ${route}
Looks, places, and era MUST come from THIS work. Do not import another book's setting.

Frame Narrative (caption) — THIS is the beat. Expression MUST depict this same instant:
${JSON.stringify(caption)}

Caption-named agents ON STAGE (MUST be the Expression cast / visible subjects).
Map nicknames to Work character names. Do NOT add other Work characters the caption does not name:
${namedBlock}

Named only as the source of a gift or order (on behalf of / sent by) — MUST NOT stand in the still unless the caption places them in the scene:
${agencyBlock}

Current Expression (may contradict the caption — if so, REPLACE it, do not polish):
${current}

Operator revision note (must honor if present):
${note}

Work character looks (costume/face ONLY for people already in the caption-named list — NOT a cast menu):
${cues}

Life-stage / apparent age from Work looks (MUST appear in that character's visual right after pose):
${lifeStageBlock}

Rules:
- OUTPUT LANGUAGE: English (Latin script only).
- Return ONLY valid JSON for rendererExpression (no preamble).
- Shape: ${JSON.stringify(EXPRESSION_CAPABILITY_EXAMPLE)}
- Local execute budget (Creator Default = Local). Longer tails are DROPPED at generate — write WITHIN budget so pose is not cut:
  - characters[].visual ≤ ${LOCAL_VISUAL_MAX} chars. FIRST tokens MUST be pose/blocking (kneeling, mounted, standing, holding X), THEN 1–2 look cues. Do not paste full visual identity.
  - characters[].role ≤ ${LOCAL_ROLE_MAX} chars.
  - action ≤ ${LOCAL_ACTION_MAX} chars — COMPLETE clause for EVERY characters[] role (pose + left/right). FORBIDDEN: ending on a bare name with no verb ("…; Lü Bu"). Write the compact still first; drop adjectives if needed.
  - environment ≤ ${LOCAL_ENV_MAX} chars. From THIS caption only. FORBIDDEN: copying an interior from Current Expression when the caption does not name that place.
  - composition ≤ ${LOCAL_COMPOSITION_MAX} chars.
  - visualEmphasis / lighting / atmosphere / threatPerception ≤ ${LOCAL_EMPHASIS_MAX} chars each.
- FORBIDDEN: long costume paragraphs; repeating every archive cue; putting kneeling/mounted/holding at the END of visual.
- Caption is beat authority. Do not invent a different moment or a more famous adjacent still.
- Cast MUST come from caption-named agents. FORBIDDEN: swapping in other Work characters because they have visual cues.
- FORBIDDEN: inventing props or places the caption does not name.
- If caption is travel / riding / procession / going north, environment MUST be the road or approaching host — not an indoor council from another beat.
- If caption says someone is dead / absent, they MUST NOT appear alive in action or characters[].
- Convert abstract offers/alliances into visible stills that match the caption's place — do not substitute a different private interior.
- characters[].role MUST be Work character names when they appear; never "man"/"woman".
- characters[].role MUST be a person, never a sentence verb (Backed, Enticed) or a generic title (Emperor, King) alone.
- Dual-cast / two-figure preference MUST NOT override caption cast. If the beat is a procession or arrival, show that procession — not a private two-person interior from another beat.
- Dual-cast when the caption actually has two figures: medium-wide, both fully visible, faces secondary.
- Caption-named groups the beat acts on (eunuchs, officials, retinue) MUST appear in characters[] with a static pose even without a Work character row. Do not leave them only in action prose.
- Named mounts and treasure in the caption are props between the figures — not extra people in characters[].
- Current Expression is a draft to replace, not a location lock.
- Apparent age / life-stage is identity. After pose, the next look cue MUST keep child/youth/elder tokens from Work looks. Title (Emperor, King) MUST NOT default to a mature bearded adult. FORBIDDEN: grey goatee / lined middle-aged face / "mournful features" as a substitute for a boy emperor.

Structural counterexamples (geometry only — do not copy their era, costumes, or place names into this work):
WRONG beat example (do not do this):
caption: King Robert traveling north to offer Ned the Hand and a Joffrey–Sansa marriage.
bad expression: Catelyn and Eddard looking at a raven parchment in Winterfell solar.
good expression: kingsroad / northern approach; Robert Baratheon with royal party traveling; Ned may await the host; marriage alliance as banners or named escort — not a letter.

WRONG relationship geometry (do not do this):
caption: Enraged, Yuan Shao and Cao Cao storm the palace, slaughtering the eunuchs.
bad: two armed generals facing each other, blades crossed (duel). Eunuchs omitted from characters[].
good: Yuan Shao and Cao Cao side by side facing the same hall; blades down at kneeling/fallen eunuchs in characters[]; not at each other.

caption: Ding Yuan denounces treason; Dong Zhuo stops his execution sword upon seeing Lü Bu.
bad: Ding Yuan and Dong Zhuo two-shot, Lü Bu missing or a blur.
good: Ding Yuan left pointing; Lü Bu center in front of him; Dong Zhuo right, sword lowered not striking.

caption: Li Su bears Red Hare, gold and jade on behalf of Dong Zhuo; Lü Bu agrees to switch sides.
bad: Dong Zhuo standing in the hall watching; action truncated as "…; Lü Bu"; imperial palace copied from the previous frame.
good: camp courtyard; Li Su left with Red Hare reins and chests; Lü Bu right looking at the horse; Dong Zhuo off-stage. Action names both poses within the Local action budget.

caption: Dong Zhuo elevates Emperor Xian and seizes absolute power.
bad: Emperor Xian as a middle-aged man with grey goatee, mournful adult face, opulent robes only.
good: Dong Zhuo towering left; Emperor Xian a boy emperor about nine, no beard, small on the throne.

${EXPRESSION_CAPABILITY_RULES}

Creator production override: field lengths MUST fit the Local execute budgets above. Pose/blocking first in every visual. Ignore Discovery "do not shrink to Local prompt budget" for this re-propose.`.trim();
}
