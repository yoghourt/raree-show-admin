/**
 * Creator-only: propose a portrait visual_identity draft (not Reader description).
 * Output is operator-editable FACE/COSTUME/PROP/STYLE text — not Archive objects.
 */

export type VisualIdentityProposeInput = {
  workTitle?: string;
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
        for (const key of ["SUMMARY", "FACE", "COSTUME", "PROP", "STYLE"] as const) {
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
  if (labeled.length >= 1) {
    return labeled.join("\n").slice(0, 1200);
  }
  return t.slice(0, 1200);
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

  return `You propose Creator visual identity text for a character portrait (image model input).
This is NOT Reader prose. Output short English cue lines only.

Work: ${work}
Character name: ${name}
House/faction: ${house}
Reader description (context only, do not copy as identity): ${description}
Current visual identity draft: ${current}
Operator revision note (must honor if present): ${note}

Rules:
- Output ONLY labeled lines, one per line, no preamble:
  SUMMARY: …
  FACE: …
  COSTUME: …
  PROP: …
  STYLE: …
- Prefer FACE / COSTUME / PROP; SUMMARY and STYLE optional but STYLE recommended.
- Stable visual identity only: face/skin, hair/beard, clothing silhouette, iconic standing weapon.
- FORBIDDEN: scene action, emotion, camera, InstantID, LoRA, reference image language.
- Prefer short English phrases (Local image models).
- When source text omits iconic look but the work has a stable visual tradition, propose as editable tradition cues — do NOT claim they were extracted from the description.
- STYLE must push semi-realistic digital painting / painterly skin texture; avoid Chinese New Year poster, nianhua, temple icon, flat opera face paint, glowing neon weapons.
- If FACE needs a reddish complexion, write natural skin texture wording (e.g. ruddy bronze complexion with pores) — NEVER bare "red face" alone.
- If current draft exists, improve it; honor operator note over conflicting draft bits.
- Keep total under ~800 characters.`.trim();
}
