/**
 * POST /api/admin/discovery/session/reset
 *
 * Releases orphaned server-side lock for (workId, operatorId).
 * Used when client sessionId was regenerated but server lock remained (refresh / HMR).
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { releaseServerLockForOperator } from "@/lib/discovery/server-session-registry";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const bodySchema = z.object({
  workId: z.string().min(1),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "Invalid request body" } },
      { status: 400 }
    );
  }

  const released = releaseServerLockForOperator(parsed.data.workId, user.id);

  return NextResponse.json({ released, workId: parsed.data.workId });
}
