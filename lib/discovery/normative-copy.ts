/**
 * SPEC-D3-001 §4.4 — normative UI copy (English per spec)
 */

export const DISCOVERY_NARRATIVE_HINT =
  "Discovery is narrative-first. Do not use keyword lists, Runtime Scene table exports, or Chapter Catalog spine metadata as the sole input.";

export const DISCOVERY_FORBIDDEN_INPUTS = [
  "Keyword lists alone",
  "Runtime Scene identifiers or Scene table exports alone",
  "Chapter Catalog spine metadata alone",
] as const;

export const DISCOVERY_EXAMPLES = [
  {
    label: "Good",
    example:
      "Three excerpts from different chapters describing the Red Wedding (Catelyn POV arrival, betrayal beat, aftermath), reordered for Story reading order; total prose ≥ 512 chars",
    verdict: "PASS",
  },
  {
    label: "Bad",
    example: 'Single line "Red Wedding, Robb, Walder Frey, Catelyn"',
    verdict: "FAIL (NG-05)",
  },
  {
    label: "Bad",
    example:
      "Exported Scene table titles/chapter numbers only, no prose excerpts",
    verdict: "FAIL (NG-06)",
  },
  {
    label: "Bad",
    example:
      "Chapter Catalog spine (chapter_number + title list) pasted without narrative prose",
    verdict: "FAIL (NG-06)",
  },
  {
    label: "Good",
    example:
      "Operator-written approved summary ≥ 768 chars with attestation checkbox; optional zero excerpts",
    verdict: "PASS (approved_summary)",
  },
] as const;
