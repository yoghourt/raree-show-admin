/**
 * POST /api/admin/rollout/story-units
 * SPEC-ROL-001 §4.7.2
 */

import { NextResponse } from "next/server";

import {
  assertWorkAccessible,
  parseJsonBody,
  requireRolloutAuth,
} from "@/lib/rollout/rollout-route-helpers";
import {
  assertStagingWorkId,
  persistStoryUnitBodySchema,
} from "@/lib/rollout/schemas";
import { persistStoryUnitFromStaging } from "@/lib/rollout/story-units";

export async function POST(request: Request) {
  const auth = await requireRolloutAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = persistStoryUnitBodySchema.safeParse(bodyResult.json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "STAGING_INVALID",
          message: "Invalid persist story unit body",
          fields: Object.keys(parsed.error.flatten().fieldErrors),
        },
      },
      { status: 422 }
    );
  }

  const { workId, staging } = parsed.data;

  if (!assertStagingWorkId(workId, staging.workId)) {
    return NextResponse.json(
      {
        error: {
          code: "WORK_MISMATCH",
          message: "Staging workId does not match request workId",
        },
      },
      { status: 400 }
    );
  }

  const workResult = await assertWorkAccessible(auth.supabase, workId);
  if (!workResult.ok) {
    return workResult.response;
  }

  try {
    const storyUnit = await persistStoryUnitFromStaging(
      auth.supabase,
      workId,
      staging,
      auth.userId
    );
    return NextResponse.json({ ok: true, storyUnit });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: { code: "STAGING_INVALID", message } },
      { status: 500 }
    );
  }
}
