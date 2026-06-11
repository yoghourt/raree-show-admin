/**
 * POST /api/admin/ai/suggest
 *
 * SPEC-D2-002 §7.1 / §7.2 — Suggest endpoint
 *
 * Validation rules (§7.6):
 *   400 SCOPE_MISSING       — scopeField absent or empty
 *   422 INVALID_FIELD_REQUEST — scope or asset field present in emptyFields
 *   404 ENTITY_NOT_FOUND   — entityId not found within workId
 *   401                    — unauthenticated
 *
 * Partial success (§13.2): HTTP 200 with both suggestions and errors arrays.
 *
 * AC-01: This endpoint returns candidates only. It MUST NOT write to the database.
 * AC-14: sessionId is a correlation identifier only; no correctness logic depends on it.
 */

import { randomUUID } from "crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { generateSuggestions } from "@/lib/ai/suggest-service";
import { getScopeFields, getAssetFields } from "@/lib/ai/field-registry";
import type { EntityType, SuggestRequest } from "@/lib/ai/copilot-types";

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const fieldRequestSchema = z.object({
  field: z.string().min(1),
  copilot_route: z.enum(["fact", "narrative"]),
});

const bodySchema = z.object({
  workId: z.string().min(1),
  entityType: z.enum(["character", "location", "scene"]),
  entityId: z.string().min(1),
  scopeField: z.string(),
  emptyFields: z.array(fieldRequestSchema),
});

// ---------------------------------------------------------------------------
// Entity lookup helpers (work-scoped isolation, §14.2)
// ---------------------------------------------------------------------------

const ENTITY_TABLE: Record<EntityType, string> = {
  character: "characters",
  location:  "locations",
  scene:     "scenes",
};

async function entityExistsInWork(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  entityType: EntityType,
  entityId: string,
  workId: string
): Promise<boolean> {
  // Creation flows use entityId = "new" — skip DB check (§3.3, AC-23)
  if (entityId === "new") return true;

  const table = ENTITY_TABLE[entityType];
  const { data } = await supabase
    .from(table)
    .select("tsid")
    .eq("tsid", entityId)
    .eq("work_id", workId)
    .maybeSingle();

  return data !== null;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  // Parse body
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "Invalid request body", fields: Object.keys(parsed.error.flatten().fieldErrors) } },
      { status: 400 }
    );
  }

  const { workId, entityType, entityId, scopeField, emptyFields } = parsed.data;

  // §7.6: scopeField must be present and non-empty (AC-14)
  if (!scopeField.trim()) {
    return NextResponse.json(
      { error: { code: "SCOPE_MISSING", message: "scopeField is required and must be non-empty" } },
      { status: 400 }
    );
  }

  // §7.6: no scope or asset fields in emptyFields (AC-15, AC-29)
  const scopeFields = getScopeFields(entityType);
  const assetFields = getAssetFields(entityType);
  const excludedSet = new Set([...scopeFields, ...assetFields]);

  const offendingFields = emptyFields
    .map((fr) => fr.field)
    .filter((f) => excludedSet.has(f));

  if (offendingFields.length > 0) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_FIELD_REQUEST",
          message: "Scope or asset fields must not appear in emptyFields",
          fields: offendingFields,
        },
      },
      { status: 422 }
    );
  }

  // §7.6, §14.2: entityId must belong to workId
  const exists = await entityExistsInWork(supabase, entityType, entityId, workId);
  if (!exists) {
    return NextResponse.json(
      { error: { code: "ENTITY_NOT_FOUND", message: "Entity not found within the specified work" } },
      { status: 404 }
    );
  }

  // Nothing to suggest
  if (emptyFields.length === 0) {
    return NextResponse.json({ suggestions: [], sessionId: null });
  }

  // Work title gives the model universe context (e.g. 三体 vs 冰与火之歌).
  const { data: workRow } = await supabase
    .from("works")
    .select("title")
    .eq("id", workId)
    .maybeSingle();
  const workTitle = (workRow as { title?: string } | null)?.title ?? null;

  // Generate suggestions (§4.4 / §4.5)
  const req: SuggestRequest = {
    workId,
    entityType,
    entityId,
    scopeField,
    workTitle,
    emptyFields,
  };

  const { items, errors } = await generateSuggestions(req);

  // Correlation identifier — logging/tracing only (§13.5, EAR-SPEC-D2-002-002)
  const sessionId = randomUUID();

  if (errors.length === 0) {
    return NextResponse.json({ suggestions: items, sessionId });
  }

  // Partial success (§13.2)
  return NextResponse.json({ suggestions: items, errors, sessionId });
}
