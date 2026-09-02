/**
 * POST /api/admin/discovery/propose/split-expressions
 *
 * After Human confirms Split Scene beats, author rendererExpression per beat.
 */

import { NextResponse } from "next/server";

import {
  assertWorkAccessible,
  parseJsonBody,
  requireDiscoveryAuth,
} from "@/lib/discovery/discovery-route-helpers";
import { splitSceneExpressionsBodySchema } from "@/lib/discovery/propose-schemas";
import { verifyProposeLock } from "@/lib/discovery/propose-verify";
import { authorExpressionsForSplitBeats } from "@/lib/discovery/split-scene-expressions";

export async function POST(request: Request) {
  const auth = await requireDiscoveryAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = splitSceneExpressionsBodySchema.safeParse(bodyResult.json);
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
    beats,
    characterCandidates,
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

  const result = await authorExpressionsForSplitBeats({
    workId,
    workTitle: workResult.title,
    visualConvention: workResult.visualConvention,
    narrative,
    beats,
    characterCandidates,
  });

  if (result.error || result.beats.length < 2) {
    return NextResponse.json(
      {
        error: {
          code: result.error?.code ?? "SPLIT_EXPRESSION_FAILED",
          message: result.error?.message ?? "Split expression authorship failed",
        },
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    sessionId,
    beats: result.beats,
  });
}
