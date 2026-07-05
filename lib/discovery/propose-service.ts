/**
 * SPEC-D3-003 §4.7 — Discovery Proposals generation service
 *
 * Reuses callCopilotTextLlm (ADR-006 Decision 6). MUST NOT use suggest-service.
 */

import { randomUUID } from "crypto";

import { callCopilotTextLlm } from "@/lib/ai/copilot-text-llm";
import { MAX_CANDIDATES_PER_TYPE } from "@/lib/discovery/constants";
import {
  capCandidatesByType,
  dedupeCandidates,
  getCandidateDedupeKey,
  getCandidateLabelKey,
  normalizeRawCandidate,
} from "@/lib/discovery/candidate-validate";
import { parseCandidateArray } from "@/lib/discovery/propose-parse";
import {
  DISCOVERY_CANDIDATE_TYPES,
  type DiscoveryCandidate,
  type DiscoveryCandidateType,
  type ProposeTypeError,
} from "@/lib/discovery/propose-types";
import type { NarrativeInputBundle } from "@/lib/discovery/types";

export function isDiscoveryProposeMockMode(): boolean {
  return (
    process.env.DISCOVERY_PROPOSE_MODE === "mock" ||
    process.env.VITEST === "true"
  );
}

const REGISTRY_FIELD_HINTS: Record<DiscoveryCandidateType, string[]> = {
  character: ["name", "house", "description", "signatureQuote"],
  location: ["name", "region", "description"],
  story: ["title", "summary", "boundaryHint"],
  scene: ["chapter_title", "chapter_number", "title", "summary"],
};

const TYPE_EXAMPLES: Record<DiscoveryCandidateType, string> = {
  character: `{"candidates":[{"displayName":"Arya Stark","summary":"Young Stark daughter.","fields":{"name":"Arya Stark","house":"Stark"}}]}`,
  location: `{"candidates":[{"displayName":"Winterfell","summary":"Seat of House Stark.","fields":{"name":"Winterfell","region":"The North"}}]}`,
  story: `{"candidates":[{"displayName":"The Royal Visit","summary":"Editorial story unit.","fields":{"title":"The Royal Visit","summary":"Prose summary of the story arc."}}]}`,
  scene: `{"candidates":[{"displayName":"Courtyard Welcome","summary":"Royal arrival scene.","fields":{"chapter_number":1,"chapter_title":"Bran I","title":"Courtyard Welcome","summary":"Household gathers in the courtyard."}}]}`,
};

function mockCandidatesForType(
  workId: string,
  candidateType: DiscoveryCandidateType
): DiscoveryCandidate[] {
  switch (candidateType) {
    case "character":
      return [
        {
          candidateId: randomUUID(),
          candidateType,
          workId,
          displayName: "Eddard Stark",
          summary: "Lord of Winterfell, honorable and duty-bound.",
          confidence: "yellow",
          fields: {
            name: "Eddard Stark",
            house: "Stark",
            description: "Warden of the North who values honor above politics.",
          },
        },
      ];
    case "location":
      return [
        {
          candidateId: randomUUID(),
          candidateType,
          workId,
          displayName: "Winterfell",
          summary: "Ancient seat of House Stark in the North.",
          confidence: "green",
          fields: {
            name: "Winterfell",
            region: "The North",
            description: "A sprawling castle built over hot springs.",
          },
        },
      ];
    case "story":
      return [
        {
          candidateId: randomUUID(),
          candidateType,
          workId,
          displayName: "The King's Arrival",
          summary: "Royal visit that sets political tensions in motion.",
          fields: {
            title: "The King's Arrival",
            summary:
              "Editorial story unit covering the royal visit and its consequences.",
            boundaryHint: "Spans arrival through the feast; not ONE-adjudicated.",
          },
        },
      ];
    case "scene":
      return [
        {
          candidateId: randomUUID(),
          candidateType,
          workId,
          displayName: "Courtyard Welcome",
          summary: "The royal party is received in the courtyard.",
          fields: {
            chapter_number: 1,
            chapter_title: "Bran I",
            title: "Courtyard Welcome",
            summary: "Stark household assembles to greet the king.",
          },
        },
      ];
  }
}

