/**
 * PATCH /api/admin/rollout/story-units — archive Approved Story unit
 */

import { NextResponse } from "next/server";

import {
  assertWorkAccessible,
  parseJsonBody,
  requireRolloutAuth,
} from "@/lib/rollout/rollout-route-helpers";
import { archiveStoryUnitBodySchema } from "@/lib/rollout/schemas";
import { archiveStoryUnit } from "@/lib/rollout/story-units";

export async function PATCH(request: Request) {
  const auth = await requireRolloutAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = archiveStoryUnitBodySchema.safeParse(bodyResult.json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "STAGING_INVALID",
          message: "Invalid archive body",
          fields: Object.keys(parsed.error.flatten().fieldErrors),
        },
      },
      { status: 422 }
    );
  }

  const { workId, storyUnitId } = parsed.data;

  const workResult = await assertWorkAccessible(auth.supabase, workId);
  if (!workResult.ok) {
    return workResult.response;
  }

  try {
    const storyUnit = await archiveStoryUnit(
      auth.supabase,
      workId,
      storyUnitId
    );
    if (!storyUnit) {
      return NextResponse.json(
        {
          error: {
            code: "STORY_UNIT_NOT_FOUND",
            message: "Story unit not found or already archived",
          },
        },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, storyUnit });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: { code: "STAGING_INVALID", message } },
      { status: 500 }
    );
  }
}
