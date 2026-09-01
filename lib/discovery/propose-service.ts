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
  expectedSceneCount,
  formatRequiredSceneStepsBlock,
  requiredSceneStepsFromStories,
  resolveParentStoryCandidateId,
  sceneCandidatesFromRequiredSteps,
} from "@/lib/discovery/frame-narrative-drafts";
import { narrativeSourceText } from "@/lib/discovery/granularity-gate/from-candidates";
import { MINIMAL_RENDERER_EXPRESSION } from "@/lib/discovery/visual-contract";
import {
  DISCOVERY_CANDIDATE_TYPES,
  type CharacterCandidateFields,
  type DiscoveryCandidate,
  type DiscoveryCandidateType,
  type ProposeTypeError,
  type SceneCandidateFields,
  type StoryCandidateFields,
} from "@/lib/discovery/propose-types";
import { SCENE_CONTEXT_CANDIDATE_PROPOSE_RULES } from "@/lib/discovery/scene-context-candidate-signals";
import type { NarrativeInputBundle } from "@/lib/discovery/types";
import { workVisualConventionPromptBlock } from "@/lib/prompts/work-visual-convention";

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
  character: `{"candidates":[{"displayName":"Name","summary":"Who they are in this story.","fields":{"name":"Name","house":"Faction if any","description":"Story role only, no look adjectives.","characterArchive":{"visualSummary":"standing look for THIS work","identityCues":["face cues from this work"],"costumeCues":["garments of this work's era"],"propCues":["iconic object if any"]}}}]}`,
  location: `{"candidates":[{"displayName":"Place","summary":"What this place is in the story.","fields":{"name":"Place","region":"Region if any"}}]}`,
  story: `{"candidates":[{"displayName":"Story title","summary":"Editorial story unit.","fields":{"title":"Story title","summary":"Prose summary of this arc."}}]}`,
  scene: `{"candidates":[{"displayName":"Beat title","summary":"One still-worthy turn from this story.","fields":{"parentStoryCandidateId":"<story-candidate-id>","chapter_number":1,"chapter_title":"Chapter title if any","title":"Beat title","summary":"The Reader-step draft for this one turn.","visualIntent":{"characters":[{"role":"role","name":"Name from this caption"}],"relationship":"as this beat states","purpose":"this turn","emotion":"this beat"},"rendererExpression":${JSON.stringify(EXPRESSION_CAPABILITY_EXAMPLE)}}}]}`,
};

const SCENE_NARRATIVE_ONLY_EXAMPLE = `{"candidates":[{"displayName":"First required turn","summary":"The first still-worthy beat of this story.","fields":{"parentStoryCandidateId":"<story-candidate-id>","chapter_number":1,"title":"First required turn","summary":"The first still-worthy beat of this story."}},{"displayName":"Second required turn","summary":"The next required turn, not merged into the first.","fields":{"parentStoryCandidateId":"<story-candidate-id>","chapter_number":1,"title":"Second required turn","summary":"The next required turn, not merged into the first."}}]}`;

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
      return `- ${fields.name}: identityCues=${JSON.stringify(archive.identityCues ?? [])}; costumeCues=${JSON.stringify(archive.costumeCues)}; propCues=${JSON.stringify(archive.propCues)}`;
    });
  if (lines.length === 0) {
    return "(none — author Expression visuals without Role archive fold)";
  }
  return lines.join("\n");
}

