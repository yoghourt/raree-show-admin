/**
 * POST /api/admin/discovery/session/lock
 *
 * SPEC-D3-001 §4.6 / §6 / D3-AC-IMP-05
 *
 * Server MUST re-run Narrative Gate (NG-01–NG-07).
 * MUST NOT persist Candidates, Entities, or catalog records (DISC-INV-01).
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { validateNarrativeGate } from "@/lib/discovery/narrative-gate";
import { setServerLock } from "@/lib/discovery/server-session-registry";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const excerptSchema = z.object({
  text: z.string(),
  orderIndex: z.number(),
  sourceLabel: z.string().optional(),
});

const narrativeSchema = z.object({
  excerpts: z.array(excerptSchema),
  operatorSummary: z.string().nullable().optional(),
  inputMode: z.enum(["excerpt_bundle", "approved_summary"]),
  summaryAttested: z.boolean().optional(),
});

const bodySchema = z.object({
  workId: z.string().min(1),
  sessionId: z.string().min(1),
  narrative: narrativeSchema,
  catalogOnly: z.boolean().optional(),
  runtimeExportOnly: z.boolean().optional(),
});

async function workAccessible(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  workId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("works")
    .select("id")
    .eq("id", workId)
    .maybeSingle();

  return data !== null;
}

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

  const { workId, sessionId, narrative, catalogOnly, runtimeExportOnly } =
    parsed.data;

  const accessible = await workAccessible(supabase, workId);
  if (!accessible) {
    return NextResponse.json(
      {
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Work not found or not accessible",
        },
      },
      { status: 404 }
    );
  }

  const gate = validateNarrativeGate({
    ...narrative,
    catalogOnly,
    runtimeExportOnly,
  });

  if (!gate.pass) {
    return NextResponse.json(
      {
        error: {
          code: "NARRATIVE_GATE_FAILED",
          message: "Narrative gate validation failed",
          failures: gate.failures,
          totalProse: gate.totalProse,
        },
      },
      { status: 422 }
    );
  }

  const lockedAt = new Date().toISOString();
  const lockClaim = setServerLock(
    workId,
    user.id,
    sessionId,
    lockedAt,
    narrative
  );
  if (!lockClaim.ok) {
    return NextResponse.json(
      {
        error: {
          code: lockClaim.code,
          message: "An active Discovery session already exists for this work",
        },
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    state: "narrative_locked" as const,
    sessionId,
    lockedAt,
    narrative,
  });
}
