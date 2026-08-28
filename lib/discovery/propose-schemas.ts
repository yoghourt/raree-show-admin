/**
 * SPEC-D3-003 §4.5 / §4.6 — shared Zod schemas for propose routes
 */

import { z } from "zod";

import { DISCOVERY_CANDIDATE_TYPES } from "@/lib/discovery/propose-types";

export const narrativeExcerptSchema = z.object({
  text: z.string(),
  orderIndex: z.number(),
  sourceLabel: z.string().optional(),
});

export const narrativeInputBundleSchema = z.object({
  excerpts: z.array(narrativeExcerptSchema),
  operatorSummary: z.string().nullable().optional(),
  inputMode: z.enum(["excerpt_bundle", "approved_summary"]),
  summaryAttested: z.boolean().optional(),
});

const evidenceRefSchema = z.object({
  sourceLabel: z.string(),
  excerpt: z.string().optional(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  url: z.string().optional(),
});

const characterArchiveSchema = z
  .object({
    visualSummary: z.string().optional(),
    identityCues: z.array(z.string()).optional(),
    costumeCues: z.array(z.string()),
    propCues: z.array(z.string()),
  })
  .optional();

const characterFieldsSchema = z.object({
  name: z.string(),
  house: z.string().optional(),
  description: z.string().optional(),
  signatureQuote: z.string().optional(),
  characterArchive: characterArchiveSchema,
});

const locationFieldsSchema = z.object({
  name: z.string(),
  region: z.string().optional(),
  description: z.string().optional(),
});

const storyFieldsSchema = z.object({
  title: z.string(),
  summary: z.string(),
  boundaryHint: z.string().optional(),
});

const rendererExpressionSchema = z.object({
  environment: z.string().min(1),
  characters: z.array(
    z.object({
      role: z.string().min(1),
      visual: z.string().min(1),
    })
  ),
  action: z.string().min(1),
  composition: z.string().min(1),
  lighting: z.string().optional(),
  styleHints: z.string().optional(),
  atmosphere: z.string().optional(),
  threatPerception: z.string().optional(),
  visualEmphasis: z.string().optional(),
});

const visualIntentSchema = z
  .object({
    characters: z
      .array(
        z.object({
          role: z.string().min(1),
          name: z.string().optional(),
        })
      )
      .optional(),
    relationship: z.string().nullable().optional(),
    emotion: z.string().optional(),
    purpose: z.string().optional(),
  })
  .nullable()
  .optional();

const sceneFieldsSchema = z.object({
  parentStoryCandidateId: z.string().min(1),
  chapter_title: z.string().nullable().optional(),
  chapter_number: z.union([z.number(), z.string()]),
  title: z.string(),
  summary: z.string().min(1),
  visualIntent: visualIntentSchema,
  rendererExpression: rendererExpressionSchema,
});

export const discoveryCandidateSchema = z.object({
  candidateId: z.string().min(1),
  candidateType: z.enum(["character", "location", "story", "scene"]),
  workId: z.string().min(1),
  displayName: z.string(),
  summary: z.string(),
  confidence: z.enum(["green", "yellow", "red"]).optional(),
  evidence: z.array(evidenceRefSchema).optional(),
  fields: z.union([
    characterFieldsSchema,
    locationFieldsSchema,
    storyFieldsSchema,
    sceneFieldsSchema,
  ]),
});

export const proposeDiscoveryBodySchema = z.object({
  workId: z.string().min(1),
  sessionId: z.string().min(1),
  narrative: narrativeInputBundleSchema,
  lockedAt: z.string().min(1),
  candidateTypes: z.array(z.enum(DISCOVERY_CANDIDATE_TYPES)).min(1).optional(),
  /** Required when retrying scene alone — Story candidates from the open session. */
  existingStoryCandidates: z.array(discoveryCandidateSchema).optional(),
  feedback: z.string().nullable().optional(),
});

export const regenDiscoveryBodySchema = z.object({
  workId: z.string().min(1),
  sessionId: z.string().min(1),
  narrative: narrativeInputBundleSchema,
  lockedAt: z.string().min(1),
  candidateType: z.enum(DISCOVERY_CANDIDATE_TYPES),
  previousCandidate: discoveryCandidateSchema,
  siblingCandidates: z.array(discoveryCandidateSchema).optional(),
  storyCandidates: z.array(discoveryCandidateSchema).optional(),
  feedback: z.string().nullable().optional(),
});

export const splitSceneExpressionsBodySchema = z.object({
  workId: z.string().min(1),
  sessionId: z.string().min(1),
  narrative: narrativeInputBundleSchema,
  lockedAt: z.string().min(1),
  beats: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string(),
      })
    )
    .min(2),
  characterCandidates: z.array(discoveryCandidateSchema).optional(),
});
