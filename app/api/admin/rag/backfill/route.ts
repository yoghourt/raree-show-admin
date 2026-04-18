import { NextResponse } from "next/server";
import { fetch, ProxyAgent, type Dispatcher } from "undici";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase-server";

/** 与 DB `vector(768)` 一致；见 https://ai.google.dev/gemini-api/docs/embeddings */
const EMBEDDING_MODEL = "gemini-embedding-001";
const OUTPUT_DIMENSIONALITY = 768;

const bodySchema = z.object({
  workId: z.string().uuid(),
  force: z.boolean().optional().default(false),
});

type SceneRow = {
  id: string;
  tsid: string;
  title: string | null;
  summary: string | null;
  story_images_v2: unknown;
  rag_embedding: unknown;
};

function buildRagText(row: SceneRow): string {
  const parts: string[] = [];
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (title) parts.push(title);
  const summary = typeof row.summary === "string" ? row.summary.trim() : "";
  if (summary) parts.push(summary);
  const raw = row.story_images_v2;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === "object" && "caption" in item) {
        const cap =
          typeof (item as { caption?: unknown }).caption === "string"
            ? (item as { caption: string }).caption.trim()
            : "";
        if (cap) parts.push(cap);
      }
    }
  }
  const joined = parts.join("\n\n").trim();
  return joined === "" ? "[empty scene]" : joined;
}

function shouldSkipEmbedding(
  force: boolean,
  ragEmbedding: unknown
): boolean {
  if (force) return false;
  return ragEmbedding != null;
}

/** 优先读专用变量，便于与其它进程的 HTTP_PROXY 区分开 */
function resolveHttpsProxyUrl(): string | undefined {
  const raw =
    process.env.GEMINI_HTTPS_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.https_proxy?.trim() ||
    process.env.ALL_PROXY?.trim() ||
    process.env.all_proxy?.trim();
  return raw || undefined;
}

type GeminiEmbedFetchInit = {
  dispatcher?: Dispatcher;
};

async function embedTextGeminiRest(
  apiKey: string,
  text: string,
  fetchInit: GeminiEmbedFetchInit | undefined
): Promise<number[]> {
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`
  );
  url.searchParams.set("key", apiKey);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: OUTPUT_DIMENSIONALITY,
    }),
    ...fetchInit,
  });

  const rawBody = await res.text();
  if (!res.ok) {
    throw new Error(
      `Gemini embed HTTP ${res.status}: ${rawBody.slice(0, 500)}`
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(rawBody) as unknown;
  } catch {
    throw new Error("Gemini embed: invalid JSON response");
  }

  const values =
    data &&
    typeof data === "object" &&
    "embedding" in data &&
    data.embedding &&
    typeof data.embedding === "object" &&
    "values" in data.embedding &&
    Array.isArray((data as { embedding: { values?: unknown } }).embedding.values)
      ? (data as { embedding: { values: number[] } }).embedding.values
      : null;

  if (!values?.length) {
    throw new Error("Gemini embed: empty embedding.values");
  }

  if (values.length !== OUTPUT_DIMENSIONALITY) {
    throw new Error(
      `Gemini embed: expected ${OUTPUT_DIMENSIONALITY} dims, got ${values.length}`
    );
  }

  return values;
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server" },
      { status: 503 }
    );
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

  const { workId, force } = parsed.data;

  const { data: rows, error: fetchError } = await supabase
    .from("scenes")
    .select("id, tsid, title, summary, story_images_v2, rag_embedding")
    .eq("work_id", workId);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const all = (rows ?? []) as SceneRow[];

  let skipped = 0;
  const toProcess: SceneRow[] = [];
  for (const row of all) {
    if (shouldSkipEmbedding(force, row.rag_embedding)) {
      skipped += 1;
    } else {
      toProcess.push(row);
    }
  }

  const proxyUrl = resolveHttpsProxyUrl();
  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
  const fetchInit: GeminiEmbedFetchInit | undefined = dispatcher
    ? { dispatcher }
    : undefined;

  let success = 0;
  let failure = 0;
  const errors: { tsid: string; message: string }[] = [];

  try {
    for (const row of toProcess) {
      const ragText = buildRagText(row);
      try {
        const values = await embedTextGeminiRest(
          apiKey.trim(),
          ragText,
          fetchInit
        );

        const { error: updateError } = await supabase
          .from("scenes")
          .update({
            rag_text: ragText,
            rag_embedding: values,
          })
          .eq("id", row.id);

        if (updateError) {
          failure += 1;
          errors.push({ tsid: row.tsid, message: updateError.message });
        } else {
          success += 1;
        }
      } catch (e) {
        failure += 1;
        const message = e instanceof Error ? e.message : String(e);
        errors.push({ tsid: row.tsid, message });
      }
    }
  } finally {
    await dispatcher?.close();
  }

  const processed = toProcess.length;

  return NextResponse.json({
    totalScenes: all.length,
    skipped,
    processed,
    success,
    failure,
    errors,
  });
}
