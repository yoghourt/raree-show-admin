/**
 * SPEC-D3-002 §4.4.5 — ephemeral Accept prefill transport (sessionStorage)
 *
 * Keyed by reviewId so multiple Accepted entity Candidates can coexist.
 */

import type { DiscoveryAcceptPrefill } from "@/lib/discovery/review-types";

const PREFIX = "discovery_accept_prefill:";

function storageKey(reviewId: string): string {
  return `${PREFIX}${reviewId}`;
}

export function storeDiscoveryAcceptPrefill(
  prefill: DiscoveryAcceptPrefill
): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.setItem(storageKey(prefill.reviewId), JSON.stringify(prefill));
}

export function loadDiscoveryAcceptPrefill(
  reviewId: string
): DiscoveryAcceptPrefill | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  const raw = sessionStorage.getItem(storageKey(reviewId));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as DiscoveryAcceptPrefill;
    if (
      parsed?.source !== "discovery_review" ||
      parsed.reviewId !== reviewId ||
      (parsed.candidateType !== "character" &&
        parsed.candidateType !== "location")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** @deprecated Prefer loadDiscoveryAcceptPrefill — prefill is retained for re-open */
export function consumeDiscoveryAcceptPrefill(
  reviewId: string
): DiscoveryAcceptPrefill | null {
  const prefill = loadDiscoveryAcceptPrefill(reviewId);
  if (prefill && typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(storageKey(reviewId));
  }
  return prefill;
}

export function buildEntityCreateHandoffPath(
  workId: string,
  reviewId: string,
  candidateType: "character" | "location"
): string {
  const base =
    candidateType === "character"
      ? `/works/${encodeURIComponent(workId)}/characters/new`
      : `/works/${encodeURIComponent(workId)}/locations/new`;
  return `${base}?discoveryReviewId=${encodeURIComponent(reviewId)}`;
}
