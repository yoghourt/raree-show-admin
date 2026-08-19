import { NARRATIVE_UNITS, REQUIRED_UNITS, unitById } from "./inventory";
import type { RieFixture } from "./fixtures";
import type { Coverage, InformationVerdict, TraceRow } from "./types";
import {
  invariantSet,
  runGranularityGate,
} from "../../lib/discovery/granularity-gate/gate";

export function readerVisibleNarrative(input: RieFixture["input"]): string {
  return input.frames.map((f) => f.caption).join("\n");
}

export function storyVisibleNarrative(input: RieFixture["input"]): string {
  return input.stories.map((s) => s.summary).join("\n");
}

export function tracesFor(fixture: RieFixture): TraceRow[] {
  return NARRATIVE_UNITS.map((unit) => {
    const cov = fixture.coverage[unit.id];
    if (!cov) {
      throw new Error(`${fixture.id} missing coverage for ${unit.id}`);
    }
    return {
      unitId: unit.id,
      kind: unit.kind,
      necessity: unit.necessity,
      source: unit.source,
      storySummary: cov.story,
      frameCaption: cov.caption,
      readerCanRecover: cov.caption,
    };
  });
}

export function requiredCaptionProblems(fixture: RieFixture): TraceRow[] {
  return tracesFor(fixture).filter(
    (row) =>
      row.necessity === "REQUIRED" &&
      (row.frameCaption === "LOST" || row.frameCaption === "PARTIAL")
  );
}

export function informationVerdict(fixture: RieFixture): InformationVerdict {
  return requiredCaptionProblems(fixture).length === 0 ? "PASS" : "FAIL";
}

export function storyOnlyRequired(fixture: RieFixture): TraceRow[] {
  return tracesFor(fixture).filter(
    (row) =>
      row.necessity === "REQUIRED" &&
      row.storySummary === "PRESENT" &&
      (row.frameCaption === "LOST" || row.frameCaption === "PARTIAL")
  );
}

/** Lexical probe only — never the verdict. */
export function naiveEntitiesAllPresent(
  text: string,
  unitId: string
): boolean {
  const unit = unitById(unitId);
  if (unit.naiveEntities.length === 0) return false;
  const hay = text.toLowerCase();
  return unit.naiveEntities.every((e) => hay.includes(e.toLowerCase()));
}

export function evaluateRie(fixture: RieFixture) {
  const gate = runGranularityGate(fixture.input);
  const info = informationVerdict(fixture);
  const rows = tracesFor(fixture);
  return {
    id: fixture.id,
    label: fixture.label,
    provenance: fixture.provenance ?? null,
    expectedGate: fixture.expectedGate,
    expectedInformation: fixture.expectedInformation,
    gateStatus: gate.status,
    gateErrorInvariants: [...invariantSet(gate)],
    information: info,
    ok:
      gate.status === fixture.expectedGate &&
      info === fixture.expectedInformation,
    requiredProblems: requiredCaptionProblems(fixture).map((r) => r.unitId),
    storyOnlyRequired: storyOnlyRequired(fixture).map((r) => r.unitId),
    readerNarrative: readerVisibleNarrative(fixture.input),
    storyNarrative: storyVisibleNarrative(fixture.input),
    rows,
    requiredUnitCount: REQUIRED_UNITS.length,
  };
}