function buildProposePrompt(params: {
  workTitle: string;
  narrative: NarrativeInputBundle;
  candidateType: DiscoveryCandidateType;
  feedback?: string | null;
  previousCandidate?: DiscoveryCandidate;
  excludeCandidates?: DiscoveryCandidate[];
}): string {
  const {
    workTitle,
    narrative,
    candidateType,
    feedback,
    previousCandidate,
    excludeCandidates,
  } = params;
  const hints = REGISTRY_FIELD_HINTS[candidateType].join(", ");

  const regenBlock = previousCandidate
    ? `\nPrevious candidate (replace with improved version):\n${JSON.stringify(previousCandidate, null, 2)}\nOperator feedback: ${feedback ?? "(none)"}\n`
    : "";

  const excludeBlock = excludeCandidates?.length
    ? `\nOther candidates already in this review session (MUST NOT duplicate name/title):\n${excludeCandidates
        .map(
          (candidate) =>
            `- ${candidate.candidateType}: ${candidate.displayName} (${getCandidateLabelKey(candidate)})`
        )
        .join("\n")}\n`
    : "";

  return `You are a Discovery Copilot generating editorial Candidates for a narrative work.
Work title: ${workTitle}
Candidate type: ${candidateType}
Hard cap (never exceed): ${MAX_CANDIDATES_PER_TYPE} per type

Locked narrative bundle (JSON):
${JSON.stringify(narrative, null, 2)}
${regenBlock}${excludeBlock}
Generation rules (critical):
- OUTPUT LANGUAGE (mandatory): Every string in your JSON response MUST be English (Latin script only).
  This includes displayName, summary, all fields values, evidence sourceLabel/excerpt, chapter_title, title, name, etc.
  The narrative input MAY be Chinese or another language — you MUST still emit English canonical names
  (e.g. character "Gared" not "盖雷德", location "Winterfell" not "临冬城").
  Do NOT return Chinese, Japanese, Korean, or other CJK/non-Latin text in candidate output.
  Use established English spellings from the work when known; otherwise use standard English transliteration.
- Include ONLY ${candidateType} entities explicitly supported by the narrative prose above.
- Do NOT invent background cast, generic extras, or inferred entities not grounded in the text.
- Do NOT pad the list to reach the cap. Prefer fewer accurate candidates.
- For a single chapter excerpt, typical counts are: character 2-5, location 1-3, story 1-2, scene 1-4 — use what the text actually supports.
- If the narrative supports zero distinct ${candidateType} units, return {"candidates":[]}.

Return ONLY valid JSON — a single object {"candidates":[...]}. No markdown fences, no commentary.
Each item MUST have: displayName (string), summary (string), fields (object with required keys for this type).
Allowed field names in "fields": ${hints}
Optional per item: confidence ("green"|"yellow"|"red"), evidence ([{sourceLabel, excerpt?}]).

Example shape for type "${candidateType}":
${TYPE_EXAMPLES[candidateType]}
${candidateType === "scene" ? '\nScene fields MUST live under "fields" with chapter_number as an INTEGER ≥ 1 (sortable chapter index, e.g. 1, 2, 3 — NOT POV labels). Put POV labels like "Bran I" in chapter_title. title is required; optional summary.\n' : ""}
${candidateType === "location" ? '\nLocation fields MUST use fields.name (place name). Do NOT return prose paragraphs as the only value.\n' : ""}

Do NOT include asset fields (portraitUrl, map coordinates, story_images_v2, tags, locationId, characterIds).
Candidates are proposals only — not canonical entities.`;
}

