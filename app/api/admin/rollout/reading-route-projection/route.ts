/**
 * POST /api/admin/rollout/reading-route-projection
 * SPEC-ROL-001 §4.7.3
 */

import { NextResponse } from "next/server";

import {
  assertWorkAccessible,
  parseJsonBody,
  requireRolloutAuth,
} from "@/lib/rollout/rollout-route-helpers";
import { acceptReadingRouteProjection } from "@/lib/rollout/reading-route-projection";
import {
  assertStagingWorkId,
  sceneProjectionBodySchema,
} from "@/lib/rollout/schemas";
import { getStoryUnit } from "@/lib/rollout/story-units";

export async function POST(request: Request) {
  const auth = await requireRolloutAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = sceneProjectionBodySchema.safeParse(bodyResult.json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "STAGING_INVALID",
          message: "Invalid reading route projection body",
          fields: Object.keys(parsed.error.flatten().fieldErrors),
        },
      },
      { status: 422 }
    );
  }

  const { workId, staging, mode, sceneTsid, linkToStoryUnitId } = parsed.data;

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

  if (mode === "link_existing" && !sceneTsid?.trim()) {
    return NextResponse.json(
      {
        error: {
          code: "SCENE_NOT_FOUND",
          message: "sceneTsid is required when mode is link_existing",
        },
      },
      { status: 404 }
    );
  }

  const workResult = await assertWorkAccessible(auth.supabase, workId);
  if (!workResult.ok) {
    return workResult.response;
  }

  if (linkToStoryUnitId) {
    const unit = await getStoryUnit(
      auth.supabase,
      workId,
      linkToStoryUnitId
    );
    if (!unit || unit.status !== "active") {
      return NextResponse.json(
        {
          error: {
            code: "STORY_UNIT_NOT_FOUND",
            message: "Active story unit not found for link",
          },
        },
        { status: 404 }
      );
    }
  }

  try {
    const result = await acceptReadingRouteProjection(auth.supabase, {
      workId,
      staging,
      mode,
      sceneTsid,
      linkToStoryUnitId,
      operatorId: auth.userId,
    });

    if (!result.ok) {
      const status =
        result.code === "SCENE_WORK_MISMATCH"
          ? 403
          : result.code === "SCENE_VALIDATION_FAILED"
            ? 422
            : 404;
      return NextResponse.json(
        {
          error: {
            code: result.code,
            message: result.message,
            ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
          },
        },
        { status }
      );
    }

    return NextResponse.json({
      ok: true,
      sceneTsid: result.sceneTsid,
      ...(result.link ? { link: result.link } : {}),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message === "LINK_ALREADY_EXISTS") {
      return NextResponse.json(
        {
          error: {
            code: "LINK_ALREADY_EXISTS",
            message: "Story unit is already linked to this Reading Route",
          },
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: { code: "STAGING_INVALID", message } },
      { status: 500 }
    );
  }
}
