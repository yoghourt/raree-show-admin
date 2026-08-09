/**
 * IMPLEMENT-SCC-001-L3-B — Work-scoped Scene Context backfill CLI.
 *
 * Default: dry-run (plan only). Pass --apply to write scene_contexts_v1.
 *
 * Usage:
 *   npx tsx scripts/scene-context-backfill/run.ts --workId=<uuid>
 *   npx tsx scripts/scene-context-backfill/run.ts --workId=<uuid> --routeTsid=scene_xxx --apply
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (see createSupabaseServiceClient).
 * Optional: SCENE_CONTEXT_WORK_ALLOWLIST — when set, workId must be listed unless --force.
 */

import { loadEnvLocal } from "../load-env-local";

loadEnvLocal();

import {
  planSceneContextBackfill,
  type BackfillPlan,
} from "@/lib/scene-context/backfill-from-provenance";
import { getSceneContextWorkAllowlist } from "@/lib/scene-context/feature-flag";
import {
  getSceneRowWithContextsByTsid,
  listSceneRowsWithContextsForWork,
  replaceSceneContextsOnly,
  type SceneRowWithProvenance,
} from "@/lib/rollout/scenes-server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import type { SupabaseClient } from "@supabase/supabase-js";

async function loadArchive(workId: string, supabase: SupabaseClient) {
  const [charactersRes, locationsRes] = await Promise.all([
    supabase.from("characters").select("name, tsid").eq("work_id", workId),
    supabase.from("locations").select("name, tsid").eq("work_id", workId),
  ]);
  return {
    characters: (charactersRes.data ?? []) as Array<{
      name: string;
      tsid: string;
    }>,
    locations: (locationsRes.data ?? []) as Array<{
      name: string;
      tsid: string;
    }>,
  };
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length).trim() || undefined;
  const idx = process.argv.indexOf(`--${name}`);
  if (
    idx >= 0 &&
    process.argv[idx + 1] &&
    !process.argv[idx + 1]!.startsWith("--")
  ) {
    return process.argv[idx + 1]!.trim();
  }
  return undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function summarizePlan(plan: BackfillPlan): void {
  console.log(
    JSON.stringify(
      {
        readingRouteTsid: plan.readingRouteTsid,
        existingCount: plan.existingCount,
        addedCount: plan.addedCount,
        skippedCount: plan.skippedCount,
        actions: plan.actions.map((a) =>
          a.kind === "skip"
            ? {
                kind: a.kind,
                sourceReviewId: a.sourceReviewId,
                frameIndex: a.frameIndex,
                reason: a.reason,
              }
            : {
                kind: a.kind,
                sourceReviewId: a.sourceReviewId,
                frameIndex: a.frameIndex,
                reason: a.reason,
                contextId: a.context.contextId,
                appearance: a.context.characterAppearanceContext.map(
                  (c) => c.name || c.role
                ),
              }
        ),
      },
      null,
      2
    )
  );
}

async function main(): Promise<void> {
  const workId = argValue("workId");
  if (!workId) {
    console.error(
      "Usage: npx tsx scripts/scene-context-backfill/run.ts --workId=<uuid> [--routeTsid=...] [--apply] [--force]"
    );
    process.exit(1);
  }

  const apply = hasFlag("apply");
  const force = hasFlag("force");
  const routeTsid = argValue("routeTsid");

  const allow = getSceneContextWorkAllowlist();
  if (allow && !allow.has(workId) && !force) {
    console.error(
      `workId ${workId} not in SCENE_CONTEXT_WORK_ALLOWLIST (use --force to override)`
    );
    process.exit(1);
  }

  const supabase = createSupabaseServiceClient();
  const archive = await loadArchive(workId, supabase);

  let rows: SceneRowWithProvenance[];
  if (routeTsid) {
    const one = await getSceneRowWithContextsByTsid(
      supabase,
      workId,
      routeTsid
    );
    if (!one) {
      console.error(`Route not found: ${routeTsid}`);
      process.exit(1);
    }
    rows = [one];
  } else {
    rows = await listSceneRowsWithContextsForWork(supabase, workId);
  }

  console.log(
    `[l3b-backfill] mode=${apply ? "APPLY" : "DRY-RUN"} workId=${workId} routes=${rows.length}`
  );

  let totalAdded = 0;
  for (const row of rows) {
    const plan = planSceneContextBackfill({
      workId,
      route: row,
      archive,
    });
    summarizePlan(plan);
    totalAdded += plan.addedCount;

    if (apply && plan.addedCount > 0) {
      await replaceSceneContextsOnly(
        supabase,
        workId,
        row.tsid,
        plan.nextContexts
      );
      console.log(`[l3b-backfill] wrote scene_contexts_v1 for ${row.tsid}`);
    }
  }

  console.log(
    `[l3b-backfill] done totalAdded=${totalAdded}${apply ? " (applied)" : " (dry-run; pass --apply to write)"}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
