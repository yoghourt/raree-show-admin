/**
 * Resolve per-Story claimedRequiredUnits from Work Canon + Story Bind.
 * No 1×N default inherit. Unknown / duplicate / unbound REQUIRED → incomplete.
 */

import {
  informationEquivalenceContextRequired,
  type ClaimedRequiredUnit,
} from "@/lib/discovery/information-equivalence";
import type { AcceptReviewError } from "@/lib/discovery/review-types";

import { authorityBindIncomplete } from "./accept-guard";
import type {
  AuthorityInspection,
  RequiredUnitAuthorityContext,
  StoryBind,
  WorkCanon,
} from "./types";

export function requiredCanonIds(canon: WorkCanon): string[] {
  return canon.units
    .filter((u) => u.necessity === "REQUIRED")
    .map((u) => u.unitId);
}

function bindsForBatch(
  binds: StoryBind[],
  batchStoryIds: string[]
): StoryBind[] {
  const allowed = new Set(batchStoryIds);
  return binds.filter((b) => allowed.has(b.storyCandidateId));
}

export function inspectAuthority(
  ctx: RequiredUnitAuthorityContext | undefined,
  batchStoryIds: string[]
): AuthorityInspection {
  if (!ctx || ctx.workCanon.units.length === 0) {
    return {
      status: "CONTEXT_REQUIRED",
      unboundRequiredIds: [],
      duplicateUnitIds: [],
      unknownUnitIds: [],
      errors: ["Work Canon is not provided."],
    };
  }

  const required = requiredCanonIds(ctx.workCanon);
  if (required.length === 0) {
    return {
      status: "CONTEXT_REQUIRED",
      unboundRequiredIds: [],
      duplicateUnitIds: [],
      unknownUnitIds: [],
      errors: ["Work Canon has no REQUIRED units."],
    };
  }

  const requiredSet = new Set(required);
  const scoped = bindsForBatch(ctx.storyBinds, batchStoryIds);
  const owners = new Map<string, string[]>();
  const unknownUnitIds: string[] = [];
  const errors: string[] = [];

  for (const bind of scoped) {
    if (bind.unitIds.length === 0) {
      errors.push(`Story ${bind.storyCandidateId} has an empty Story Bind.`);
    }
    for (const unitId of bind.unitIds) {
      if (!requiredSet.has(unitId)) {
        unknownUnitIds.push(unitId);
        errors.push(
          `${unitId} is not a Work Canon REQUIRED unit (cannot bind OPTIONAL/unknown).`
        );
        continue;
      }
      const prev = owners.get(unitId) ?? [];
      prev.push(bind.storyCandidateId);
      owners.set(unitId, prev);
    }
  }

  const duplicateUnitIds = [...owners.entries()]
    .filter(([, storyIds]) => storyIds.length > 1)
    .map(([unitId]) => unitId);
  for (const unitId of duplicateUnitIds) {
    errors.push(
      `${unitId} is bound to multiple Stories: ${owners.get(unitId)!.join(", ")}.`
    );
  }

  const unboundRequiredIds = required.filter((id) => !owners.has(id));
  for (const unitId of unboundRequiredIds) {
    errors.push(`${unitId} is not bound to any Story.`);
  }

  for (const storyId of batchStoryIds) {
    const bind = scoped.find((b) => b.storyCandidateId === storyId);
    if (!bind) {
      errors.push(`Story ${storyId} has no Story Bind.`);
    }
  }

  const incomplete =
    errors.length > 0 ||
    unboundRequiredIds.length > 0 ||
    duplicateUnitIds.length > 0 ||
    unknownUnitIds.length > 0;

  return {
    status: incomplete ? "INCOMPLETE" : "COMPLETE",
    unboundRequiredIds,
    duplicateUnitIds,
    unknownUnitIds: [...new Set(unknownUnitIds)],
    errors,
  };
}

export function resolveStoryClaimedUnits(
  ctx: RequiredUnitAuthorityContext | undefined,
  storyCandidateId: string,
  batchStoryIds: string[]
):
  | { ok: true; claimedRequiredUnits: ClaimedRequiredUnit[] }
  | AcceptReviewError {
  const inspection = inspectAuthority(ctx, batchStoryIds);
  if (inspection.status === "CONTEXT_REQUIRED") {
    return informationEquivalenceContextRequired();
  }
  if (inspection.status === "INCOMPLETE" || !ctx) {
    return authorityBindIncomplete(inspection.errors);
  }

  const bind = ctx.storyBinds.find(
    (b) => b.storyCandidateId === storyCandidateId
  );
  if (!bind) {
    return authorityBindIncomplete([
      `Story ${storyCandidateId} has no Story Bind.`,
    ]);
  }

  const claimedRequiredUnits: ClaimedRequiredUnit[] = [];
  for (const unitId of bind.unitIds) {
    const unit = ctx.workCanon.units.find((u) => u.unitId === unitId);
    if (!unit?.claim || unit.claim.unitId !== unitId) {
      return authorityBindIncomplete([
        `${unitId} is REQUIRED but has no IE claim contract.`,
      ]);
    }
    claimedRequiredUnits.push(unit.claim);
  }

  if (claimedRequiredUnits.length === 0) {
    return informationEquivalenceContextRequired();
  }

  return { ok: true, claimedRequiredUnits };
}

export function workCanonFromRequiredClaims(
  claims: ClaimedRequiredUnit[]
): WorkCanon {
  return {
    units: claims.map((claim) => ({
      unitId: claim.unitId,
      necessity: "REQUIRED" as const,
      claim,
    })),
  };
}

export function authorityForSingleStory(
  storyCandidateId: string,
  claims: ClaimedRequiredUnit[]
): RequiredUnitAuthorityContext {
  return {
    workCanon: workCanonFromRequiredClaims(claims),
    storyBinds: [
      {
        storyCandidateId,
        unitIds: claims.map((c) => c.unitId),
      },
    ],
  };
}
