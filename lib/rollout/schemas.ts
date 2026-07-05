/**
 * SPEC-ROL-001 §4 — Rollout request validation (zod)
 */

import { z } from "zod";

const stagingWorkId = z.string().min(1);

export const acceptedStoryUnitStagingSchema = z.object({
  workId: stagingWorkId,
  sourceReviewId: z.string().min(1),
  title: z.string().trim().min(1),
  summary: z.string(),
  boundaryHint: z.string().optional(),
  acceptedAt: z.string().min(1),
});

export const acceptedSceneCandidateStagingSchema = z.object({
  workId: stagingWorkId,
  sourceReviewId: z.string().min(1),
  chapter_title: z.string().nullable().optional(),
  chapter_number: z.union([z.number(), z.string()]),
  title: z.string().trim().min(1),
  summary: z.string().optional(),
  acceptedAt: z.string().min(1),
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
  staging: acceptedSceneCandidateStagingSchema,
  mode: z.enum(["create", "link_existing"]),
  sceneTsid: z.string().optional(),
  linkToStoryUnitId: z.string().uuid().optional(),
});

export const createLinkBodySchema = z.object({
  workId: stagingWorkId,
  storyUnitId: z.string().uuid(),
  sceneTsid: z.string().min(1),
});

export const archiveStoryUnitBodySchema = z.object({
  workId: stagingWorkId,
  storyUnitId: z.string().uuid(),
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