export function buildProposePrompt(params: {
  workTitle: string;
  visualConvention?: string;
  narrative: NarrativeInputBundle;
  candidateType: DiscoveryCandidateType;
  feedback?: string | null;
  previousCandidate?: DiscoveryCandidate;
  excludeCandidates?: DiscoveryCandidate[];
  storyCandidates?: DiscoveryCandidate[];
  /** Role candidates (character) for SPEC-CHAR-001 scene Expression fold. */
  characterCandidates?: DiscoveryCandidate[];
  /**
   * Legacy escape hatch: Frame Narrative only (stub Expression after parse).
   * Production default false — same LLM call authors rendererExpression (WS1).
   */
  sceneNarrativeOnly?: boolean;
  requiredSceneSteps?: ReturnType<typeof requiredSceneStepsFromStories>;
}): string {
  const {
    workTitle,
    visualConvention,
    narrative,
    candidateType,
    feedback,
    previousCandidate,
    excludeCandidates,
    storyCandidates = [],
    characterCandidates = [],
    sceneNarrativeOnly = false,
    requiredSceneSteps = [],
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
Do NOT use Reading-route framing. Do NOT invent parentStoryCandidateId values.
parentStoryCandidateId is hierarchy only — it does NOT mean the Story owns Work-batch cast/place.

${SCENE_CONTEXT_CANDIDATE_PROPOSE_RULES}
\n`
      : "";

  const conventionBlock = workVisualConventionPromptBlock(visualConvention);
  const conventionLead = conventionBlock ? `\n${conventionBlock}\n` : "";

  return `You are a Discovery Copilot generating editorial Candidates for a narrative work.
Work title: ${workTitle}${conventionLead}
Candidate type: ${candidateType}
Hard cap (never exceed): ${MAX_CANDIDATES_PER_TYPE} per type

Locked narrative bundle (JSON):
${JSON.stringify(narrative, null, 2)}
${regenBlock}${excludeBlock}${storyParentBlock}
Generation rules (critical):
- OUTPUT LANGUAGE (mandatory): Every string in your JSON response MUST be English (Latin script only).
  This includes displayName, summary, all fields values, evidence sourceLabel/excerpt, chapter_title, title, name, etc.
  The narrative input MAY be Chinese or another language — you MUST still emit English canonical names
  for this work (established English spellings when the work has them; otherwise standard transliteration — not CJK in name fields).
  Do NOT return Chinese, Japanese, Korean, or other CJK/non-Latin text in candidate output.
  Use established English spellings from the work when known; otherwise use standard English transliteration.
- Include ONLY ${candidateType} entities explicitly supported by the narrative prose above.
- Do NOT invent background cast, generic extras, or inferred entities not grounded in the text.
- Do NOT pad the list to reach the cap.
- For a single chapter excerpt, typical counts are: character 2-5, location 1-3.
- Stories: one Story per continuous reading arc (Mental Model Transition), NOT one Story per outline heading. A chapter excerpt is often 1 Story, sometimes 2. Do not slice one arc into many singleton Stories.
- Scenes: one Scene per Reader step under that Story. If the arc has multiple required turns (outcome, attempt, prevention, cause), emit multiple Scenes with the SAME parentStoryCandidateId. Use as many Scenes as the prose supports, up to the hard cap. Do NOT compress a multi-turn Story into 1–4 stills. One Scene.summary = ONE still-worthy beat — NEVER chain corruption→uprising→defeat→recruitment into a single summary.
- If the narrative supports zero distinct ${candidateType} units, return {"candidates":[]}.

Return ONLY valid JSON — a single object {"candidates":[...]}. No markdown fences, no commentary.
Each item MUST have: displayName (string), summary (string), fields (object with required keys for this type).
Allowed field names in "fields": ${hints}
Optional per item: confidence ("green"|"yellow"|"red"), evidence ([{sourceLabel, excerpt?}]).

Example shape for type "${candidateType}":
${sceneNarrativeOnly ? SCENE_NARRATIVE_ONLY_EXAMPLE : TYPE_EXAMPLES[candidateType]}
${candidateType === "scene" && sceneNarrativeOnly ? `\nScene Frame Narrative drafts only (no Expression in this call).
fields MUST include parentStoryCandidateId (from the Story list), chapter_number INTEGER ≥ 0 (0 = prologue / front matter), title, and summary.
Do NOT include rendererExpression or visualIntent.
${formatRequiredSceneStepsBlock(requiredSceneSteps)}
- One Scene per required step. Same parentStoryCandidateId. Do not merge two steps.
- fields.summary IS the Reading Frame Narrative DRAFT Human confirms into caption.
- The draft MUST carry that step's turn (event, outcome, attempt, prevention, cause) — not still geometry.
- Prefer proper names from the narrative. English Latin script only.
\n` : ""}
${candidateType === "scene" && !sceneNarrativeOnly ? `\nScene fields MUST live under "fields" with parentStoryCandidateId (required, from the Story list above), chapter_number as an INTEGER ≥ 0 (sortable chapter index; 0 = prologue / front matter, then 1, 2, 3 — NOT POV labels). Put POV labels like "Bran I" or "Prologue" in chapter_title. title is required. fields.summary is REQUIRED.
${formatRequiredSceneStepsBlock(requiredSceneSteps)}
Frame Narrative draft (CRITICAL — this is what Human confirms into Reader text):
- fields.summary (and matching top-level summary) IS the Reading Frame Narrative DRAFT for this step.
  After Human Confirm it is written to story_images_v2[].caption. Empty summary is not a valid Scene candidate.
- One Scene = one Reader step = ONE still-worthy beat. Split the parent Story into as many Scenes as required turns. Same parentStoryCandidateId.
- FORBIDDEN: packing a multi-event causal chain into one summary. Each required turn is its own Scene.
- The draft MUST let a Reader recover this step's turn: event, outcome, attempted action, prevented action, causal turn, relationship change — when that is the beat.
- Prefer proper names from the narrative when the text supports them.
- FORBIDDEN in fields.summary: still-only geometry that drops the turn (e.g. "confront on horseback" when the Source beat is that they slay the commanders; pose/lighting-only prose).
- Do NOT shorten, role-genericize, or minimize this prose for image-model constraints.
- Expression authorship rules below apply ONLY to fields.rendererExpression — NEVER to title/summary.

Visualization (ADR-011 A5 / SPEC-DVE-001 v1.4 — required; same LLM call as summary):
- fields.rendererExpression is REQUIRED Canonical Visual Expression — MUST be authored in this response (not deferred, not stub placeholders like "empty scene" / "unspecified place").
  { environment, characters (array, MAY be []), action, composition,
    lighting?, atmosphere?, threatPerception?, visualEmphasis?, styleHints? }.
- Expression MUST depict the SAME instant as fields.summary (not a different beat from the same arc).
- Prefer recognizable identity color / props in character.visual when THIS narrative names them. FORBIDDEN: vague "tense crowd / brink of ruin" with no identity cue.
- Author for the best renderer: include optional lighting/atmosphere/threatPerception/visualEmphasis when Intent supports them.
- characters MAY be [] for landscape/atmosphere scenes; when non-empty each item needs role + visual (identity + prop/costume).
- fields.visualIntent is OPTIONAL by scene: { characters?, relationship?, emotion?, purpose? }. Presence optional; quality when present.
- When Expression cast is non-empty, strongly prefer visualIntent.characters with role + narrative name
  (Context appearance candidate cues). Empty-cast landscape scenes may omit Intent characters.
- visualIntent is narrative meaning only — NO camera/composition/prompt tokens in Intent.
- Narrow-fold Intent cues into Expression optional fields in the SAME propose output (no second AI call).
- styleHints: stable style family only; FORBIDDEN: masterpiece, 8k, best quality, ultra detailed.
- Do NOT treat Work character/location candidates as Story membership lists.

${EXPRESSION_CAPABILITY_RULES}

${CHARACTER_ARCHIVE_SCENE_FOLD_RULES}

Role Character Archives available for cue selection:
${formatRoleArchiveListForPrompt(characterCandidates)}
\n` : ""}
${candidateType === "character" ? `\n${CHARACTER_ARCHIVE_PROPOSE_RULES}\n` : ""}
${candidateType === "location" ? '\nLocation fields MUST use fields.name (place name). Do NOT return prose paragraphs as the only value.\n' : ""}
${candidateType === "story" ? '\nStory fields MUST use fields.title and fields.summary (editorial story unit — NOT Reader Frame text). Optional boundaryHint. One Story = one continuous reading arc; child Scenes carry the ordered Frame Narrative drafts. Return {"candidates":[...]} — each item needs displayName, summary, and fields with title + summary.\n' : ""}

Do NOT include asset fields (portraitUrl, map coordinates, story_images_v2, tags, locationId, characterIds).
Candidates are proposals only — not canonical entities.`;
}

function prepareSceneRawItem(
  item: unknown,
  storyCandidates: DiscoveryCandidate[]
): unknown {
  if (!item || typeof item !== "object") return item;
  const obj = item as Record<string, unknown>;
  const fieldsRaw =
    obj.fields && typeof obj.fields === "object" && !Array.isArray(obj.fields)
      ? { ...(obj.fields as Record<string, unknown>) }
      : {};
  const title = String(fieldsRaw.title ?? obj.displayName ?? "");
  const summary = String(fieldsRaw.summary ?? obj.summary ?? "");
  const parent = resolveParentStoryCandidateId(
    typeof fieldsRaw.parentStoryCandidateId === "string"
      ? fieldsRaw.parentStoryCandidateId
      : undefined,
    storyCandidates,
    title,
    summary
  );
  if (parent) fieldsRaw.parentStoryCandidateId = parent;
  if (!fieldsRaw.rendererExpression) {
    fieldsRaw.rendererExpression = { ...MINIMAL_RENDERER_EXPRESSION };
  }
  return { ...obj, fields: fieldsRaw };
}

async function generateForType(params: {
  workId: string;
  workTitle: string;
  visualConvention?: string;
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

  const sourceText = narrativeSourceText(narrative);
  const requiredSceneSteps =
    candidateType === "scene"
      ? requiredSceneStepsFromStories(storyCandidates, sourceText)
      : [];

  const finishScenes = (rows: DiscoveryCandidate[]) => ({
    candidates: rows.map((c) =>
      applyCharacterArchivesToSceneCandidate(c, characterCandidates)
    ),
  });

  // Do not short-circuit Scene propose from Source headings: that path only
  // stamped stub Expression. WS1 requires same-call LLM rendererExpression;
  // heading drafts remain a count-fill fallback after LLM (fillFromRequiredSteps).

  const ingestItems = (
    items: unknown[]
  ): { capped: DiscoveryCandidate[]; validationErrors: string[] } => {
    const candidates: DiscoveryCandidate[] = [];
    const validationErrors: string[] = [];
    const storyIds = new Set(storyCandidates.map((c) => c.candidateId));
    for (const item of items) {
      const prepared =
        candidateType === "scene"
          ? prepareSceneRawItem(item, storyCandidates)
          : item;
      const normalized = normalizeRawCandidate(prepared, candidateType, workId);
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
    return {
      capped: capCandidatesByType(dedupeCandidates(candidates)),
      validationErrors,
    };
  };

  const fillFromRequiredSteps = (): DiscoveryCandidate[] => {
    if (
      candidateType !== "scene" ||
      expectedSceneCount(requiredSceneSteps) < 2
    ) {
      return [];
    }
    return capCandidatesByType(
      dedupeCandidates(
        sceneCandidatesFromRequiredSteps({
          workId,
          bundles: requiredSceneSteps,
          sourceText,
        })
      )
    );
  };

  try {
    const prompt = buildProposePrompt({
      ...params,
      ...(candidateType === "scene" ? { requiredSceneSteps } : {}),
    });
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
      const filled = fillFromRequiredSteps();
      if (filled.length >= 2) {
        return finishScenes(filled);
      }
      if (timingOn) {
        console.info(
          "[discovery-propose] type=%s timing_ms=%d candidates=0 (empty)",
          candidateType,
          Date.now() - t0
        );
      }
      return { candidates: [] };
    }

    let { capped, validationErrors } = ingestItems(items);
    const expectedScenes = expectedSceneCount(requiredSceneSteps);
    if (
      candidateType === "scene" &&
      expectedScenes >= 2 &&
      capped.length < expectedScenes
    ) {
      const missing = requiredSceneSteps
        .flatMap((b) => b.steps)
        .slice(capped.length);
      const retryPrompt = buildProposePrompt({
        ...params,
        requiredSceneSteps,
        feedback: `You MUST output ${expectedScenes} Scene objects (one per listed step), each with fields.summary AND fields.rendererExpression for that same instant. Previous output had ${capped.length}. Remaining steps each need their own Scene:\n${missing.map((s) => `- ${s}`).join("\n")}`,
      });
      try {
        const retryRaw = await callDiscoveryTextLlm(retryPrompt, {
          geminiJsonObject: true,
        });
        const retryItems = parseCandidateArray(retryRaw, "scene");
        const retryIngested = ingestItems(retryItems);
        if (retryIngested.capped.length > capped.length) {
          capped = retryIngested.capped;
          validationErrors = retryIngested.validationErrors;
        }
      } catch {
        /* keep first parse */
      }
    }

    if (
      candidateType === "scene" &&
      expectedScenes >= 2 &&
      capped.length < expectedScenes
    ) {
      const filled = fillFromRequiredSteps();
      if (filled.length > capped.length) {
        capped = filled;
      }
    }

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
    return candidateType === "scene"
      ? finishScenes(capped)
      : { candidates: capped };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    // parseCandidateArray throw — not provider envelope / network errors
    const isParseThrow =
      /not a JSON array of candidates|LLM output is not a JSON array/i.test(
        message
      );
    const filled = fillFromRequiredSteps();
    if (isParseThrow && filled.length >= 2) {
      console.warn(
        "[discovery-propose] type=%s PARSE_FAILED recovered via required steps count=%d: %s",
        candidateType,
        filled.length,
        message
      );
      return finishScenes(filled);
    }
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
  visualConvention?: string;
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
      visualConvention: params.visualConvention,
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
  visualConvention?: string;
  narrative: NarrativeInputBundle;
}): Promise<{ candidates: DiscoveryCandidate[]; errors: ProposeTypeError[] }> {
  return proposeCandidateTypes(params);
}

export async function regenCandidate(params: {
  workId: string;
  workTitle: string;
  visualConvention?: string;
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
    visualConvention: params.visualConvention,
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
