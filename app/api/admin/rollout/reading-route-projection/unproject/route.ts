/**
 * POST /api/admin/rollout/reading-route-projection/unproject
 * Remove SceneProjectionLink (+ companion Story link). Keeps Reading Route + Approved Scene.
 */

import { NextResponse } from "next/server";

import {
  assertWorkAccessible,
  parseJsonBody,
  requireRolloutAuth,
} from "@/lib/rollout/rollout-route-helpers";
import { unprojectReadingRoute } from "@/lib/rollout/reading-route-projection";
import { unprojectBodySchema } from "@/lib/rollout/schemas";

export async function POST(request: Request) {
  const auth = await requireRolloutAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = unprojectBodySchema.safeParse(bodyResult.json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "STAGING_INVALID",
          message: "Invalid unproject body",
          fields: Object.keys(parsed.error.flatten().fieldErrors),
        },
      },
      { status: 422 }
    );
  }

  const { workId, sourceReviewId, sceneProjectionLinkId, sceneTsid, mode } =
    parsed.data;

  if (!sourceReviewId && !sceneProjectionLinkId) {
    return NextResponse.json(
      {
        error: {
          code: "STAGING_INVALID",
          message: "sourceReviewId or sceneProjectionLinkId is required",
        },
      },
      { status: 422 }
    );
  }

  const workResult = await assertWorkAccessible(auth.supabase, workId);
  if (!workResult.ok) {
    return workResult.response;
  }

  try {
    const result = await unprojectReadingRoute(auth.supabase, workId, {
      sourceReviewId,
      sceneProjectionLinkId,
      sceneTsid,
      mode,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          error: {
            code: result.code,
            message: result.message,
          },
        },
        { status: result.code === "STAGING_NOT_FOUND" ? 404 : 422 }
      );
    }
    return NextResponse.json({
      ok: true,
      sourceReviewId: result.sourceReviewId,
      readingRouteTsid: result.readingRouteTsid,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: { code: "STAGING_INVALID", message } },
      { status: 500 }
    );
  }
}
