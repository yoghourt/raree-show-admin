/**
 * Four authority schemes. Spike-only. Does not write production claims.
 *
 * A Human: operator-supplied binds (no canon completeness check).
 * B Work canon: all REQUIRED ids on every Story (no ownership bind).
 * C Propose: ids Propose emitted for that Story.
 * D Hybrid: Work canon REQUIRED set + Story-level human bind;
 *    bind completeness = every REQUIRED id owned by exactly one Story.
 */

import type {
  AuthorityId,
  BindStatus,
  CompletenessFinding,
  StoryClaimResolution,
} from "./types";
import { requiredIds } from "./canon";

export type AuthorityInput = {
  storyId: string;
  /** All stories in the batch — needed for D bind completeness. */
  batchStoryIds: string[];
  humanBinds?: Record<string, string[]>;
  proposeClaims?: Record<string, string[]>;
};

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

function bindStatusForHuman(
  claimed: string[],
  batchStoryIds: string[],
  humanBinds: Record<string, string[]> | undefined
): BindStatus {
  if (claimed.length === 0) return "EMPTY";
  const owned = unique(
    batchStoryIds.flatMap((id) => humanBinds?.[id] ?? [])
  );
  const missing = requiredIds().filter((id) => !owned.includes(id));
  return missing.length > 0 ? "INCOMPLETE" : "COMPLETE";
}

export function resolveStoryClaims(
  authority: AuthorityId,
  input: AuthorityInput
): StoryClaimResolution {
  const required = requiredIds();

  if (authority === "A_HUMAN") {
    const claimed = unique(input.humanBinds?.[input.storyId] ?? []);
    return {
      authority,
      storyId: input.storyId,
      claimedUnitIds: claimed,
      bindStatus: claimed.length === 0 ? "EMPTY" : "COMPLETE",
      origin: "operator annotation for this Story only — no canon audit",
    };
  }

  if (authority === "B_WORK_CANON") {
    return {
      authority,
      storyId: input.storyId,
      claimedUnitIds: required,
      bindStatus: "COMPLETE",
      origin: "Work canon REQUIRED set copied onto every Story",
    };
  }

  if (authority === "C_PROPOSE") {
    const claimed = unique(input.proposeClaims?.[input.storyId] ?? []);
    return {
      authority,
      storyId: input.storyId,
      claimedUnitIds: claimed,
      bindStatus: claimed.length === 0 ? "EMPTY" : "COMPLETE",
      origin: "Propose output claimedUnitIds for this Story",
    };
  }

  const claimed = unique(input.humanBinds?.[input.storyId] ?? []);
  return {
    authority,
    storyId: input.storyId,
    claimedUnitIds: claimed,
    bindStatus: bindStatusForHuman(
      claimed,
      input.batchStoryIds,
      input.humanBinds
    ),
    origin: "Work canon REQUIRED inventory + Story-level human bind",
  };
}

export function assessAuthority(
  authority: AuthorityId,
  resolution: StoryClaimResolution,
  opts: {
    sourceRequiresCompound: boolean;
    ieStatus: "PASS" | "FAIL";
    storyOwnsOnlySubset: boolean;
  }
): CompletenessFinding {
  const hasCompound = resolution.claimedUnitIds.includes(
    "U-ATTEMPT-PREVENTED"
  );

  if (authority === "B_WORK_CANON" && opts.storyOwnsOnlySubset) {
    return "OWNERSHIP_OVERBLOCK";
  }

  if (authority === "D_HYBRID" && resolution.bindStatus === "INCOMPLETE") {
    return "BIND_INCOMPLETE";
  }

  if (
    opts.sourceRequiresCompound &&
    !hasCompound &&
    opts.ieStatus === "PASS"
  ) {
    return "AUTHORITY_COMPLETENESS_FAILURE";
  }

  return "OK";
}
