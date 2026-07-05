/**
 * GET /api/admin/rollout?workId=
 * SPEC-ROL-001 §4.7.5
 */

import { NextResponse } from "next/server";

import {
  assertWorkAccessible,
  requireRolloutAuth,
} from "@/lib/rollout/rollout-route-helpers";
import {
  listScenesBrief,
  listStorySceneLinks,
} from "@/lib/rollout/story-scene-links";
import { listStoryUnits } from "@/lib/rollout/story-units";
import { emptyRolloutQueue } from "@/lib/rollout/rollout-queue-storage";

export async function GET(request: Request) {
  const auth = await requireRolloutAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const workId = url.searchParams.get("workId")?.trim();
  if (!workId) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_BODY",
          message: "workId query parameter is required",
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
    const [storyUnits, links, scenes] = await Promise.all([
      listStoryUnits(auth.supabase, workId),
      listStorySceneLinks(auth.supabase, workId),
      listScenesBrief(auth.supabase, workId),
    ]);

    return NextResponse.json({
      ok: true,
      workId,
      queue: emptyRolloutQueue(workId, auth.userId),
      storyUnits,
      links,
      scenes,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: { code: "STAGING_INVALID", message } },
      { status: 500 }
    );
  }
}
