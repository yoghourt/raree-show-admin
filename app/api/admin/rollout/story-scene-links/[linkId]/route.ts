/**
 * DELETE /api/admin/rollout/story-scene-links/[linkId]?workId=
 * SPEC-ROL-001 §4.7.4
 */

import { NextResponse } from "next/server";

import {
  assertWorkAccessible,
  requireRolloutAuth,
} from "@/lib/rollout/rollout-route-helpers";
import { deleteStorySceneLink } from "@/lib/rollout/story-scene-links";

type RouteContext = {
  params: Promise<{ linkId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireRolloutAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const { linkId } = await context.params;
  const url = new URL(request.url);
  const workId = url.searchParams.get("workId")?.trim();

  if (!workId || !linkId) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_BODY",
          message: "workId query parameter and linkId are required",
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
    const deleted = await deleteStorySceneLink(
      auth.supabase,
      workId,
      linkId
    );
    if (!deleted) {
      return NextResponse.json(
        {
          error: {
            code: "STAGING_NOT_FOUND",
            message: "Link not found",
          },
        },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: { code: "STAGING_INVALID", message } },
      { status: 500 }
    );
  }
}
