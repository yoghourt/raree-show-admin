"use client";

/**
 * CopilotIcon — Enrichment Copilot trigger button
 *
 * SPEC-D2-002 §4.3, §12 / RT-INV-13
 *
 * States:
 *   "disabled" — scope field empty, dup check in-progress, or conflict detected
 *   "enabled"  — scope field non-empty AND duplicate check passed (AC-23)
 *   "loading"  — suggestion request in flight
 *
 * RT-INV-13: operator click on this icon is the SOLE suggestion trigger.
 * OQ-05: no loading indicator is shown while dup check is in progress — the
 * icon simply remains disabled.
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
import type { CopilotIconState } from "@/lib/ai/copilot-types";
import { messages } from "@/lib/locale";

interface CopilotIconProps {
  state: CopilotIconState;
  onClick: () => void;
  className?: string;
}

export function CopilotIcon({ state, onClick, className }: CopilotIconProps) {
  const isDisabled = state === "disabled" || state === "loading";

  const label =
    state === "loading"
      ? messages.copilot.loadingSuggest
      : state === "enabled"
        ? messages.copilot.enabledLabel
        : messages.copilot.disabledLabel;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isDisabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`gap-1.5 text-xs ${className ?? ""}`}
    >
      {state === "loading" ? (
        <LoadingSpinner />
      ) : (
        <SparkleIcon disabled={isDisabled} />
      )}
      <span>{messages.copilot.brand}</span>
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Internal icons
// ---------------------------------------------------------------------------

function SparkleIcon({ disabled }: { disabled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-3.5 w-3.5 ${disabled ? "opacity-40" : "text-violet-500"}`}
      aria-hidden="true"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 animate-spin"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
