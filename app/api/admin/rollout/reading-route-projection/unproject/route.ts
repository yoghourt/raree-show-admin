/**
 * POST /api/admin/rollout/reading-route-projection/unproject
 * Cancel Reading Route projection — restore staging (delete created Reading Route when applicable)
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  assertWorkAccessible,
  parseJsonBody,
  requireRolloutAuth,
} from "@/lib/rollout/rollout-route-helpers";
import { unprojectReadingRoute } from "@/lib/rollout/reading-route-projection";

const bodySchema = z.object({
  workId: z.string().min(1),
  sceneTsid: z.string().min(1),
  mode: z.enum(["create", "link_existing"]),
});

export async function POST(request: Request) {
  const auth = await requireRolloutAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = bodySchema.safeParse(bodyResult.json);
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

  const { workId, sceneTsid, mode } = parsed.data;

  const workResult = await assertWorkAccessible(auth.supabase, workId);
  if (!workResult.ok) {
    return workResult.response;
  }

  try {
    const result = await unprojectReadingRoute(
      auth.supabase,
      workId,
      sceneTsid,
      mode
    );
    if (!result.ok) {
      return NextResponse.json(
        {
          error: {
            code: "SCENE_NOT_FOUND",
            message: "Reading Route not found for unproject",
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
