/**
 * POST /api/admin/rollout/reader-evidence
 * Read-back gate after Story + Frame write (Constitution: Evidence Before Completion).
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  assertWorkAccessible,
  requireRolloutAuth,
} from "@/lib/rollout/rollout-route-helpers";
import { verifyReaderEvidence } from "@/lib/rollout/verify-reader-evidence";

const bodySchema = z.object({
  workId: z.string().min(1),
  routeTsid: z.string().min(1),
  expectedCaptionCount: z.number().int().min(0).optional(),
});

export async function POST(request: Request) {
  const auth = await requireRolloutAuth();
  if (!auth.ok) {
    return auth.response;
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_BODY",
          message: parsed.error.issues.map((i) => i.message).join("; "),
        },
      },
      { status: 400 }
    );
  }

  const { workId, routeTsid, expectedCaptionCount } = parsed.data;
  const workResult = await assertWorkAccessible(auth.supabase, workId);
  if (!workResult.ok) {
    return workResult.response;
  }

  const result = await verifyReaderEvidence(auth.supabase, workId, routeTsid, {
    expectedCaptionCount,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: { code: result.code, message: result.message } },
      { status: 422 }
    );
  }

  return NextResponse.json({ ok: true, evidence: result });
}
