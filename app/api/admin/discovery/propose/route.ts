/**
 * POST /api/admin/discovery/propose
 *
 * SPEC-D3-003 §4.5 / D3-AC-IMP-PRO-01
 *
 * MUST NOT persist Candidates. MUST NOT use /api/admin/ai/suggest.
 */

import { NextResponse } from "next/server";

import {
  assertWorkAccessible,
  parseJsonBody,
  requireDiscoveryAuth,
} from "@/lib/discovery/discovery-route-helpers";
import { proposeDiscoveryBodySchema } from "@/lib/discovery/propose-schemas";
import { proposeAllCandidateTypes } from "@/lib/discovery/propose-service";
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

  const parsed = proposeDiscoveryBodySchema.safeParse(bodyResult.json);
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

  const { workId, sessionId, narrative, lockedAt } = parsed.data;

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

  const { candidates, errors } = await proposeAllCandidateTypes({
    workId,
    workTitle: workResult.title,
    narrative,
  });

  if (candidates.length === 0 && errors.length > 0) {
    return NextResponse.json(
      {
        error: {
          code: "PROPOSE_GENERATION_FAILED",
          message: "All candidate types failed generation",
          errors,
        },
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    sessionId,
    state: "review_pending" as const,
    candidates,
    ...(errors.length > 0 ? { errors } : {}),
  });
}
