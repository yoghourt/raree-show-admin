import type { AcceptReviewError } from "@/lib/discovery/review-types";

export const AUTHORITY_BIND_INCOMPLETE = "AUTHORITY_BIND_INCOMPLETE";

export function authorityBindIncomplete(errors: string[]): AcceptReviewError {
  return {
    ok: false,
    code: AUTHORITY_BIND_INCOMPLETE,
    message:
      "Work Canon Story Bind is incomplete. Story/Frame Accept cannot proceed.",
    fieldErrors: errors,
  };
}
