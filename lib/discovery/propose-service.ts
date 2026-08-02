/**
 * SPEC-D3-003 §4.7 — Discovery Proposals generation service
 *
 * Reuses callCopilotTextLlm (ADR-006 Decision 6). MUST NOT use suggest-service.
 * Story-first order: character → location → story → scene (Sprint #2).
 */

import { randomUUID } from "crypto";

import { callDiscoveryTextLlm } from "@/lib/discovery/discovery-text-llm";
import { MAX_CANDIDATES_PER_TYPE } from "@/lib/discovery/constants";
import {
  applyCharacterArchivesToSceneCandidate,
  capCandidatesByType,
  dedupeCandidates,
  filterScenesWithValidParents,
  getCandidateDedupeKey,
  getCandidateLabelKey,
  normalizeRawCandidate,
} from "@/lib/discovery/candidate-validate";
import {
  CHARACTER_ARCHIVE_PROPOSE_RULES,
  CHARACTER_ARCHIVE_SCENE_FOLD_RULES,
} from "@/lib/discovery/character-archive";
import {
  EXPRESSION_CAPABILITY_EXAMPLE,
  EXPRESSION_CAPABILITY_RULES,
  EXPRESSION_COURTYARD_EXAMPLE,
} from "@/lib/discovery/expression-capability-rules";
import { parseCandidateArray } from "@/lib/discovery/propose-parse";
import {
  DISCOVERY_CANDIDATE_TYPES,
  type CharacterCandidateFields,
  type DiscoveryCandidate,
  type DiscoveryCandidateType,
  type ProposeTypeError,
  type SceneCandidateFields,
  type StoryCandidateFields,
} from "@/lib/discovery/propose-types";
import type { NarrativeInputBundle } from "@/lib/discovery/types";

export function isDiscoveryProposeMockMode(): boolean {
  // Allow opting into real LLM path under Vitest for taxonomy / integration tests.
  if (process.env.DISCOVERY_PROPOSE_MODE === "live") {
    return false;
  }
  return (
    process.env.DISCOVERY_PROPOSE_MODE === "mock" ||
    process.env.VITEST === "true"
  );
}

const REGISTRY_FIELD_HINTS: Record<DiscoveryCandidateType, string[]> = {
  character: [
    "name",
    "house",
    "description",
    "signatureQuote",
    "characterArchive",
  ],
  location: ["name", "region", "description"],
  story: ["title", "summary", "boundaryHint"],
  scene: [
    "parentStoryCandidateId",
    "chapter_title",
    "chapter_number",
    "title",
    "summary",
    "visualIntent",
    "rendererExpression",
  ],
};

const TYPE_EXAMPLES: Record<DiscoveryCandidateType, string> = {
  character: `{"candidates":[{"displayName":"Eddard Stark","summary":"Lord of Winterfell.","fields":{"name":"Eddard Stark","house":"Stark","characterArchive":{"visualSummary":"Northern lord shaped by honor and winter","costumeCues":["dark northern fur cloak","wool noble attire"],"propCues":["ancestral greatsword"]}}}]}`,
  location: `{"candidates":[{"displayName":"Winterfell","summary":"Seat of House Stark.","fields":{"name":"Winterfell","region":"The North"}}]}`,
  story: `{"candidates":[{"displayName":"The Royal Visit","summary":"Editorial story unit.","fields":{"title":"The Royal Visit","summary":"Prose summary of the story arc."}}]}`,
  scene: `{"candidates":[{"displayName":"Moonlit Duel","summary":"Ser Waymar Royce faces the Other under the trees.","fields":{"parentStoryCandidateId":"<story-candidate-id>","chapter_number":1,"chapter_title":"Prologue","title":"Moonlit Duel","summary":"Ser Waymar Royce confronts a White Walker in a fatal duel; Will watches from cover.","visualIntent":{"relationship":"knight confronts white walker","purpose":"establish lethal threat","emotion":"defiance"},"rendererExpression":${JSON.stringify(EXPRESSION_CAPABILITY_EXAMPLE)}}}]}`,
};

