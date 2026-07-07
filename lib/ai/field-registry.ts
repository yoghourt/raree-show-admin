/**
 * SPEC-CORE-001 §4.3 — Entity Schema Field Registry (runtime mirror)
 *
 * Mirrors docs/specs/spec-core-001-entity-schema-registry.md §4.3.
 * Consumed by SPEC-D2-002 Enrichment Copilot routing.
 *
 * INVARIANTS (MD-01, AC-26/27, CORE-RC-01):
 *   - Copilot routing logic MUST NOT hardcode field names as string literals.
 *   - All routing decisions are derived exclusively from this registry at runtime.
 *   - Adding a new field requires only a new entry here — zero routing code changes.
 *   - Asset fields MUST always be excluded regardless of any other metadata (FC-03).
 *   - Reference route fields are effective excluded for v1 suggest paths (CORE-RC-04).
 */

import type {
  EntityType,
  FieldClassification,
  FieldMetadata,
  FieldRequest,
  CopilotRoute,
} from "@/lib/ai/copilot-types";

// ---------------------------------------------------------------------------
// §4.3.2 Character — `characters` table
// ---------------------------------------------------------------------------

const CHARACTER_REGISTRY: Record<string, FieldMetadata> = {
  name:           { classification: "scope",     copilot_route: "excluded"  },
  house:          { classification: "canonical",  copilot_route: "fact"      },
  description:    { classification: "narrative",  copilot_route: "narrative" },
  signatureQuote: { classification: "narrative",  copilot_route: "narrative" },
  portraitUrl:    { classification: "asset",      copilot_route: "excluded"  },
};

// ---------------------------------------------------------------------------
// §4.3.3 Location — `locations` table
// ---------------------------------------------------------------------------

const LOCATION_REGISTRY: Record<string, FieldMetadata> = {
  name:        { classification: "scope",     copilot_route: "excluded"  },
  region:      { classification: "canonical",  copilot_route: "fact"      },
  description: { classification: "narrative",  copilot_route: "narrative" },
  map_focus_x: { classification: "asset",      copilot_route: "excluded"  },
  map_focus_y: { classification: "asset",      copilot_route: "excluded"  },
};

// ---------------------------------------------------------------------------
// §4.3.4 Reading Route (normative) — implementation: `scenes` table
// Normative vocabulary: docs/runtime-lexicon-v2.md RV-02
//   summary       → Route Synopsis (RV-03)
//   story_images_v2 → Reading Frames JSONB (RV-04); caption inside = Frame Narrative (RV-05)
// ---------------------------------------------------------------------------

const SCENE_REGISTRY: Record<string, FieldMetadata> = {
  title:          { classification: "scope",     copilot_route: "excluded"  },
  chapter_title:  { classification: "canonical",  copilot_route: "fact"      },
  chapter_number: { classification: "canonical",  copilot_route: "fact"      },
  summary:        { classification: "narrative",  copilot_route: "narrative" }, // Route Synopsis
  tags:           { classification: "scope",      copilot_route: "excluded"  },
  story_images_v2:{ classification: "asset",      copilot_route: "excluded"  }, // Reading Frames
  locationId:     { classification: "canonical",  copilot_route: "reference" },
  characterIds:   { classification: "canonical",  copilot_route: "reference" },
};

// ---------------------------------------------------------------------------
// Master registry — keyed by EntityType (MD-03: adding entity type requires
// zero changes to Copilot routing logic)
// ---------------------------------------------------------------------------

export const FIELD_REGISTRY: Record<EntityType, Record<string, FieldMetadata>> = {
  character: CHARACTER_REGISTRY,
  location:  LOCATION_REGISTRY,
  scene:     SCENE_REGISTRY,
};

