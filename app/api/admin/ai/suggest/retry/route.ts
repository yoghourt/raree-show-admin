/**
 * POST /api/admin/ai/suggest/retry
 *
 * SPEC-D2-002 §7.4 / §9.2 — Batch Retry endpoint
 *
 * Also serves the Narrative Regenerate flow (§9.5) with a single retryField.
 *
 * RT-INV-11 / AC-10: ALL queued fields must be processed in a SINGLE call.
 *   This endpoint accepts an array; it MUST NOT be called per-field by the client.
 *
 * §13.5: sessionId is a correlation identifier only.
 *   The server MUST NOT validate or reject based on sessionId.
 *
 * §7.4: Server incorporates previousSuggestion (referent) and feedback
 *   (improvement direction) into the generation prompt for each field.
 *
 * AC-01: This endpoint returns candidates only. It MUST NOT write to the database.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { generateRetrySuggestions } from "@/lib/ai/suggest-service";
import { loadWorkSourceContext } from "@/lib/ai/source-registry";
import type { EntityType } from "@/lib/ai/copilot-types";

// ---------------------------------------------------------------------------
// Request schema
//
// Extends RetryRequest (§7.4) with entity context fields (workId, entityType,
// scopeField) required for prompt construction. The client already holds this
// context at retry time (same form session).
// ---------------------------------------------------------------------------

const retryFieldSchema = z.object({
  field: z.string().min(1),
  previousSuggestion: z.string(),
  feedback: z.string().nullable(),
});

const bodySchema = z.object({
  workId: z.string().min(1),
  entityType: z.enum(["character", "location", "scene"]),
  scopeField: z.string().min(1),
  sessionId: z.string().nullable().optional(),
  retryFields: z.array(retryFieldSchema).min(1),
});

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
      {
        error: {
          code: "INVALID_BODY",
          message: "Invalid request body",
          fields: Object.keys(parsed.error.flatten().fieldErrors),
        },
      },
      { status: 400 }
    );
  }

  const { workId, entityType, scopeField, retryFields } = parsed.data;

  const { data: workRow } = await supabase
    .from("works")
    .select("title")
    .eq("id", workId)
    .maybeSingle();
  const workTitle = (workRow as { title?: string } | null)?.title ?? null;

  let sourceContext = null;
  try {
    sourceContext = await loadWorkSourceContext(workId);
  } catch (e) {
    console.error("[suggest/retry] loadWorkSourceContext failed", e);
  }

  const { items, errors } = await generateRetrySuggestions(retryFields, {
    entityType: entityType as EntityType,
    scopeFieldValue: scopeField,
    workId,
    workTitle,
    sourceContext,
  });

  if (errors.length === 0) {
    return NextResponse.json({ suggestions: items });
  }

  // Partial success (§13.3): failed fields reported per-field
  return NextResponse.json({ suggestions: items, errors });
}
