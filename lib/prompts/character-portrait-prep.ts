/**
 * Creator production: rewrite Reader description + propose visual identity
 * in one call, so polluted bios (e.g. "Astute young military commander")
 * do not seed FACE.
 */

import { AVATAR_APPEARANCE_MAX_CHARS } from "@/lib/prompts/avatar";
import { parseVisualIdentityProposal } from "@/lib/prompts/visual-identity-propose";
import { workVisualConventionProposeBlock } from "@/lib/prompts/work-visual-convention";

export const READER_DESCRIPTION_MAX_CHARS = 280;

export type PortraitPrepProposeInput = {
  workTitle?: string;
  visualConvention?: string;
  name: string;
  house?: string;
  description?: string;
  currentVisualIdentity?: string;
  operatorNote?: string;
};

export type PortraitPrepProposal = {
  description: string;
  visualIdentity: string;
};

function clipReaderDescription(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return "";
  if (t.length <= READER_DESCRIPTION_MAX_CHARS) return t;
  const slice = t.slice(0, READER_DESCRIPTION_MAX_CHARS);
  const cut = Math.max(slice.lastIndexOf("."), slice.lastIndexOf(" "), 0);
  return (cut > 80 ? slice.slice(0, cut) : slice).trim();
}

function labeledIdentityFromRecord(
  rec: Record<string, unknown>
): string {
  if (typeof rec.visualIdentity === "string" && rec.visualIdentity.trim()) {
    return rec.visualIdentity.trim();
  }
  if (typeof rec.visual_identity === "string" && rec.visual_identity.trim()) {
    return rec.visual_identity.trim();
  }
  const parts: string[] = [];
  for (const key of ["FACE", "COSTUME", "PROP", "STYLE"] as const) {
    const lower = key.toLowerCase();
    const val =
      (typeof rec[key] === "string" && rec[key]) ||
      (typeof rec[lower] === "string" && rec[lower]);
    if (typeof val === "string" && val.trim()) {
      parts.push(`${key}: ${val.trim().replace(/\.$/, "")}.`);
    }
  }
  return parts.join("\n");
}

/** Strip fences / JSON; keep Reader bio + packed identity. */
export function parsePortraitPrepProposal(
  raw: string
): PortraitPrepProposal | null {
  let t = raw.trim();
  if (!t) return null;

  const fence = t.match(/```(?:json|text|markdown)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) t = fence[1].trim();

  let description = "";
  let identityRaw = "";
  let parsedJson = false;

  if (t.startsWith("{")) {
    try {
      const obj = JSON.parse(t) as Record<string, unknown>;
      parsedJson = true;
      if (typeof obj.description === "string") description = obj.description;
      identityRaw = labeledIdentityFromRecord(obj);
    } catch {
      // fall through
    }
  }

  if (!description) {
    const descLine = t.match(/^DESCRIPTION\s*:\s*(.+)$/im);
    if (descLine?.[1]) description = descLine[1].trim();
  }
  if (!identityRaw && !parsedJson) {
    identityRaw = t;
  }

  const visualIdentity = parseVisualIdentityProposal(identityRaw);
  const bio = clipReaderDescription(description);
  if (!bio && !visualIdentity) return null;
  if (!bio || !visualIdentity) return null;
  return { description: bio, visualIdentity };
}

export function buildPortraitPrepProposePrompt(
  input: PortraitPrepProposeInput
): string {
  const name = input.name.trim();
  const work = input.workTitle?.trim() || "(untitled work)";
  const house = input.house?.trim() || "(none)";
  const description = input.description?.trim() || "(none)";
  const current = input.currentVisualIdentity?.trim() || "(empty)";
  const note = input.operatorNote?.trim() || "(none)";
  const conventionBlock = workVisualConventionProposeBlock(input.visualConvention);
  const conventionLead = conventionBlock ? `\n${conventionBlock}\n` : "";

  return `You prepare a character for Creator portrait generation.
Return JSON only (no preamble):
{
  "description": "…",
  "visualIdentity": "FACE: …\\nCOSTUME: …\\nPROP: …\\nSTYLE: …"
}

Work: ${work}${conventionLead}
Character name: ${name}
House/faction: ${house}
Current Reader description (may be polluted with look/age — rewrite it): ${description}
Current visual identity draft: ${current}
Operator revision note (must honor if present): ${note}

description (Reader bio):
- 1–2 short English sentences: story role, faction, relationships.
- FORBIDDEN: age (young/old/middle-aged), looks (handsome, chiseled, beard, hair), costume, weapons, camera.
- Rewrite look-stuffed bios into who they are in THIS work's plot (role, faction, relationships).
- Max ${READER_DESCRIPTION_MAX_CHARS} characters.

visualIdentity (Creator portrait cues — NOT Reader prose):
- Labeled lines in order FACE, COSTUME, PROP, STYLE. Omit SUMMARY.
- FACE from THIS work's visual tradition + this name — NOT from Reader description adjectives.
- Do NOT copy "young" / idol-handsome FACE from the current description or draft when THIS work's tradition is a recognizable older or bearded figure.
- If current draft FACE is a generic youthful commander that contradicts THIS work, replace it.
- STYLE: one short clause matching THIS work.
- Keep visualIdentity compact. Execute clips to ${AVATAR_APPEARANCE_MAX_CHARS} characters (current model table).
- Example format (fill from THIS work; do not copy sample looks): "FACE: …\\nCOSTUME: …\\nPROP: …\\nSTYLE: painterly digital painting."`.trim();
}