async function generateForType(params: {
  workId: string;
  workTitle: string;
  narrative: NarrativeInputBundle;
  candidateType: DiscoveryCandidateType;
  feedback?: string | null;
  previousCandidate?: DiscoveryCandidate;
  excludeCandidates?: DiscoveryCandidate[];
}): Promise<{ candidates: DiscoveryCandidate[]; error?: ProposeTypeError }> {
  const { workId, workTitle, narrative, candidateType } = params;

  if (isDiscoveryProposeMockMode()) {
    return { candidates: mockCandidatesForType(workId, candidateType) };
  }

  try {
    const prompt = buildProposePrompt(params);
    const raw = await callCopilotTextLlm(prompt, { geminiJsonObject: true });
    if (process.env.DISCOVERY_PROPOSE_DEBUG === "1") {
      console.info(
        "[discovery-propose] type=%s raw_len=%d preview=%s",
        candidateType,
        raw.length,
        raw.slice(0, 400).replace(/\s+/g, " ")
      );
    }
    const items = parseCandidateArray(raw, candidateType);

    if (items.length === 0) {
      return { candidates: [] };
    }

    const candidates: DiscoveryCandidate[] = [];
    const validationErrors: string[] = [];

    for (const item of items) {
      const normalized = normalizeRawCandidate(item, candidateType, workId);
      if (normalized.ok) {
        candidates.push(normalized.candidate);
      } else {
        validationErrors.push(...normalized.errors);
      }
    }

    const capped = capCandidatesByType(dedupeCandidates(candidates));

    if (capped.length === 0) {
      const parseFailMessage =
        validationErrors[0] ??
        (items.length === 0
          ? "Model returned no parseable candidates"
          : "Model output could not be parsed into valid candidates");
      console.error(
        "[discovery-propose] type=%s PARSE_FAILED items=%d errors=%j",
        candidateType,
        items.length,
        validationErrors
      );
      if (process.env.DISCOVERY_PROPOSE_DEBUG === "1") {
        console.warn(
          "[discovery-propose] type=%s validation_errors=%j",
          candidateType,
          validationErrors
        );
      }
      return {
        candidates: [],
        error: {
          candidateType,
          code: "GENERATION_PARSE_FAILED",
          message: parseFailMessage,
        },
      };
    }

    return { candidates: capped };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    console.error(
      "[discovery-propose] type=%s GENERATION_FAILED: %s",
      candidateType,
      message
    );
    return {
      candidates: [],
      error: {
        candidateType,
        code: "GENERATION_FAILED",
        message,
      },
    };
  }
}

export async function proposeCandidateTypes(params: {
  workId: string;
  workTitle: string;
  narrative: NarrativeInputBundle;
  candidateTypes?: DiscoveryCandidateType[];
  feedback?: string | null;
}): Promise<{ candidates: DiscoveryCandidate[]; errors: ProposeTypeError[] }> {
  const types = params.candidateTypes ?? [...DISCOVERY_CANDIDATE_TYPES];
  const allCandidates: DiscoveryCandidate[] = [];
  const errors: ProposeTypeError[] = [];

  for (const candidateType of types) {
    const result = await generateForType({
      workId: params.workId,
      workTitle: params.workTitle,
      narrative: params.narrative,
      candidateType,
      feedback: params.feedback,
    });
    allCandidates.push(...result.candidates);
    if (result.error) {
      errors.push(result.error);
    }
  }

  return {
    candidates: capCandidatesByType(dedupeCandidates(allCandidates)),
    errors,
  };
}

export async function proposeAllCandidateTypes(params: {
  workId: string;
  workTitle: string;
  narrative: NarrativeInputBundle;
}): Promise<{ candidates: DiscoveryCandidate[]; errors: ProposeTypeError[] }> {
  return proposeCandidateTypes(params);
}

export async function regenCandidate(params: {
  workId: string;
  workTitle: string;
  narrative: NarrativeInputBundle;
  candidateType: DiscoveryCandidateType;
  previousCandidate: DiscoveryCandidate;
  siblingCandidates?: DiscoveryCandidate[];
  feedback?: string | null;
}): Promise<{ candidate?: DiscoveryCandidate; error?: ProposeTypeError }> {
  if (params.previousCandidate.candidateType !== params.candidateType) {
    return {
      error: {
        candidateType: params.candidateType,
        code: "REGEN_INVALID",
        message: "previousCandidate.candidateType mismatch",
      },
    };
  }
  if (params.previousCandidate.workId !== params.workId) {
    return {
      error: {
        candidateType: params.candidateType,
        code: "REGEN_INVALID",
        message: "previousCandidate.workId mismatch",
      },
    };
  }

  const result = await generateForType({
    workId: params.workId,
    workTitle: params.workTitle,
    narrative: params.narrative,
    candidateType: params.candidateType,
    feedback: params.feedback,
    previousCandidate: params.previousCandidate,
    excludeCandidates: params.siblingCandidates,
  });

  const excludeKeys = new Set(
    (params.siblingCandidates ?? []).map((candidate) =>
      getCandidateDedupeKey(candidate)
    )
  );
  const candidate = result.candidates.find(
    (item) => !excludeKeys.has(getCandidateDedupeKey(item))
  );

  if (!candidate) {
    if (result.candidates.length > 0) {
      return {
        error: {
          candidateType: params.candidateType,
          code: "REGEN_DUPLICATE",
          message:
            "Regenerated candidate duplicates another item in this review session",
        },
      };
    }
    return {
      error: result.error ?? {
        candidateType: params.candidateType,
        code: "GENERATION_FAILED",
        message: "Regen produced no candidate",
      },
    };
  }

  return { candidate };
}
