/**
 * POST /api/admin/rollout/staging/import
 * SPEC-ROL-001 §4.7.1
 */

import { NextResponse } from "next/server";

import {
  assertWorkAccessible,
  parseJsonBody,
  requireRolloutAuth,
} from "@/lib/rollout/rollout-route-helpers";
import {
  assertStagingWorkId,
  importStagingBodySchema,
} from "@/lib/rollout/schemas";
import { mergeRolloutQueue } from "@/lib/rollout/rollout-queue-storage";

export async function POST(request: Request) {
  const auth = await requireRolloutAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = importStagingBodySchema.safeParse(bodyResult.json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "STAGING_INVALID",
          message: "Invalid staging import body",
          fields: Object.keys(parsed.error.flatten().fieldErrors),
        },
      },
      { status: 422 }
    );
  }

  const { workId, storyUnits, sceneCandidates } = parsed.data;

  const workResult = await assertWorkAccessible(auth.supabase, workId);
  if (!workResult.ok) {
    return workResult.response;
  }

  for (const staging of storyUnits ?? []) {
    if (!assertStagingWorkId(workId, staging.workId)) {
      return NextResponse.json(
        {
          error: {
            code: "WORK_MISMATCH",
            message: "Story staging workId does not match request workId",
          },
        },
        { status: 400 }
      );
    }
  }

  for (const staging of sceneCandidates ?? []) {
    if (!assertStagingWorkId(workId, staging.workId)) {
      return NextResponse.json(
        {
          error: {
            code: "WORK_MISMATCH",
            message: "Scene staging workId does not match request workId",
          },
        },
        { status: 400 }
      );
    }
  }

  const queue = mergeRolloutQueue(
    {
      workId,
      storyStaging: [],
      sceneStaging: [],
      updatedAt: new Date().toISOString(),
    },
    { storyUnits, sceneCandidates }
  );

  return NextResponse.json({ ok: true, queue });
}
