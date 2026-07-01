/**
 * POST /api/admin/discovery/propose/regen
 *
 * SPEC-D3-003 §4.6 / D3-AC-IMP-PRO-07
 */

import { NextResponse } from "next/server";

import {
  assertWorkAccessible,
  parseJsonBody,
  requireDiscoveryAuth,
} from "@/lib/discovery/discovery-route-helpers";
import { regenDiscoveryBodySchema } from "@/lib/discovery/propose-schemas";
import { regenCandidate } from "@/lib/discovery/propose-service";
import { verifyProposeLock } from "@/lib/discovery/propose-verify";

export async function POST(request: Request) {
  const auth = await requireDiscoveryAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = regenDiscoveryBodySchema.safeParse(bodyResult.json);
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

  const {
    workId,
    sessionId,
    narrative,
    lockedAt,
    candidateType,
    previousCandidate,
    feedback,
  } = parsed.data;

  const workResult = await assertWorkAccessible(auth.supabase, workId);
  if (!workResult.ok) {
    return workResult.response;
  }

  const lockCheck = verifyProposeLock(
    workId,
    auth.userId,
    sessionId,
    narrative,
    lockedAt
  );
  if (!lockCheck.ok) {
    return NextResponse.json(
      {
        error: {
          code: lockCheck.code,
          message: lockCheck.message,
          ...(lockCheck.failures ? { failures: lockCheck.failures } : {}),
        },
      },
      { status: lockCheck.code === "NARRATIVE_NOT_LOCKED" ? 400 : 422 }
    );
  }

  const result = await regenCandidate({
    workId,
    workTitle: workResult.title,
    narrative,
    candidateType,
    previousCandidate,
    feedback,
  });

  if (result.error?.code === "REGEN_INVALID") {
    return NextResponse.json(
      { error: { code: "REGEN_INVALID", message: result.error.message } },
      { status: 422 }
    );
  }

  if (!result.candidate) {
    return NextResponse.json(
      {
        error: {
          code: "PROPOSE_GENERATION_FAILED",
          message: result.error?.message ?? "Regen failed",
        },
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    sessionId,
    candidate: result.candidate,
  });
}
