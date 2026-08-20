/**
 * SPIKE-DISCOVERY-SCENE-001 — dump current Runtime rows (read-only).
 *
 *   npx tsx scripts/discovery-scene-spike/dump-runtime.ts
 *
 * Does not write to DB. Evidence JSON is gitignored under results/.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "../load-env-local";

loadEnvLocal();

import { createSupabaseServiceClient } from "@/lib/supabase-service";

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(SPIKE_DIR, "results");

async function main(): Promise<void> {
  const sb = createSupabaseServiceClient();

  const works = await sb
    .from("works")
    .select("id, tsid, title, description, created_at")
    .order("created_at", { ascending: false });
  if (works.error) throw new Error(works.error.message);

  const scenes = await sb
    .from("scenes")
    .select(
      "work_id, tsid, title, chapter_number, chapter_title, order_index, summary, story_images_v2, discovery_source_review_id, frame_provenance_v1, scene_contexts_v1, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (scenes.error) throw new Error(scenes.error.message);

  const characters = await sb
    .from("characters")
    .select("work_id, tsid, name, house, description")
    .limit(400);
  if (characters.error) throw new Error(characters.error.message);

  const locations = await sb
    .from("locations")
    .select("work_id, tsid, name, region, description")
    .limit(400);
  if (locations.error) throw new Error(locations.error.message);

  const payload = {
    spike: "SPIKE-DISCOVERY-SCENE-001",
    dumpedAt: new Date().toISOString(),
    sceneContextProjectionEnabled:
      process.env.SCENE_CONTEXT_PROJECTION_ENABLED ?? null,
    works: works.data ?? [],
    scenes: scenes.data ?? [],
    characters: characters.data ?? [],
    locations: locations.data ?? [],
  };

  await mkdir(RESULTS_DIR, { recursive: true });
  const outPath = path.join(RESULTS_DIR, "runtime-dump.json");
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`);

  console.log(`works=${payload.works.length}`);
  for (const w of payload.works) {
    const n = payload.scenes.filter((s) => s.work_id === w.id).length;
    console.log(`  ${w.id}  ${w.title}  scenes=${n}`);
  }
  console.log(`scenes=${payload.scenes.length}`);
  console.log(`characters=${payload.characters.length}`);
  console.log(`locations=${payload.locations.length}`);
  console.log(`wrote ${outPath}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
