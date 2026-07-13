/**
 * DELETE /api/admin/rollout/story-units/[storyUnitId]?workId=
 * SPEC-ROL-001 — 取消持久化：从 DB 移除并回到 Rollout 待持久化队列
 */

import { NextResponse } from "next/server";

import { messages } from "@/lib/locale";
import {
  assertWorkAccessible,
  requireRolloutAuth,
} from "@/lib/rollout/rollout-route-helpers";
import { updateStoryUnitBodySchema } from "@/lib/rollout/schemas";
import { unpersistStoryUnit, updateStoryUnit } from "@/lib/rollout/story-units";

type RouteContext = {
  params: Promise<{ storyUnitId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireRolloutAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const { storyUnitId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const parsed = updateStoryUnitBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "STAGING_INVALID",
          message: "Invalid update body",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  const { workId, title, summary, boundaryHint } = parsed.data;

  const workResult = await assertWorkAccessible(auth.supabase, workId);
  if (!workResult.ok) {
    return workResult.response;
  }

  try {
    const storyUnit = await updateStoryUnit(auth.supabase, workId, storyUnitId, {
      title,
      summary,
      boundaryHint,
    });

    if (!storyUnit) {
      return NextResponse.json(
        {
          error: {
            code: "STORY_UNIT_NOT_FOUND",
            message: "Story unit not found",
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

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireRolloutAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const { storyUnitId } = await context.params;
  const url = new URL(request.url);
  const workId = url.searchParams.get("workId")?.trim();

  if (!workId || !storyUnitId) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_BODY",
          message: "workId query parameter and storyUnitId are required",
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
    const result = await unpersistStoryUnit(
      auth.supabase,
      workId,
      storyUnitId
    );

    if (!result.ok) {
      if (result.code === "UNPERSIST_BLOCKED") {
        const message =
          result.blockedBy === "discovery_frames"
            ? messages.rollout.unpersistBlockedByProjection
            : result.blockedBy === "scene_projection"
              ? messages.rollout.unpersistBlockedByProjection
              : result.blockedBy === "story_links"
                ? messages.rollout.unpersistBlockedByLinks
                : messages.rollout.associationBlocked;
        return NextResponse.json(
          {
            error: {
              code: "UNPERSIST_BLOCKED",
              message,
            },
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error: {
            code: "STORY_UNIT_NOT_FOUND",
            message: "Story unit not found",
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      staging: result.staging,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: { code: "STAGING_INVALID", message } },
      { status: 500 }
    );
  }
}
