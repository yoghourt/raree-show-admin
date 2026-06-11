import { randomUUID } from "crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { GeminiBootstrapProvider } from "@/lib/ai/gemini-bootstrap-provider";
import { OpenRouterBootstrapProvider } from "@/lib/ai/openrouter-bootstrap-provider";
import type { BootstrapProvider } from "@/lib/ai/bootstrap-provider";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const bodySchema = z.object({
  workId: z.string().uuid(),
  clearExisting: z.boolean().optional().default(false),
});

type BootstrapError = { phase: string; message: string };

type BootstrapResult = {
  success: boolean;
  charactersCreated: number;
  locationsCreated: number;
  scenesCreated: number;
  errors: BootstrapError[];
};

type SseEvent =
  | { type: "phase"; message: string }
  | { type: "done"; result: BootstrapResult };

function generateTsid(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

function toErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function POST(request: Request) {
  // ── Pre-flight checks (standard HTTP responses) ──────────────────────────

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Provider selection: Gemini preferred (stronger factual recall, independent quota)
  // Falls back to OpenRouter when GEMINI_API_KEY is absent.
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!geminiKey && !openrouterKey) {
    return NextResponse.json(
      {
        error:
          "No AI provider configured. Set GEMINI_API_KEY (recommended) or OPENROUTER_API_KEY in .env.local.",
      },
      { status: 503 }
    );
  }

  let provider: BootstrapProvider;
  if (geminiKey) {
    const geminiModel = process.env.GEMINI_BOOTSTRAP_MODEL?.trim() || undefined;
    provider = new GeminiBootstrapProvider(geminiKey, geminiModel);
    console.info("[bootstrap] provider=gemini model=%s", geminiModel ?? "gemini-2.0-flash");
  } else {
    const openrouterModel = process.env.OPENROUTER_BOOTSTRAP_MODEL?.trim() || undefined;
    provider = new OpenRouterBootstrapProvider(openrouterKey!, openrouterModel);
    console.info("[bootstrap] provider=openrouter model=%s", openrouterModel ?? "meta-llama/llama-3.3-70b-instruct:free");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { workId, clearExisting } = parsed.data;

  const { data: workRow, error: workError } = await supabase
    .from("works")
    .select("id, title, description")
    .eq("id", workId)
    .maybeSingle();

  if (workError) {
    return NextResponse.json({ error: workError.message }, { status: 500 });
  }
  if (!workRow) {
    return NextResponse.json({ error: "Work not found" }, { status: 404 });
  }

  const work = workRow as { id: string; title: string; description: string };

  // Phase 0 — Clear (pre-flight, before stream starts)
  if (clearExisting) {
    for (const [table, label] of [
      ["scenes", "场景"],
      ["characters", "角色"],
      ["locations", "地点"],
    ] as const) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("work_id", workId);
      if (error) {
        console.error("[bootstrap]", {
          workId,
          phase: "clear",
          message: error.message,
        });
        return NextResponse.json(
          { error: `清空${label}失败：${error.message}` },
          { status: 500 }
        );
      }
    }
  }

  // ── SSE stream for the long-running generation + persistence phase ────────

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: SseEvent) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      }

      function finish(result: BootstrapResult) {
        send({ type: "done", result });
        controller.close();
      }

      const errors: BootstrapError[] = [];

      // Phase 1 — Generate
      send({ type: "phase", message: "正在 AI 生成角色、地点与场景内容，请稍候…" });

      let generated;
      try {
        generated = await provider.generate({
          title: work.title,
          description: work.description,
        });
      } catch (e) {
        const message = toErrorMessage(e);
        console.error("[bootstrap]", { workId, phase: "generation", message });
        finish({
          success: false,
          charactersCreated: 0,
          locationsCreated: 0,
          scenesCreated: 0,
          errors: [{ phase: "generation", message }],
        });
        return;
      }

      // Phase 2 — Persist Characters + Locations in parallel
      send({
        type: "phase",
        message: `内容生成完成。正在写入角色（${generated.characters.length} 个）与地点（${generated.locations.length} 个）…`,
      });

      const [charTsids, locTsids] = await Promise.all([
        (async () => {
          const tsids: (string | null)[] = [];
          for (const char of generated.characters) {
            const tsid = generateTsid("char");
            const { error } = await supabase.from("characters").insert({
              work_id: workId,
              tsid,
              name: char.name,
              house: char.house,
              description: char.description,
              signature_quote: char.signatureQuote ?? null,
              portrait_url: "",
            });
            if (error) {
              const message = error.message;
              console.error("[bootstrap]", { workId, phase: "characters", message });
              errors.push({ phase: "characters", message });
              tsids.push(null);
            } else {
              tsids.push(tsid);
            }
          }
          return tsids;
        })(),

        (async () => {
          const tsids: (string | null)[] = [];
          for (const loc of generated.locations) {
            const tsid = generateTsid("loc");
            const { error } = await supabase.from("locations").insert({
              work_id: workId,
              tsid,
              name: loc.name,
              region: loc.region,
              description: loc.description,
              map_focus_x: null,
              map_focus_y: null,
            });
            if (error) {
              const message = error.message;
              console.error("[bootstrap]", { workId, phase: "locations", message });
              errors.push({ phase: "locations", message });
              tsids.push(null);
            } else {
              tsids.push(tsid);
            }
          }
          return tsids;
        })(),
      ]);

      const charactersCreated = charTsids.filter(Boolean).length;
      const locationsCreated = locTsids.filter(Boolean).length;

      // Phase 3 — Persist Scenes
      send({
        type: "phase",
        message: `角色 ${charactersCreated} 个、地点 ${locationsCreated} 个写入完成。正在写入场景（${generated.scenes.length} 个）…`,
      });

      let scenesCreated = 0;

      for (const scene of generated.scenes) {
        const resolvedLocationTsid = locTsids[scene.locationIndex] ?? null;
        if (!resolvedLocationTsid) {
          const message = `Scene "${scene.title}" references locationIndex ${scene.locationIndex} which failed to persist or is out of range.`;
          console.error("[bootstrap]", { workId, phase: "scenes", message });
          errors.push({ phase: "scenes", message });
          continue;
        }

        const resolvedCharacterTsids = scene.characterIndices
          .map((i) => charTsids[i])
          .filter((tsid): tsid is string => tsid !== null && tsid !== undefined);

        const tsid = generateTsid("scene");
        const { error } = await supabase.from("scenes").insert({
          work_id: workId,
          tsid,
          title: scene.title,
          chapter_number: scene.chapter_number,
          chapter_title: scene.chapter_title ?? null,
          order_index: 0,
          summary: scene.summary,
          tags: [],
          story_images_v2: [{ url: "", caption: scene.imageCaption }],
          location_id: resolvedLocationTsid,
          character_ids: resolvedCharacterTsids,
        });

        if (error) {
          const message = error.message;
          console.error("[bootstrap]", { workId, phase: "scenes", message });
          errors.push({ phase: "scenes", message });
        } else {
          scenesCreated += 1;
        }
      }

      finish({
        success: errors.length === 0,
        charactersCreated,
        locationsCreated,
        scenesCreated,
        errors,
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
