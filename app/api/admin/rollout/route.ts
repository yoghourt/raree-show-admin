/**
 * GET /api/admin/rollout?workId=
 * Hotfix — Reading Routes / Frames from scenes provenance
 */

import { NextResponse } from "next/server";

import { listFrameProjections } from "@/lib/rollout/reading-frame-persist";
import {
  assertWorkAccessible,
  requireRolloutAuth,
} from "@/lib/rollout/rollout-route-helpers";
import { emptyRolloutQueue } from "@/lib/rollout/rollout-queue-storage";
import { listScenesBrief } from "@/lib/rollout/story-scene-links";
import { listStoryUnits } from "@/lib/rollout/story-units";

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
    const [storyUnits, frameProjections, scenes] = await Promise.all([
      listStoryUnits(auth.supabase, workId),
      listFrameProjections(auth.supabase, workId),
      listScenesBrief(auth.supabase, workId),
    ]);

    return NextResponse.json({
      ok: true,
      workId,
      queue: emptyRolloutQueue(workId, auth.userId),
      storyUnits,
      // Soft-deprecated Sprint #1 tables — empty for new happy path
      approvedSceneUnits: [],
      sceneProjectionLinks: [],
      links: [],
      frameProjections,
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
