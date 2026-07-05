/**
 * POST /api/admin/rollout/story-scene-links
 * SPEC-ROL-001 §4.7.4
 */

import { NextResponse } from "next/server";

import {
  assertWorkAccessible,
  parseJsonBody,
  requireRolloutAuth,
} from "@/lib/rollout/rollout-route-helpers";
import {
  createStorySceneLink,
  sceneExistsInWork,
} from "@/lib/rollout/story-scene-links";
import { createLinkBodySchema } from "@/lib/rollout/schemas";
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

  const parsed = createLinkBodySchema.safeParse(bodyResult.json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "STAGING_INVALID",
          message: "Invalid link body",
          fields: Object.keys(parsed.error.flatten().fieldErrors),
        },
      },
      { status: 422 }
    );
  }

  const { workId, storyUnitId, sceneTsid } = parsed.data;

  const workResult = await assertWorkAccessible(auth.supabase, workId);
  if (!workResult.ok) {
    return workResult.response;
  }

  const unit = await getStoryUnit(auth.supabase, workId, storyUnitId);
  if (!unit || unit.status !== "active") {
    return NextResponse.json(
      {
        error: {
          code: "STORY_UNIT_NOT_FOUND",
          message: "Active story unit not found",
        },
      },
      { status: 404 }
    );
  }

  const sceneOk = await sceneExistsInWork(auth.supabase, workId, sceneTsid);
  if (!sceneOk) {
    return NextResponse.json(
      {
        error: {
          code: "SCENE_NOT_FOUND",
          message: "Scene not found in work",
        },
      },
      { status: 404 }
    );
  }

  try {
    const link = await createStorySceneLink(
      auth.supabase,
      workId,
      storyUnitId,
      sceneTsid,
      auth.userId
    );
    return NextResponse.json({ ok: true, link });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message === "LINK_ALREADY_EXISTS") {
      return NextResponse.json(
        {
          error: {
            code: "LINK_ALREADY_EXISTS",
            message: "Link already exists for this story unit and scene",
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
