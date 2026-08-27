/**
 * Deterministic Granularity Gate (production validator).
 *
 * G1/G4: topology signals (counts, singleton ratio, shared names).
 * G2: per-Story frame vs estimated progression units.
 * G3: labeled turns vs Frame.caption lexical coverage —
 *     a coverage heuristic, not semantic understanding.
 * FAIL default action is RE-PROPOSE (operator re-runs Propose). No silent repair.
 */

import { analyzeGranularity, bundleByStory, estimateBeatsInCaption, uncoveredTurns } from "./analyze";
import { coverageRatio } from "./text";
import type {
  GranularityGateResult,
  GranularityInput,
  GranularityInvariant,
  GranularityViolation,
} from "./types";

const MIN_OUTLINE = 3;

function push(
  violations: GranularityViolation[],
  invariant: GranularityViolation["invariant"],
  severity: GranularityViolation["severity"],
  evidence: string[]
): void {
  violations.push({ invariant, severity, evidence });
}

function evaluateG1(input: GranularityInput, violations: GranularityViolation[]): void {
  const a = analyzeGranularity(input);
  const countSignal =
    a.headingCount >= MIN_OUTLINE &&
    a.storyCount >= MIN_OUTLINE &&
    a.headingStoryCountDelta <= 1;

  if (!countSignal) return;

  const singletonHeavy = a.singletonStoryRatio >= 0.8;
  const sharedArc = a.sharedProperNamesAcrossStories.length >= 2;

  const countEvidence = [
    `source heading count=${a.headingCount}`,
    `story count=${a.storyCount}`,
    `|heading-story|=${a.headingStoryCountDelta} (signal only; not a FAIL by itself)`,
    `headings: ${a.headings.map((h) => `${h.index}. ${h.title}`).join(" | ")}`,
    `stories: ${input.stories.map((s) => s.title).join(" | ")}`,
  ];

  if (singletonHeavy && sharedArc) {
    push(violations, "G1", "error", [
      "Source outline appears mirrored as Stories (1 heading ≈ 1 Story), each with a single Frame",
      ...countEvidence,
      `singleton stories=${a.singletonStoryCount}/${a.storyCount} (ratio ${a.singletonStoryRatio.toFixed(2)})`,
      `shared proper names across stories: ${a.sharedProperNamesAcrossStories.join(", ")}`,
      "Same-script title alignment is not required: source headings may be CJK while Story titles are English",
    ]);
    return;
  }

  push(violations, "G1", "warning", [
    "Heading count ≈ Story count (outline-mirror signal) without singleton+shared-name confirmation",
    ...countEvidence,
    `singleton ratio=${a.singletonStoryRatio.toFixed(2)}`,
    `shared proper names: ${a.sharedProperNamesAcrossStories.join(", ") || "(none)"}`,
  ]);
}

function evaluateG2(input: GranularityInput, violations: GranularityViolation[]): void {
  const bundles = bundleByStory(input);
  for (const b of bundles) {
    if (b.frames.length !== 1) continue;
    const estimated = analyzeGranularity({
      sourceText: input.sourceText,
      stories: [b.story],
      frames: b.frames,
    }).bundles[0]!.estimatedProgressionUnits;

    if (estimated >= 3) {
      push(violations, "G2", "error", [
        `Story "${b.story.title}" (${b.story.id}) has exactly 1 Frame but estimated progression units=${estimated}`,
        "1 Story × 1 Frame is legal when the Story needs one Reader step; multiple unmerged units are not",
        `Story.summary: ${b.story.summary}`,
        `Frame.caption: ${b.frames[0]!.caption}`,
      ]);
    } else if (estimated === 2) {
      push(violations, "G2", "warning", [
        `Story "${b.story.title}" has 1 Frame and estimated units=2 (may be mergeable; not an automatic error)`,
      ]);
    }
  }
}

