/**
 * Deployment measurement helper — Z-Image prompt window vs this host.
 *
 *   npx tsx scripts/probe-z-image-prompt-budget.ts
 *
 * Does not generate images (Local CPU is too slow for a budget probe).
 * Records: LocalAI /v1/models reachability, official token window, char estimate.
 */

const OFFICIAL_DEFAULT_TOKENS = 512;
const OFFICIAL_LOCAL_TOKENS = 1024;
const LATIN_CHARS_PER_TOKEN = 4;
const CONSERVATIVE_MARGIN = 0.9;

function conservativeChars(tokens: number): number {
  return Math.floor(tokens * LATIN_CHARS_PER_TOKEN * CONSERVATIVE_MARGIN);
}

async function probeModels(baseUrl: string): Promise<{
  ok: boolean;
  ids: string[];
  error?: string;
}> {
  const url = `${baseUrl.replace(/\/$/, "")}/v1/models`;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return { ok: false, ids: [], error: `HTTP ${res.status}` };
    }
    const json = (await res.json()) as { data?: Array<{ id?: string }> };
    const ids = (json.data ?? [])
      .map((m) => m.id?.trim())
      .filter((id): id is string => Boolean(id));
    return { ok: true, ids };
  } catch (err) {
    return {
      ok: false,
      ids: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main(): Promise<void> {
  const base =
    process.env.IMAGE_CREATOR_LOCALAI_BASE?.trim() ||
    process.env.IMAGE_CREATOR_LOCAL_BASE?.trim() ||
    "http://127.0.0.1:8080";

  const probe = await probeModels(base);
  const hasZImage = probe.ids.some((id) => /z-image/i.test(id));

  const report = {
    host: base,
    reachable: probe.ok,
    models: probe.ids,
    hasZImage,
    error: probe.error ?? null,
    official: {
      defaultMaxSequenceTokens: OFFICIAL_DEFAULT_TOKENS,
      localPipelineMaxSequenceTokens: OFFICIAL_LOCAL_TOKENS,
      latinCharsPerTokenEstimate: LATIN_CHARS_PER_TOKEN,
      conservativeChars512: conservativeChars(OFFICIAL_DEFAULT_TOKENS),
      conservativeChars1024: conservativeChars(OFFICIAL_LOCAL_TOKENS),
    },
    hostYaml: {
      file: "~/.localai/models/Z-Image-Turbo.yaml",
      backend: "stablediffusion-ggml",
      textEncoder: "Qwen3-4B.Q4_K_M.gguf",
      contextSizeOverride: null,
      note: "LocalAI default context_size is 512 when unset. Treat host as 512-token window.",
    },
    tableRecommendation: {
      promptBodyMaxChars: conservativeChars(OFFICIAL_DEFAULT_TOKENS),
      sizeNote:
        "512² remains a CPU/draft knob (IMAGE_CREATOR_LOCALAI_MAX_EDGE). Native Z-Image examples are 1024².",
    },
  };

  console.info(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
