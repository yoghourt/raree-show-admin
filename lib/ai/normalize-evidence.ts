/**
 * SPEC-D2-003 — Evidence normalization (field extraction only here).
 */

import type { EvidenceBundle } from "@/lib/ai/evidence-types";
import type { EntityType, SourceRef } from "@/lib/ai/copilot-types";
import { callCopilotTextLlm } from "@/lib/ai/copilot-text-llm";
import { getFieldLabel } from "@/lib/ai/field-registry";

export type NormalizedFact = {
  value: string;
  sources: SourceRef[];
};

function cleanHouseValue(raw: string): string {
  return raw
    .replace(/\{\{|\}\}/g, "")
    .replace(/\[\[([^|\]]+\|)?([^\]]+)\]\]/g, "$2")
    .replace(/^House\s+/i, "")
    .trim();
}

function extractHouseFromExcerpt(excerpt: string): string | null {
  const patterns = [
    /\|House\s*=\s*([^\n|]+)/i,
    /\|Allegiance\s*=\s*([^\n|]+)/i,
    /\bHouse\s*[|:]\s*([^\n|]+)/i,
    /\bAllegiance\s*[|:]\s*([^\n|]+)/i,
  ];
  for (const re of patterns) {
    const m = excerpt.match(re);
    const raw = m?.[1]?.trim();
    if (raw) {
      const cleaned = cleanHouseValue(raw);
      if (cleaned) return cleaned;
    }
  }
  return null;
}

function extractRegionFromExcerpt(excerpt: string): string | null {
  const patterns = [
    /\|Region\s*=\s*([^\n|]+)/i,
    /\bRegion\s*[|:]\s*([^\n|]+)/i,
  ];
  for (const re of patterns) {
    const m = excerpt.match(re);
    const raw = m?.[1]?.trim();
    if (raw) {
      const cleaned = raw.replace(/\{\{|\}\}/g, "").replace(/\[\[([^|\]]+\|)?([^\]]+)\]\]/g, "$2").trim();
      if (cleaned) return cleaned;
    }
  }
  return null;
}

function extractChapterNumberFromExcerpt(excerpt: string): string | null {
  const m = excerpt.match(/\bChapter\s*[|:]\s*([^\n|]+)/i);
  return m?.[1]?.trim() ?? null;
}

function tryStructuredExtract(
  entityType: EntityType,
  field: string,
  excerpt: string
): string | null {
  if (entityType === "character" && field === "house") {
    return extractHouseFromExcerpt(excerpt);
  }
  if (entityType === "location" && field === "region") {
    return extractRegionFromExcerpt(excerpt);
  }
  if (entityType === "scene" && field === "chapter_number") {
    return extractChapterNumberFromExcerpt(excerpt);
  }
  return null;
}

async function llmExtractFromEvidence(params: {
  entityType: EntityType;
  field: string;
  scopeFieldValue: string;
  excerpts: string[];
}): Promise<string> {
  const { entityType, field, scopeFieldValue, excerpts } = params;
  const fieldLabel = getFieldLabel(entityType, field);
  const combined = excerpts.join("\n\n---\n\n").slice(0, 6000);

  const prompt = `Extract ONLY the value for the metadata field "${fieldLabel}" (key: "${field}") about entity "${scopeFieldValue}".

Evidence excerpts (do NOT use knowledge outside these excerpts):
${combined}

Rules:
- Output JSON only: {"value": "..."}
- If the evidence does not contain this field, output {"value": ""}
- Do NOT invent facts not present in the excerpts`;

  const raw = await callCopilotTextLlm(prompt);
  try {
    const parsed = JSON.parse(raw.trim()) as { value?: string };
    return (parsed.value ?? "").trim();
  } catch {
    const match = raw.match(/"value"\s*:\s*"([^"]*)"/);
    return match?.[1]?.trim() ?? "";
  }
}

export async function normalizeEvidence(
  bundle: EvidenceBundle,
  entityType: EntityType,
  field: string
): Promise<NormalizedFact> {
  const sources: SourceRef[] = bundle.evidenceItems.map((i) => i.sourceRef);

  for (const item of bundle.evidenceItems) {
    const structured = tryStructuredExtract(entityType, field, item.excerpt);
    if (structured) {
      return { value: structured, sources };
    }
  }

  const excerpts = bundle.evidenceItems.map((i) => i.excerpt).filter(Boolean);
  if (excerpts.length === 0) {
    return { value: "", sources };
  }

  const value = await llmExtractFromEvidence({
    entityType,
    field,
    scopeFieldValue: bundle.scopeFieldValue,
    excerpts,
  });

  return { value, sources };
}

export function bundleToConfidence(
  bundle: EvidenceBundle
): "green" | "yellow" {
  return bundle.tier === 1 ? "green" : "yellow";
}
