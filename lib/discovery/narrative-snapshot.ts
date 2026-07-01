/**
 * SPEC-D3-003 OQ-D3-003-04 — normalized narrative snapshot for lock verification
 */

import type { NarrativeInputBundle } from "@/lib/discovery/types";

export function normalizeNarrativeBundle(
  bundle: NarrativeInputBundle
): string {
  const excerpts = [...bundle.excerpts]
    .map((excerpt) => ({
      text: excerpt.text.trim(),
      orderIndex: excerpt.orderIndex,
      ...(excerpt.sourceLabel?.trim()
        ? { sourceLabel: excerpt.sourceLabel.trim() }
        : {}),
    }))
    .sort((a, b) => a.orderIndex - b.orderIndex);

  return JSON.stringify({
    inputMode: bundle.inputMode,
    summaryAttested: bundle.summaryAttested ?? false,
    operatorSummary: (bundle.operatorSummary ?? "").trim(),
    excerpts,
  });
}
