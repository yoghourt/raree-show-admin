/**
 * SPIKE-IMG-003 + CPP-C — Local Worker for generate_jobs.
 *
 * Drain queued jobs:
 *   npx tsx scripts/local-generate-worker.ts
 *
 * Single job:
 *   npx tsx scripts/local-generate-worker.ts --once
 *
 * Loop:
 *   WORKER_POLL_MS=5000 npx tsx scripts/local-generate-worker.ts --loop
 *
 * macOS chime + Notification Center when a run finishes (opt-in):
 *   WORKER_NOTIFY=1
 *
 * Requires `.env.local`: SUPABASE_SERVICE_ROLE_KEY, LocalAI / image Deployment,
 * Cloudinary unsigned preset (same as Admin). Does NOT write Assets.
 */

import { spawn } from "node:child_process";

import { loadEnvLocal } from "./load-env-local";

loadEnvLocal();

import {
  claimNextQueuedJob,
  completeGenerateJob,
  failGenerateJob,
  parseCharacterPortraitJobInput,
  parseSceneFrameJobInput,
} from "../lib/generate-jobs";
import { executeImageGenerateJob } from "../lib/generate-jobs/executeImageGenerate";
import { workVisualConventionFromRow } from "../lib/prompts/work-visual-convention";
import { createSupabaseServiceClient } from "../lib/supabase-service";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function workerNotifyEnabled(): boolean {
  const raw = (process.env.WORKER_NOTIFY ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function runDetached(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "ignore" });
    const timer = setTimeout(() => {
      child.kill();
      resolve();
    }, timeoutMs);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    child.once("close", done);
    child.once("error", done);
  });
}

/**
 * macOS only. afplay still sounds if Notification Center is muted;
 * osascript banner has no extra sound name (avoid a double chime).
 */
async function notifyWorker(input: {
  title: string;
  body: string;
  sound: "Glass" | "Basso";
}): Promise<void> {
  if (!workerNotifyEnabled()) return;
  if (process.platform !== "darwin") {
    console.info("[local-generate-worker] notify skipped (not macOS)");
    return;
  }
  await Promise.all([
    runDetached(
      "afplay",
      [`/System/Library/Sounds/${input.sound}.aiff`],
      4000
    ),
    runDetached(
      "osascript",
      [
        "-e",
        "on run argv",
        "-e",
        "display notification (item 2 of argv) with title (item 1 of argv)",
        "-e",
        "end run",
        input.title,
        input.body,
      ],
      4000
    ),
  ]);
}

async function notifyJobOutcome(outcome: "ok" | "fail"): Promise<void> {
  await notifyWorker(
    outcome === "ok"
      ? {
          title: "Raree Generate",
          body: "本地出图完成",
          sound: "Glass",
        }
      : {
          title: "Raree Generate",
          body: "本地出图失败",
          sound: "Basso",
        }
  );
}

async function loadWorkVisualConvention(
  client: ReturnType<typeof createSupabaseServiceClient>,
  workId: string
): Promise<string> {
  if (!workId) return "";
  const { data, error } = await client
    .from("works")
    .select("visual_convention")
    .eq("id", workId)
    .maybeSingle();
  if (error || !data) return "";
  return workVisualConventionFromRow(data);
}

async function processOne(
  client: ReturnType<typeof createSupabaseServiceClient>
): Promise<"empty" | "ok" | "fail"> {
  const job = await claimNextQueuedJob(client);
  if (!job) return "empty";

  console.info("[local-generate-worker] claim", {
    id: job.id,
    workId: job.work_id,
    capabilityId: job.capability_id,
    subjectType: job.subject_type,
    subjectId: job.subject_id,
  });

  try {
    if (job.capability_id !== "image.generate") {
      throw new Error(`unsupported capability_id: ${job.capability_id}`);
    }

    let result;
    const workVisualConvention = await loadWorkVisualConvention(
      client,
      job.work_id
    );
    if (job.subject_type === "scene") {
      const sceneFrame = parseSceneFrameJobInput(job.input_json);
      result = await executeImageGenerateJob({
        capabilityId: job.capability_id,
        sceneFrame,
        workVisualConvention,
      });
    } else if (job.subject_type === "character") {
      const portrait = parseCharacterPortraitJobInput(job.input_json);
      result = await executeImageGenerateJob({
        capabilityId: job.capability_id,
        portrait,
        workVisualConvention,
      });
    } else {
      throw new Error(`unsupported subject_type: ${job.subject_type}`);
    }

    if (!result.ok) {
      console.warn("[local-generate-worker] fail", {
        id: job.id,
        message: result.message,
        durationMs: result.durationMs,
      });
      await failGenerateJob(job.id, result.message, client);
      return "fail";
    }

    await completeGenerateJob(job.id, result.resultReference, client);
    console.info("[local-generate-worker] complete", {
      id: job.id,
      durationMs: result.durationMs,
      usedFallback: result.usedFallback,
      url: result.url.slice(0, 80),
    });
    return "ok";
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[local-generate-worker] fail", { id: job.id, message });
    try {
      await failGenerateJob(job.id, message, client);
    } catch (failErr) {
      console.error("[local-generate-worker] failGenerateJob itself failed", {
        id: job.id,
        failErr: failErr instanceof Error ? failErr.message : String(failErr),
        original: message,
      });
    }
    return "fail";
  }
}

async function main(): Promise<void> {
  const once = process.argv.includes("--once");
  const loop = process.argv.includes("--loop");
  const pollMs = Math.max(
    1000,
    Number(process.env.WORKER_POLL_MS?.trim() || "5000") || 5000
  );

  const client = createSupabaseServiceClient();
  console.info("[local-generate-worker] start", {
    mode: loop ? "loop" : once ? "once" : "drain",
    pollMs: loop ? pollMs : null,
    notify: workerNotifyEnabled(),
  });

  if (loop) {
    for (;;) {
      const outcome = await processOne(client);
      if (outcome === "empty") {
        await sleep(pollMs);
        continue;
      }
      await notifyJobOutcome(outcome);
    }
  }

  if (once) {
    const outcome = await processOne(client);
    if (outcome === "empty") {
      console.info("[local-generate-worker] queue empty");
      return;
    }
    await notifyJobOutcome(outcome);
    return;
  }

  // drain — one chime when the queue is empty (not per job)
  let ok = 0;
  let fail = 0;
  for (;;) {
    const outcome = await processOne(client);
    if (outcome === "empty") break;
    if (outcome === "ok") ok += 1;
    else fail += 1;
  }
  const processed = ok + fail;
  console.info("[local-generate-worker] drain done", { processed, ok, fail });
  if (processed === 0) return;
  const body =
    fail === 0
      ? `本地出图完成（${ok} 条）`
      : ok === 0
        ? `本地出图失败（${fail} 条）`
        : `本地出图结束：成功 ${ok}，失败 ${fail}`;
  await notifyWorker({
    title: "Raree Generate",
    body,
    sound: fail > 0 && ok === 0 ? "Basso" : "Glass",
  });
}

main().catch((err) => {
  console.error("[local-generate-worker] FATAL", err);
  process.exit(1);
});
