/**
 * IMPLEMENT-RIE-001 runtime evidence
 *
 *   npx tsx scripts/information-equivalence/runtime-evidence.ts
 *
 * Exercises the production Accept choke point:
 *   Propose-shaped Candidate → Granularity → IE → prepareAcceptStoryWithChildScenes
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  INFORMATION_EQUIVALENCE_BLOCKED,
  RIE_001_CLAIMED_REQUIRED_UNITS,
  evaluateInformationEquivalence,
} from "../../lib/discovery/information-equivalence";
import { AUTHORITY_BIND_INCOMPLETE, authorityForSingleStory } from "../../lib/discovery/required-unit-authority";
import { runGranularityGate } from "../../lib/discovery/granularity-gate";
import type { DiscoveryCandidate } from "../../lib/discovery/propose-types";
import {
  createReviewItems,
  prepareAcceptStoryWithChildScenes,
} from "../../lib/discovery/review-state";
import type { NarrativeInputBundle } from "../../lib/discovery/types";
import { MINIMAL_RENDERER_EXPRESSION } from "../../lib/discovery/visual-contract";
import type { GranularityInput } from "../../lib/discovery/granularity-gate/types";
import { GRANULARITY_INPUTS } from "../rie-002-spike/fixtures";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(DIR, "results");

function narrativeFromSource(sourceText: string): NarrativeInputBundle {
  return {
    excerpts: [{ text: sourceText, orderIndex: 0 }],
    operatorSummary: null,
    inputMode: "excerpt_bundle",
  };
}

function candidatesFromInput(input: GranularityInput): DiscoveryCandidate[] {
  const workId = "work-runtime-evidence";
  const stories: DiscoveryCandidate[] = input.stories.map((story) => ({
    candidateId: story.id,
    candidateType: "story",
    workId,
    displayName: story.title,
    summary: story.summary,
    fields: { title: story.title, summary: story.summary },
  }));
  const scenes: DiscoveryCandidate[] = input.frames.map((frame, index) => ({
    candidateId: frame.id,
    candidateType: "scene",
    workId,
    displayName: frame.title,
    summary: frame.caption,
    fields: {
      parentStoryCandidateId: frame.parentStoryId,
      chapter_number: index + 1,
      title: frame.title,
      summary: frame.caption,
      rendererExpression: MINIMAL_RENDERER_EXPRESSION,
    },
  }));
  return [...stories, ...scenes];
}

function runPath(label: string, input: GranularityInput) {
  const gate = runGranularityGate(input);
  const ie = evaluateInformationEquivalence({
    frames: input.frames.map((f) => ({ id: f.id, caption: f.caption })),
    claimedRequiredUnits: RIE_001_CLAIMED_REQUIRED_UNITS,
  });
  const items = createReviewItems(candidatesFromInput(input));
  const story = items.find((item) => item.candidate.candidateType === "story");
  if (!story) throw new Error(`${label}: expected story`);
  const accept = prepareAcceptStoryWithChildScenes(
    items,
    story.reviewId,
    [],
    { characters: [], locations: [] },
    { narrative: narrativeFromSource(input.sourceText) },
    authorityForSingleStory(story.candidate.candidateId, RIE_001_CLAIMED_REQUIRED_UNITS)
  );
  return {
    label,
    path: "Propose-shaped Candidate → Granularity → IE → prepareAcceptStoryWithChildScenes",
    granularity: gate.status,
    ie: {
      status: ie.status,
      failedUnits: ie.units
        .filter((u) => u.status === "LOST" || u.status === "PARTIAL")
        .map((u) => ({
          unitId: u.unitId,
          status: u.status,
          reason: u.reason,
          supportingFrameIds: u.supportingFrameIds,
        })),
    },
    accept: accept.ok
      ? { ok: true as const, sceneCount: accept.sceneStagings.length }
      : { ok: false as const, code: accept.code, fieldErrors: accept.fieldErrors },
  };
}

async function main(): Promise<void> {
  const pass = runPath("B_KEEP", GRANULARITY_INPUTS.A_KEEP);
  const fail = runPath("B_LOSS", GRANULARITY_INPUTS.B_LOSS);
  const evidence = {
    generatedAt: new Date().toISOString(),
    chokePoint: "prepareAcceptStoryWithChildScenes (hooks/useDiscoverySession.acceptCandidate)",
    passCandidate: pass,
    failCandidate: fail,
    architectGate: {
      passCanAccept: pass.accept.ok === true,
      lossCannotAccept:
        fail.accept.ok === false &&
        fail.accept.code === INFORMATION_EQUIVALENCE_BLOCKED,
      granularityDidNotBlockLoss: fail.granularity === "PASS",
    },
  };
  await mkdir(RESULTS_DIR, { recursive: true });
  const out = path.join(RESULTS_DIR, "runtime-evidence.json");
  await writeFile(out, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  process.stdout.write(`${out}\n`);
  process.stdout.write(`${JSON.stringify(evidence.architectGate, null, 2)}\n`);
  if (
    !evidence.architectGate.passCanAccept ||
    !evidence.architectGate.lossCannotAccept ||
    !evidence.architectGate.granularityDidNotBlockLoss
  ) {
    process.exit(1);
  }
}

void main();