function mockCandidatesForType(
  workId: string,
  candidateType: DiscoveryCandidateType,
  storyCandidates: DiscoveryCandidate[] = []
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
            characterArchive: {
              visualSummary: "Northern lord shaped by honor and winter",
              costumeCues: ["dark northern fur cloak", "wool noble attire"],
              propCues: ["ancestral greatsword"],
            },
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
    case "scene": {
      const parent =
        storyCandidates.find((c) => c.candidateType === "story") ??
        storyCandidates[0];
      const parentStoryCandidateId = parent?.candidateId ?? randomUUID();
      return [
        {
          candidateId: randomUUID(),
          candidateType,
          workId,
          displayName: "Courtyard Welcome",
          summary: "The royal party is received in the courtyard.",
          fields: {
            parentStoryCandidateId,
            chapter_number: 1,
            chapter_title: "Bran I",
            title: "Courtyard Welcome",
            summary: "Stark household assembles to greet the king.",
            visualIntent: {
              relationship: "household greets royal party",
              purpose: "establish arrival tension",
            },
            rendererExpression: { ...EXPRESSION_COURTYARD_EXAMPLE },
          },
        },
      ];
    }
  }
}

function formatStoryListForPrompt(
  storyCandidates: DiscoveryCandidate[]
): string {
  if (storyCandidates.length === 0) {
    return "(none — do not invent parentStoryCandidateId; return {\"candidates\":[]})";
  }
  return storyCandidates
    .map((c) => {
      const fields = c.fields as StoryCandidateFields;
      return `- candidateId: ${c.candidateId} | title: ${fields.title} | summary: ${fields.summary}`;
    })
    .join("\n");
}

/** Exported for provider-eval harness only — production path unchanged. */
function formatRoleArchiveListForPrompt(
  characterCandidates: DiscoveryCandidate[]
): string {
  const lines = characterCandidates
    .filter((c) => c.candidateType === "character")
    .map((c) => {
      const fields = c.fields as CharacterCandidateFields;
      const archive = fields.characterArchive;
      if (!archive) {
        return `- ${fields.name}: (no characterArchive)`;
      }
      return `- ${fields.name}: costumeCues=${JSON.stringify(archive.costumeCues)}; propCues=${JSON.stringify(archive.propCues)}`;
    });
  if (lines.length === 0) {
    return "(none — author Expression visuals without Role archive fold)";
  }
  return lines.join("\n");
}

