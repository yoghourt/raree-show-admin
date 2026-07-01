/**
 * SPEC-D3-001 §4.3 — Narrative Gate validation
 */

import {
  APPROVED_SUMMARY_MIN_PROSE,
  EXCERPT_BUNDLE_MIN_PROSE,
  type NarrativeGateRuleId,
} from "@/lib/discovery/constants";
import type {
  NarrativeGateFlags,
  NarrativeInputBundle,
} from "@/lib/discovery/types";

const SENTENCE_TERMINATORS = /[.!?。！？]/;

export interface NarrativeGateFailure {
  ruleId: NarrativeGateRuleId;
  message: string;
}

export interface NarrativeGateResult {
  pass: boolean;
  failures: NarrativeGateFailure[];
  totalProse: number;
}

export type NarrativeGateInput = NarrativeInputBundle & NarrativeGateFlags;

export function computeTotalProse(bundle: NarrativeInputBundle): number {
  const excerptTotal = bundle.excerpts.reduce(
    (sum, excerpt) => sum + excerpt.text.trim().length,
    0
  );
  const summaryLen = (bundle.operatorSummary ?? "").trim().length;
  return excerptTotal + summaryLen;
}

export function hasSentenceTerminator(text: string): boolean {
  return SENTENCE_TERMINATORS.test(text);
}

/** §4.3.1 keyword-list heuristic — true means the excerpt should FAIL NG-05 */
export function isKeywordListExcerpt(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  if (hasSentenceTerminator(trimmed)) {
    return false;
  }

  if (isCommaSeparatedTokensOnly(trimmed)) {
    return true;
  }

  const tokens = trimmed.split(/[\s,]+/).filter(Boolean);
  return trimmed.length < 40 && tokens.length <= 5;
}

function isCommaSeparatedTokensOnly(text: string): boolean {
  if (!text.includes(",")) {
    return false;
  }

  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return false;
  }

  return parts.every((part) => part.length > 0 && !hasSentenceTerminator(part));
}

export function validateNarrativeGate(
  input: NarrativeGateInput
): NarrativeGateResult {
  const failures: NarrativeGateFailure[] = [];
  const totalProse = computeTotalProse(input);
  const summary = (input.operatorSummary ?? "").trim();
  const nonEmptyExcerpts = input.excerpts.filter((e) => e.text.trim().length > 0);

  if (nonEmptyExcerpts.length === 0 && !summary) {
    failures.push({
      ruleId: "NG-01",
      message: "Narrative input requires excerpts and/or operator summary",
    });
  }

  if (input.inputMode === "excerpt_bundle") {
    if (totalProse < EXCERPT_BUNDLE_MIN_PROSE) {
      failures.push({
        ruleId: "NG-02",
        message: `excerpt_bundle requires at least ${EXCERPT_BUNDLE_MIN_PROSE} characters of prose`,
      });
    }

    if (nonEmptyExcerpts.length === 0 && summary) {
      failures.push({
        ruleId: "NG-07",
        message:
          "excerpt_bundle mode requires at least one excerpt when summary is present",
      });
    }
  }

  if (input.inputMode === "approved_summary") {
    if (input.summaryAttested !== true) {
      failures.push({
        ruleId: "NG-03",
        message: "approved_summary requires summaryAttested === true",
      });
    }

    if (totalProse < APPROVED_SUMMARY_MIN_PROSE) {
      failures.push({
        ruleId: "NG-04",
        message: `approved_summary requires at least ${APPROVED_SUMMARY_MIN_PROSE} characters of prose`,
      });
    }
  }

  for (const excerpt of nonEmptyExcerpts) {
    if (isKeywordListExcerpt(excerpt.text)) {
      failures.push({
        ruleId: "NG-05",
        message: `Excerpt at orderIndex ${excerpt.orderIndex} matches keyword-list heuristic`,
      });
      break;
    }
  }

  if (
    !failures.some((f) => f.ruleId === "NG-05") &&
    summary &&
    isKeywordListExcerpt(summary)
  ) {
    failures.push({
      ruleId: "NG-05",
      message: "operatorSummary matches keyword-list heuristic",
    });
  }

  if (input.catalogOnly === true || input.runtimeExportOnly === true) {
    failures.push({
      ruleId: "NG-06",
      message: "Input is catalog-only or runtime-export-only without added prose",
    });
  }

  return {
    pass: failures.length === 0,
    failures,
    totalProse,
  };
}
