/**
 * GET /api/admin/source-profiles — list runtime SourceProfiles for WorkForm
 */

import { NextResponse } from "next/server";

import { listSourceProfiles } from "@/lib/ai/source-registry";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET() {
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

  try {
    const profiles = await listSourceProfiles();
    return NextResponse.json({
      profiles: profiles.map((p) => ({
        profileId: p.profileId,
        displayName: p.displayName,
        kind: p.kind,
        workPattern: p.workPattern,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message } },
      { status: 500 }
    );
  }
}
