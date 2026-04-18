import { NextResponse } from "next/server";
import { fetch, ProxyAgent, type Dispatcher } from "undici";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase-server";

/** 与 `app/api/admin/rag/backfill/route.ts` 及 DB `vector(768)` 保持一致 */
const EMBEDDING_MODEL = "gemini-embedding-001";
const OUTPUT_DIMENSIONALITY = 768;

const bodySchema = z.object({
  query: z.string().min(1, "query is required"),
  workId: z.string().uuid("workId must be a valid UUID"),
  matchCount: z.number().int().positive().max(50).optional().default(5),
});

type GeminiEmbedFetchInit = {
  dispatcher?: Dispatcher;
};

type MatchScenesRpcRow = {
  tsid: string;
  title: string | null;
  similarity: number;
};

function resolveHttpsProxyUrl(): string | undefined {
  const raw =
    process.env.GEMINI_HTTPS_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.https_proxy?.trim() ||
    process.env.ALL_PROXY?.trim() ||
    process.env.all_proxy?.trim();
  return raw || undefined;
}

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

function normalizeRpcRows(raw: unknown): MatchScenesRpcRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: MatchScenesRpcRow[] = [];
  for (const row of raw) {
    if (
      row &&
      typeof row === "object" &&
      "tsid" in row &&
      typeof (row as { tsid: unknown }).tsid === "string"
    ) {
      const r = row as {
        tsid: string;
        title?: unknown;
        similarity?: unknown;
      };
      const sim =
        typeof r.similarity === "number"
          ? r.similarity
          : typeof r.similarity === "string"
            ? Number.parseFloat(r.similarity)
            : NaN;
      out.push({
        tsid: r.tsid,
        title: typeof r.title === "string" ? r.title : null,
        similarity: Number.isFinite(sim) ? sim : 0,
      });
    }
  }
  return out;
}

export async function POST(request: Request) {
  const started = Date.now();
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
    const msg = parsed.error.flatten();
    return NextResponse.json(
      { error: msg.fieldErrors, formErrors: msg.formErrors },
      { status: 400 }
    );
  }

  const { query, workId, matchCount } = parsed.data;
  const proxyUrl = resolveHttpsProxyUrl();
  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
  const fetchInit: GeminiEmbedFetchInit | undefined = dispatcher
    ? { dispatcher }
    : undefined;

  try {
    let queryEmbedding: number[];
    try {
      queryEmbedding = await embedTextGeminiRest(
        apiKey.trim(),
        query.trim(),
        fetchInit
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: `Embedding failed: ${message}` },
        { status: 500 }
      );
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "match_scenes",
      {
        query_embedding: queryEmbedding,
        work_id_filter: workId,
        match_count: matchCount,
      }
    );

    if (rpcError) {
      return NextResponse.json(
        { error: rpcError.message, details: rpcError },
        { status: 500 }
      );
    }

    const rows = normalizeRpcRows(rpcData);
    const results = rows.map((r) => ({
      tsid: r.tsid,
      title: r.title ?? "",
      similarity: r.similarity,
    }));

    const durationMs = Date.now() - started;

    if (results.length > 0) {
      const top = results[0];
      console.log(
        "[RAG search]",
        query.trim(),
        "→ top:",
        top.tsid,
        "similarity:",
        top.similarity
      );
    } else {
      console.log("[RAG search]", query.trim(), "→ no results");
    }

    return NextResponse.json({
      query: query.trim(),
      results,
      durationMs,
    });
  } finally {
    await dispatcher?.close();
  }
}