export function buildProposePrompt(params: {
  workTitle: string;
  narrative: NarrativeInputBundle;
  candidateType: DiscoveryCandidateType;
  feedback?: string | null;
  previousCandidate?: DiscoveryCandidate;
  excludeCandidates?: DiscoveryCandidate[];
  storyCandidates?: DiscoveryCandidate[];
  /** Role candidates (character) for SPEC-CHAR-001 scene Expression fold. */
  characterCandidates?: DiscoveryCandidate[];
}): string {
  const {
    workTitle,
    narrative,
    candidateType,
    feedback,
    previousCandidate,
    excludeCandidates,
    storyCandidates = [],
    characterCandidates = [],
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

  const storyParentBlock =
    candidateType === "scene"
      ? `\nEditorial hierarchy: Work → Story → Scene.
Scene candidates are Editorial Scenes that belong under a Story (NOT Runtime Reading Routes).
Proposed Story candidates in this batch (you MUST set fields.parentStoryCandidateId to one of these candidateId values):
${formatStoryListForPrompt(storyCandidates)}
Do NOT use Reading-route framing. Do NOT invent parentStoryCandidateId values.\n`
      : "";

  return `You are a Discovery Copilot generating editorial Candidates for a narrative work.
Work title: ${workTitle}
Candidate type: ${candidateType}
Hard cap (never exceed): ${MAX_CANDIDATES_PER_TYPE} per type

Locked narrative bundle (JSON):
${JSON.stringify(narrative, null, 2)}
${regenBlock}${excludeBlock}${storyParentBlock}
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
${candidateType === "scene" ? `\nScene fields MUST live under "fields" with parentStoryCandidateId (required, from the Story list above), chapter_number as an INTEGER ≥ 1 (sortable chapter index, e.g. 1, 2, 3 — NOT POV labels). Put POV labels like "Bran I" in chapter_title. title is required; optional summary.

Reader-facing prose (CRITICAL — not Expression):
- fields.title, fields.summary, displayName, and top-level summary are for human readers.
  Frame caption after write uses fields.summary (fallback to title if summary empty).
- Prefer proper names from the narrative (e.g. Will, Ser Waymar Royce, Gared) when the text supports them.
- Do NOT shorten, role-genericize, or "minimize" reader prose for image-model constraints.
- Expression authorship rules below apply ONLY to fields.rendererExpression — NEVER to title/summary/caption-bound fields.

Visualization (ADR-011 A5 / SPEC-DVE-001 v1.4 — required):
- fields.rendererExpression is REQUIRED Canonical Visual Expression:
  { environment, characters (array, MAY be []), action, composition,
    lighting?, atmosphere?, threatPerception?, visualEmphasis?, styleHints? }.
- Author for the best renderer: include optional lighting/atmosphere/threatPerception/visualEmphasis when Intent supports them.
- characters MAY be [] for landscape/atmosphere scenes; when non-empty each item needs role + visual (identity + prop/costume).
- fields.visualIntent is OPTIONAL by scene: { characters?, relationship?, emotion?, purpose? }. Presence optional; quality when present.
- visualIntent is narrative meaning only — NO camera/composition/prompt tokens in Intent.
- Narrow-fold Intent cues into Expression optional fields in the SAME propose output (no second AI call).
- styleHints: stable style family only; FORBIDDEN: masterpiece, 8k, best quality, ultra detailed.

${EXPRESSION_CAPABILITY_RULES}

${CHARACTER_ARCHIVE_SCENE_FOLD_RULES}

Role Character Archives available for cue selection:
${formatRoleArchiveListForPrompt(characterCandidates)}
\n` : ""}
${candidateType === "character" ? `\n${CHARACTER_ARCHIVE_PROPOSE_RULES}\n` : ""}
${candidateType === "location" ? '\nLocation fields MUST use fields.name (place name). Do NOT return prose paragraphs as the only value.\n' : ""}
${candidateType === "story" ? '\nStory fields MUST use fields.title and fields.summary (editorial story unit). Optional boundaryHint. Return {"candidates":[...]} — each item needs displayName, summary, and fields with title + summary.\n' : ""}

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
  storyCandidates?: DiscoveryCandidate[];
  characterCandidates?: DiscoveryCandidate[];
}): Promise<{ candidates: DiscoveryCandidate[]; error?: ProposeTypeError }> {
  const {
    workId,
    workTitle,
    narrative,
    candidateType,
    storyCandidates = [],
    characterCandidates = [],
  } = params;

  if (candidateType === "scene" && storyCandidates.length === 0) {
    return {
      candidates: [],
      error: {
        candidateType,
        code: "SCENE_REQUIRES_STORY",
        message:
          "Scene propose requires at least one Story candidate in the same batch",
      },
    };
  }

  if (isDiscoveryProposeMockMode()) {
    const mocked = mockCandidatesForType(
      workId,
      candidateType,
      storyCandidates
    );
    return {
      candidates:
        candidateType === "scene"
          ? mocked.map((c) =>
              applyCharacterArchivesToSceneCandidate(c, characterCandidates)
            )
          : mocked,
    };
  }

  const timingOn = process.env.DISCOVERY_PROPOSE_TIMING === "1";
  const t0 = timingOn ? Date.now() : 0;

  try {
    const prompt = buildProposePrompt(params);
    const raw = await callDiscoveryTextLlm(prompt, { geminiJsonObject: true });
    const llmMs = timingOn ? Date.now() - t0 : 0;
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
      if (timingOn) {
        console.info(
          "[discovery-propose] type=%s timing_ms=%d candidates=0 (empty)",
          candidateType,
          Date.now() - t0
        );
      }
      return { candidates: [] };
    }

    const candidates: DiscoveryCandidate[] = [];
    const validationErrors: string[] = [];
    const storyIds = new Set(storyCandidates.map((c) => c.candidateId));

    for (const item of items) {
      const normalized = normalizeRawCandidate(item, candidateType, workId);
      if (normalized.ok) {
        if (candidateType === "scene") {
          const parentId = (normalized.candidate.fields as SceneCandidateFields)
            .parentStoryCandidateId;
          if (!storyIds.has(parentId)) {
            validationErrors.push(
              `parentStoryCandidateId "${parentId}" is not a proposed Story candidate`
            );
            continue;
          }
        }
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
      if (timingOn) {
        console.info(
          "[discovery-propose] type=%s timing_ms=%d llm_ms≈%d PARSE_FAILED",
          candidateType,
          Date.now() - t0,
          llmMs
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

    if (timingOn) {
      console.info(
        "[discovery-propose] type=%s timing_ms=%d llm_ms≈%d candidates=%d",
        candidateType,
        Date.now() - t0,
        llmMs,
        capped.length
      );
    }
    const withArchives =
      candidateType === "scene"
        ? capped.map((c) =>
            applyCharacterArchivesToSceneCandidate(c, characterCandidates)
          )
        : capped;
    return { candidates: withArchives };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    // parseCandidateArray throw — not provider envelope / network errors
    const isParseThrow =
      /not a JSON array of candidates|LLM output is not a JSON array/i.test(
        message
      );
    console.error(
      "[discovery-propose] type=%s %s: %s",
      candidateType,
      isParseThrow ? "PARSE_FAILED" : "GENERATION_FAILED",
      message
    );
    if (timingOn) {
      console.info(
        "[discovery-propose] type=%s timing_ms=%d %s",
        candidateType,
        Date.now() - t0,
        isParseThrow ? "PARSE_THROW" : "PROVIDER_OR_OTHER"
      );
    }
    return {
      candidates: [],
      error: {
        candidateType,
        code: isParseThrow ? "GENERATION_PARSE_FAILED" : "GENERATION_FAILED",
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
  /** Story candidates from an open review session (scene-only retry). */
  existingStoryCandidates?: DiscoveryCandidate[];
  feedback?: string | null;
}): Promise<{ candidates: DiscoveryCandidate[]; errors: ProposeTypeError[] }> {
  const types = params.candidateTypes ?? [...DISCOVERY_CANDIDATE_TYPES];
  const allCandidates: DiscoveryCandidate[] = [
    ...(params.existingStoryCandidates ?? []).filter(
      (c) => c.candidateType === "story"
    ),
  ];
  const seededStoryIds = new Set(allCandidates.map((c) => c.candidateId));
  const errors: ProposeTypeError[] = [];
  const newlyGenerated: DiscoveryCandidate[] = [];

  // Story-first order; Scene also sees Role (character) archives for SPEC-CHAR-001.
  for (const candidateType of types) {
    const storyCandidates = allCandidates.filter(
      (c) => c.candidateType === "story"
    );
    const characterCandidates = allCandidates.filter(
      (c) => c.candidateType === "character"
    );
    const result = await generateForType({
      workId: params.workId,
      workTitle: params.workTitle,
      narrative: params.narrative,
      candidateType,
      feedback: params.feedback,
      storyCandidates:
        candidateType === "scene" ? storyCandidates : undefined,
      characterCandidates:
        candidateType === "scene" ? characterCandidates : undefined,
    });
    allCandidates.push(...result.candidates);
    newlyGenerated.push(...result.candidates);
    if (result.error) {
      errors.push(result.error);
    }
  }

  // Do not re-emit seeded existing stories as propose output
  const outputCandidates = newlyGenerated.filter(
    (c) => !(c.candidateType === "story" && seededStoryIds.has(c.candidateId))
  );

  const withParentsVisible = [
    ...allCandidates.filter((c) => c.candidateType === "story"),
    ...outputCandidates.filter((c) => c.candidateType !== "story"),
  ];

  return {
    candidates: filterScenesWithValidParents(
      capCandidatesByType(dedupeCandidates(withParentsVisible))
    ).filter(
      (c) => !(c.candidateType === "story" && seededStoryIds.has(c.candidateId))
    ),
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
  /** Story candidates in session — required when regenerating scene. */
  storyCandidates?: DiscoveryCandidate[];
  /** Role (character) candidates — SPEC-CHAR-001 fold when regenerating scene. */
  characterCandidates?: DiscoveryCandidate[];
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

  const storyCandidates =
    params.storyCandidates ??
    (params.siblingCandidates ?? []).filter((c) => c.candidateType === "story");
  const characterCandidates =
    params.characterCandidates ??
    (params.siblingCandidates ?? []).filter(
      (c) => c.candidateType === "character"
    );

  const result = await generateForType({
    workId: params.workId,
    workTitle: params.workTitle,
    narrative: params.narrative,
    candidateType: params.candidateType,
    feedback: params.feedback,
    previousCandidate: params.previousCandidate,
    excludeCandidates: params.siblingCandidates,
    storyCandidates:
      params.candidateType === "scene" ? storyCandidates : undefined,
    characterCandidates:
      params.candidateType === "scene" ? characterCandidates : undefined,
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

  // Preserve parent link on scene regen when model omits / changes unexpectedly
  if (
    params.candidateType === "scene" &&
    "parentStoryCandidateId" in params.previousCandidate.fields
  ) {
    const prevParent = (
      params.previousCandidate.fields as SceneCandidateFields
    ).parentStoryCandidateId;
    const nextFields = candidate.fields as SceneCandidateFields;
    if (
      prevParent &&
      (!nextFields.parentStoryCandidateId ||
        !storyCandidates.some((s) => s.candidateId === nextFields.parentStoryCandidateId))
    ) {
      candidate.fields = {
        ...nextFields,
        parentStoryCandidateId: prevParent,
      };
    }
  }

  return { candidate };
}
