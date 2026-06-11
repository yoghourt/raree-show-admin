"use client";

/**
 * ConfidenceBadge — Visual confidence indicator for SuggestionItem
 *
 * SPEC-D2-002 §8.4 / AC-07 / AC-21
 *
 * Invariants:
 *   - Both a color difference AND a text label are required (AC-21).
 *     Color alone is NOT sufficient (accessibility requirement).
 *   - Each SuggestionItem MUST display its badge inline, visible without
 *     any hover or expansion action (AC-07).
 *   - "green" → bg-green-100 text-green-700 + label "Verified"
 *   - "yellow" → bg-yellow-100 text-yellow-700 + label "Review"
 */

import type { Confidence } from "@/lib/ai/copilot-types";

interface ConfidenceBadgeProps {
  confidence: Confidence;
  className?: string;
}

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  if (confidence === "green") {
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 ${className ?? ""}`}
        role="status"
        aria-label="已核实 — 高置信度"
      >
        <GreenDot />
        已核实
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 ${className ?? ""}`}
      role="status"
      aria-label="待核实 — 接受前请人工确认"
    >
      <YellowDot />
      待核实
    </span>
  );
}

function GreenDot() {
  return (
    <span className="mr-1 h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
  );
}

function YellowDot() {
  return (
    <span className="mr-1 h-1.5 w-1.5 rounded-full bg-yellow-500" aria-hidden="true" />
  );
}
