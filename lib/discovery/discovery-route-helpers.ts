/**
 * Shared helpers for Admin Discovery API routes
 */

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function requireDiscoveryAuth(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; userId: string }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 }
      ),
    };
  }

  return { ok: true, supabase, userId: user.id };
}

export async function assertWorkAccessible(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  workId: string
): Promise<{ ok: true; title: string } | { ok: false; response: NextResponse }> {
  const { data } = await supabase
    .from("works")
    .select("id, title")
    .eq("id", workId)
    .maybeSingle();

  if (!data) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: "SESSION_NOT_FOUND",
            message: "Work not found or not accessible",
          },
        },
        { status: 404 }
      ),
    };
  }

  return { ok: true, title: (data.title as string) ?? "Untitled Work" };
}

export async function parseJsonBody(
  request: Request
): Promise<{ ok: true; json: unknown } | { ok: false; response: NextResponse }> {
  try {
    return { ok: true, json: await request.json() };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
        { status: 400 }
      ),
    };
  }
}
