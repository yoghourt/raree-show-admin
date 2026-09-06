/**
 * Creator-only: propose a portrait visual_identity draft (not Reader description).
 * Output is operator-editable FACE/COSTUME/PROP/STYLE text — not Archive objects.
 * Length is packed to the current model appearance budget (capability table).
 */

import {
  AVATAR_APPEARANCE_MAX_CHARS,
  packVisualIdentityForPortrait,
} from "@/lib/prompts/avatar";
import { workVisualConventionProposeBlock } from "@/lib/prompts/work-visual-convention";
import type { CharacterArchive } from "@/lib/discovery/character-archive";
import { parseCharacterArchive } from "@/lib/discovery/character-archive";

export type VisualIdentityProposeInput = {
  workTitle?: string;
  visualConvention?: string;
  name: string;
  house?: string;
  description?: string;
  currentVisualIdentity?: string;
  operatorNote?: string;
};

const LABEL_LINE =
  /^(SUMMARY|FACE|COSTUME|PROP|STYLE)\s*:\s*.+/im;

/** Strip markdown fences / JSON wrappers from model output. */
export function parseVisualIdentityProposal(raw: string): string {
  let t = raw.trim();
  if (!t) return "";

  const fence = t.match(/```(?:text|markdown)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) t = fence[1].trim();

  if (t.startsWith("{")) {
    try {
      const obj = JSON.parse(t) as Record<string, unknown>;
      const fromField =
        (typeof obj.visualIdentity === "string" && obj.visualIdentity) ||
        (typeof obj.visual_identity === "string" && obj.visual_identity) ||
        (typeof obj.proposal === "string" && obj.proposal);
      if (fromField) t = fromField.trim();
      else {
        const parts: string[] = [];
        for (const key of ["FACE", "COSTUME", "PROP", "STYLE", "SUMMARY"] as const) {
          const lower = key.toLowerCase();
          const val =
            (typeof obj[key] === "string" && obj[key]) ||
            (typeof obj[lower] === "string" && obj[lower]);
          if (typeof val === "string" && val.trim()) {
            parts.push(`${key}: ${val.trim().replace(/\.$/, "")}.`);
          }
        }
        if (parts.length) t = parts.join("\n");
      }
    } catch {
      // keep text
    }
  }

  // Keep labeled lines; drop leading chatter.
  const lines = t
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const labeled = lines.filter((l) => LABEL_LINE.test(l));
  const extracted = labeled.length >= 1 ? labeled.join("\n") : t;
  return packVisualIdentityForPortrait(extracted);
}

function labeledLineValue(text: string, label: string): string {
  const match = text.match(new RegExp(`^${label}\\s*:\\s*(.+)$`, "im"));
  if (!match?.[1]) return "";
  return match[1].replace(/\.+$/, "").trim();
}

function cuesFromLabeledLine(text: string, label: string): string[] {
  const value = labeledLineValue(text, label);
  if (!value) return [];
  const parts = value
    .split(/\s*[,;]\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts : [value];
}

/** Map FACE/COSTUME/PROP proposal text back to Role Character Archive. */
export function characterArchiveFromLabeledIdentity(
  text: string
): CharacterArchive | null {
  const packed = parseVisualIdentityProposal(text);
  if (!packed) return null;
  const identityCues = cuesFromLabeledLine(packed, "FACE");
  const costumeCues = cuesFromLabeledLine(packed, "COSTUME");
  const propCues = cuesFromLabeledLine(packed, "PROP");
  const visualSummary = labeledLineValue(packed, "SUMMARY");
  const parsed = parseCharacterArchive({
    ...(visualSummary ? { visualSummary } : {}),
    ...(identityCues.length ? { identityCues } : {}),
    costumeCues,
    propCues,
  });
  if (!parsed.ok) return null;
  return parsed.value;
}

export function buildVisualIdentityProposePrompt(
  input: VisualIdentityProposeInput
): string {
  const name = input.name.trim();
  const work = input.workTitle?.trim() || "(untitled work)";
  const house = input.house?.trim() || "(none)";
  const description = input.description?.trim() || "(none)";
  const current = input.currentVisualIdentity?.trim() || "(empty)";
  const note = input.operatorNote?.trim() || "(none)";
  const conventionBlock = workVisualConventionProposeBlock(input.visualConvention);
  const conventionLead = conventionBlock ? `\n${conventionBlock}\n` : "";

  return `You propose Creator visual identity text for a character portrait (image model input).
This is NOT Reader prose. Output short English cue lines only.

Work: ${work}${conventionLead}
Character name: ${name}
House/faction: ${house}
Reader description (story role only — IGNORE age/look words like young, handsome, chiseled, beard, robes): ${description}
Current visual identity draft: ${current}
Operator revision note (must honor if present): ${note}

Rules:
- Output ONLY labeled lines, one per line, no preamble, in this order:
  FACE: …
  COSTUME: …
  PROP: …
  STYLE: …
- FACE, COSTUME, and PROP are required when the role has a stable look.
- STYLE: one short clause matching THIS work (title above). Omit SUMMARY — it wastes the Local budget.
- Stable visual identity only: face/skin, hair/beard, clothing silhouette, iconic standing weapon.
- FORBIDDEN: scene action, emotion, camera, InstantID, LoRA, reference image language.
- Prefer short English phrases (Local image models). No long adjectives.
- When source text omits iconic look but THIS work has a stable visual tradition, propose as editable tradition cues for THIS work — do NOT copy another work's costumes, weapons, or poster style.
- FACE is anatomy (skin, hair, beard, scars), not a job title. COSTUME names garments and materials of THIS work's era.
- FACE comes from THIS work's visual tradition + name, not from Reader description adjectives.
- If current draft FACE is a generic youthful idol that contradicts THIS work's tradition, replace it; otherwise improve the draft.
- Honor operator note over conflicting draft bits.
- Keep FACE / COSTUME / PROP compact. Execute clips identity to ${AVATAR_APPEARANCE_MAX_CHARS} characters (current model table, not an Architecture ceiling).
- Example format (fill from THIS work; do not copy sample looks): "FACE: …\\nCOSTUME: …\\nPROP: …\\nSTYLE: painterly digital painting."`.trim();
}
