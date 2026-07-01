/**
 * SPEC-D3-001 §4.1 — session factory and state helpers
 */

import type {
  DiscoverySession,
  NarrativeInputBundle,
  NarrativeInputMode,
} from "@/lib/discovery/types";

export function createDefaultNarrativeBundle(
  inputMode: NarrativeInputMode = "excerpt_bundle"
): NarrativeInputBundle {
  return {
    excerpts:
      inputMode === "excerpt_bundle"
        ? [{ text: "", orderIndex: 0 }]
        : [],
    operatorSummary: null,
    inputMode,
    summaryAttested: false,
  };
}

/** Reset bundle when operator changes input mode — avoids cross-mode prose carryover */
export function switchNarrativeInputMode(
  current: NarrativeInputBundle,
  mode: NarrativeInputMode
): NarrativeInputBundle {
  if (current.inputMode === mode) {
    return current;
  }
  return createDefaultNarrativeBundle(mode);
}

export function createDiscoverySession(
  workId: string,
  operatorId: string,
  sessionId: string
): DiscoverySession {
  return {
    sessionId,
    workId,
    operatorId,
    state: "draft",
    narrative: createDefaultNarrativeBundle(),
    lockedAt: null,
    createdAt: new Date().toISOString(),
  };
}

export function isNarrativeEditable(session: DiscoverySession): boolean {
  return session.state === "draft";
}

export function canStartPropose(session: DiscoverySession): boolean {
  return (
    session.state === "narrative_locked" || session.state === "review_pending"
  );
}