/** Human-readable labels for prompts and UI (not used for routing). */
const FIELD_DISPLAY_LABELS: Record<EntityType, Record<string, string>> = {
  character: {
    house: "家族",
    description: "描述",
    signatureQuote: "标志性台词",
  },
  location: {
    region: "地区",
    description: "描述",
  },
  scene: {
    chapter_title: "章节标题",
    chapter_number: "章节序号",
    summary: "摘要",
  },
};

export function getFieldLabel(entityType: EntityType, field: string): string {
  return FIELD_DISPLAY_LABELS[entityType]?.[field] ?? field;
}

// ---------------------------------------------------------------------------
// Runtime helpers
// ---------------------------------------------------------------------------

/**
 * Returns the FieldMetadata for a given entity type + field name.
 * Returns undefined for system fields (id, tsid, workId, createdAt, etc.)
 * that are not registered — callers should treat missing entries as excluded.
 */
export function getFieldMetadata(
  entityType: EntityType,
  field: string
): FieldMetadata | undefined {
  return FIELD_REGISTRY[entityType]?.[field];
}

/**
 * Returns the effective Copilot route for a field (SPEC-CORE-001 §4.5).
 * Unregistered fields are excluded.
 * Asset fields are always excluded (FC-03, AC-29).
 * Reference route fields are effective excluded for v1 suggest paths (CORE-RC-04).
 */
export function getEffectiveRoute(
  entityType: EntityType,
  field: string
): CopilotRoute {
  const meta = getFieldMetadata(entityType, field);
  if (!meta) return "excluded";
  if (meta.classification === "asset") return "excluded";
  if (meta.copilot_route === "reference") return "excluded";
  return meta.copilot_route;
}

/**
 * Given an entity type and a map of current form values, returns the list of
 * FieldRequest objects that should be sent to POST /suggest.
 *
 * Filters applied (RT-INV-08, AC-15, AC-22, AC-29, §5.4):
 *   - Only fields whose current value is empty (undefined / null / "")
 *   - Only fields whose effective Copilot route is "fact" or "narrative"
 *     (excludes scope, asset, reference-in-v1, and unknown fields)
 *
 * IMPORTANT: This function reads routing decisions from FIELD_REGISTRY only.
 * No field name string literals appear in the filtering predicate below.
 */
export function getSuggestableFields(
  entityType: EntityType,
  formValues: Record<string, unknown>
): FieldRequest[] {
  const registry = FIELD_REGISTRY[entityType];
  const result: FieldRequest[] = [];

  for (const field of Object.keys(registry)) {
    const route = getEffectiveRoute(entityType, field);
    if (route !== "fact" && route !== "narrative") continue;

    const currentValue = formValues[field];
    const isEmpty =
      currentValue === undefined ||
      currentValue === null ||
      currentValue === "" ||
      (Array.isArray(currentValue) && currentValue.length === 0);

    if (!isEmpty) continue;

    result.push({ field, copilot_route: route });
  }

  return result;
}

/**
 * Returns the classification for a field, or undefined if not registered.
 * Used by the UI to determine Regenerate button eligibility (§9.5, AC-26).
 */
export function getClassification(
  entityType: EntityType,
  field: string
): FieldClassification | undefined {
  return getFieldMetadata(entityType, field)?.classification;
}

/**
 * Returns all fields registered as "scope" classification for an entity type.
 * Used by the server to validate that scope fields are absent from emptyFields (AC-15).
 */
export function getScopeFields(entityType: EntityType): string[] {
  const registry = FIELD_REGISTRY[entityType];
  return Object.entries(registry)
    .filter(([, meta]) => meta.classification === "scope")
    .map(([field]) => field);
}

/**
 * Returns all fields registered as "asset" classification for an entity type.
 * Used by the server to validate that asset fields are absent from emptyFields (AC-29).
 */
export function getAssetFields(entityType: EntityType): string[] {
  const registry = FIELD_REGISTRY[entityType];
  return Object.entries(registry)
    .filter(([, meta]) => meta.classification === "asset")
    .map(([field]) => field);
}
