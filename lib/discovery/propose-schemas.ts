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

export const proposeDiscoveryBodySchema = z.object({
  workId: z.string().min(1),
  sessionId: z.string().min(1),
  narrative: narrativeInputBundleSchema,
  lockedAt: z.string().min(1),
});

const evidenceRefSchema = z.object({
  sourceLabel: z.string(),
  excerpt: z.string().optional(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  url: z.string().optional(),
});

const characterFieldsSchema = z.object({
  name: z.string(),
  house: z.string().optional(),
  description: z.string().optional(),
  signatureQuote: z.string().optional(),
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

const sceneFieldsSchema = z.object({
  chapter_title: z.string().nullable().optional(),
  chapter_number: z.union([z.number(), z.string()]),
  title: z.string(),
  summary: z.string().optional(),
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

export const regenDiscoveryBodySchema = z.object({
  workId: z.string().min(1),
  sessionId: z.string().min(1),
  narrative: narrativeInputBundleSchema,
  lockedAt: z.string().min(1),
  candidateType: z.enum(DISCOVERY_CANDIDATE_TYPES),
  previousCandidate: discoveryCandidateSchema,
  feedback: z.string().nullable().optional(),
});
