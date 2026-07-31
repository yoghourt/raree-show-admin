/**
 * SPEC-ROL-001 §4 — Rollout request validation (zod)
 */

import { z } from "zod";

const stagingWorkId = z.string().min(1);

export const acceptedStoryUnitStagingSchema = z.object({
  workId: stagingWorkId,
  sourceReviewId: z.string().min(1),
  sourceCandidateId: z.string().min(1).optional(),
  title: z.string().trim().min(1),
  summary: z.string(),
  boundaryHint: z.string().optional(),
  acceptedAt: z.string().min(1),
  chapter_number: z.number().int().min(1).optional(),
  chapter_title: z.string().nullable().optional(),
  relatedCharacterRefs: z
    .array(
      z.object({
        sourceReviewId: z.string().min(1),
        name: z.string().min(1),
        matchedTsid: z.string().optional(),
        house: z.string().optional(),
        description: z.string().optional(),
        signatureQuote: z.string().nullable().optional(),
      })
    )
    .optional(),
  relatedLocationRefs: z
    .array(
      z.object({
        sourceReviewId: z.string().min(1),
        name: z.string().min(1),
        matchedTsid: z.string().optional(),
        region: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .optional(),
  characterIds: z.array(z.string()).optional(),
  locationId: z.string().nullable().optional(),
});

const rendererExpressionCharacterSchema = z.object({
  role: z.string().trim().min(1),
  visual: z.string().trim().min(1),
});

const rendererExpressionSchema = z.object({
  environment: z.string().trim().min(1),
  characters: z.array(rendererExpressionCharacterSchema),
  action: z.string().trim().min(1),
  composition: z.string().trim().min(1),
  lighting: z.string().trim().min(1).optional(),
  styleHints: z.string().trim().min(1).optional(),
});

const visualIntentSchema = z
  .object({
    characters: z
      .array(
        z.object({
          role: z.string().trim().min(1),
          name: z.string().trim().min(1).optional(),
        })
      )
      .optional(),
    relationship: z.string().nullable().optional(),
    emotion: z.string().trim().min(1).optional(),
    purpose: z.string().trim().min(1).optional(),
  })
  .nullable()
  .optional();

/** Queue / import staging — parent fields preferred; legacy may omit. */
export const acceptedSceneCandidateStagingSchema = z.object({
  workId: stagingWorkId,
  sourceReviewId: z.string().min(1),
  parentStorySourceReviewId: z.string().min(1).optional(),
  parentStoryTitle: z.string().optional(),
  chapter_title: z.string().nullable().optional(),
  chapter_number: z.union([z.number(), z.string()]),
  title: z.string().trim().min(1),
  summary: z.string().optional(),
  visualIntent: visualIntentSchema,
  rendererExpression: rendererExpressionSchema.optional(),
  acceptedAt: z.string().min(1),
});

/** Projection Accept staging — parent Story refs required (Sprint #1). */
export const projectionSceneStagingSchema = acceptedSceneCandidateStagingSchema.extend({
  parentStorySourceReviewId: z.string().min(1),
  parentStoryTitle: z.string().min(1),
});

export const importStagingBodySchema = z.object({
  workId: stagingWorkId,
  storyUnits: z.array(acceptedStoryUnitStagingSchema).optional(),
  sceneCandidates: z.array(acceptedSceneCandidateStagingSchema).optional(),
});

export const persistStoryUnitBodySchema = z.object({
  workId: stagingWorkId,
  staging: acceptedStoryUnitStagingSchema,
});

export const sceneProjectionBodySchema = z.object({
  workId: stagingWorkId,
  staging: projectionSceneStagingSchema,
  mode: z.enum(["create", "link_existing"]),
  sceneTsid: z.string().optional(),
  /** Hotfix: parent Reading Route tsid (scene_*), not story_units uuid */
  linkToStoryUnitId: z.string().min(1).optional(),
});

export const unprojectBodySchema = z.object({
  workId: stagingWorkId,
  sourceReviewId: z.string().min(1).optional(),
  /** Soft-compat; Hotfix Frame unpersist keys off sourceReviewId */
  sceneProjectionLinkId: z.string().min(1).optional(),
  sceneTsid: z.string().min(1).optional(),
  mode: z.enum(["create", "link_existing"]).optional(),
});

export const createLinkBodySchema = z.object({
  workId: stagingWorkId,
  /** Hotfix: Reading Route tsid when using Route-as-Story-unit facade */
  storyUnitId: z.string().min(1),
  sceneTsid: z.string().min(1),
});

export const archiveStoryUnitBodySchema = z.object({
  workId: stagingWorkId,
  storyUnitId: z.string().min(1),
});

export const updateStoryUnitBodySchema = z.object({
  workId: stagingWorkId,
  title: z.string().trim().min(1),
  summary: z.string(),
  boundaryHint: z.string().optional(),
});

export function assertStagingWorkId(
  workId: string,
  stagingWorkIdValue: string
): boolean {
  return workId === stagingWorkIdValue;
}
