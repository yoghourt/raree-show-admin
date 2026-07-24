/**
 * Server-only Scene Frame draft prompt (derived Job input — not Runtime Truth).
 * Business intent remains Asset Caption; this string is recomputed per Generate.
 */
export function buildFrameDraftPrompt(input: {
  caption: string;
  routeTitle?: string;
}): string {
  const caption = input.caption.trim();
  const routeTitle = input.routeTitle?.trim() ?? "";
  const sceneLine =
    routeTitle.length > 0
      ? `Narrative reading still for scene "${routeTitle}": ${caption}.`
      : `Narrative reading still: ${caption}.`;
  return [
    sceneLine,
    "Cinematic story illustration, single coherent scene,",
    "widescreen composition suitable for a reading-route frame,",
    "clear focal subject, atmospheric lighting,",
    "no text, no letters, no typography, no caption overlay,",
    "no watermark, no logo, no UI chrome, no collage grid.",
  ].join(" ");
}