function evaluateG3(input: GranularityInput, violations: GranularityViolation[]): void {
  const bundles = bundleByStory(input);
  const labeled = input.labels?.requiredTurns?.map((t) => t.trim()).filter(Boolean);

  if (labeled && labeled.length > 0) {
    const hay = input.frames.map((f) => f.caption).join(" ");
    const missing = labeled.filter((turn) => coverageRatio(turn, hay) < 0.45);
    if (missing.length > 0) {
      push(violations, "G3", "error", [
        "Labeled Reader-necessary turn(s) are not carried by any Frame.caption",
        "This is a Discovery Propose defect, not a Human Review backlog item",
        ...missing.map((t) => `uncovered: ${t}`),
        `captions: ${hay || "(empty)"}`,
      ]);
    }
  }

  for (const b of bundles) {
    if (b.frames.length === 0) {
      if (b.story.summary.trim()) {
        push(violations, "G3", "error", [
          `Story "${b.story.title}" has summary but zero Frames to carry Reader narrative`,
          `Story.summary: ${b.story.summary}`,
        ]);
      }
      continue;
    }

    const captionsEmpty = b.frames.every((f) => !f.caption.trim());
    if (captionsEmpty && b.story.summary.trim()) {
      push(violations, "G3", "error", [
        `Story "${b.story.title}" has summary but Frame.caption is empty`,
        `Story.summary: ${b.story.summary}`,
      ]);
      continue;
    }

    if (labeled && labeled.length > 0) continue;

    const missing = uncoveredTurns(b.story, b.frames);
    if (missing.length === 0) continue;
    push(violations, "G3", "warning", [
      `Story "${b.story.title}": lexical coverage heuristic — Story.summary clauses are weakly present in Frame.caption (not a semantic proof)`,
      ...missing.map((t) => `weak coverage: ${t}`),
      `captions: ${b.frames.map((f) => f.caption).join(" || ")}`,
    ]);
  }
}

function evaluateG4(input: GranularityInput, violations: GranularityViolation[]): void {
  const a = analyzeGranularity(input);
  const g1Error = violations.some((v) => v.invariant === "G1" && v.severity === "error");

  if (a.storyCount <= 1) return;

  const allSingleton = a.singletonStoryRatio >= 0.8 && a.storyCount >= MIN_OUTLINE;
  const sharedArc = a.sharedProperNamesAcrossStories.length >= 2;
  const outlineShaped = a.headingCount >= MIN_OUTLINE && a.headingStoryCountDelta <= 1;

  if (allSingleton && sharedArc && (g1Error || outlineShaped)) {
    push(violations, "G4", "error", [
      "Continuous source beats were cut into isolated single-Frame Stories (independent Route units)",
      `topology: ${a.storyCount} Stories × mostly 1 Frame (singleton ${a.singletonStoryCount}/${a.storyCount})`,
      "Reader cannot consume Frame 1 → Frame 2 → … inside one Story/Route",
      `shared names across Stories: ${a.sharedProperNamesAcrossStories.join(", ")}`,
      `source headings (${a.headingCount}): ${a.headings.map((h) => h.title).join(" → ")}`,
    ]);
  }
}

/** One Frame.caption / Scene.summary must be one still-worthy beat. */
function evaluateG5(input: GranularityInput, violations: GranularityViolation[]): void {
  for (const frame of input.frames) {
    const beats = estimateBeatsInCaption(frame.caption);
    if (beats >= 3) {
      push(violations, "G5", "error", [
        `Frame "${frame.title}" (${frame.id}) packs estimated ${beats} beats into one caption`,
        "One Scene / Frame Narrative must be a single Reader step — split into multiple Scenes",
        `Frame.caption: ${frame.caption}`,
      ]);
    } else if (beats === 2) {
      push(violations, "G5", "warning", [
        `Frame "${frame.title}" may contain 2 beats in one caption (consider Split Scene)`,
        `Frame.caption: ${frame.caption}`,
      ]);
    }
  }
}

export function runGranularityGate(input: GranularityInput): GranularityGateResult {
  const violations: GranularityViolation[] = [];
  const analysis = analyzeGranularity(input);
  evaluateG1(input, violations);
  evaluateG2(input, violations);
  evaluateG3(input, violations);
  evaluateG4(input, violations);
  evaluateG5(input, violations);
  const status = violations.some((v) => v.severity === "error") ? "FAIL" : "PASS";
  return { status, violations, analysis };
}

export function invariantSet(
  result: GranularityGateResult
): Set<GranularityInvariant> {
  return new Set(
    result.violations.filter((v) => v.severity === "error").map((v) => v.invariant)
  );
}
