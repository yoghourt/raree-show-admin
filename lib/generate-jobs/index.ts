import type { SupabaseClient } from "@supabase/supabase-js";

import type { RendererExpression } from "@/lib/discovery/visual-contract";
import { parseRendererExpression } from "@/lib/discovery/visual-contract";
import { supabase as defaultSupabase } from "@/lib/supabase";

const TABLE = "generate_jobs";

export type GenerateJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

/** Scene-frame generate intent carried in envelope input_json (not capability columns). */
export type SceneFrameJobInput = {
  asset_slot: "scene_frame";
  frame_index: number;
  caption: string;
  route_title?: string;
  /** Operator revision note at enqueue (display); also embedded in caption for prompt. */
  operator_revision?: string;
  /** SPEC-DVE-001 Expression — preferred prompt source when present. */
  renderer_expression?: RendererExpression;
  /**
   * Rule 6: allow restricted full-face Expression through Port.
   * Human Accept remains required — this is not auto-Accept.
   */
  face_safety_override?: boolean;
};

/** Character portrait generate intent (CPP-C). */
export type CharacterPortraitJobInput = {
  asset_slot: "portrait";
  name: string;
  description?: string;
  reference_url?: string;
  /** Operator revision note at enqueue (display); also embedded in description for prompt. */
  operator_revision?: string;
};

export type GenerateJobRow = {
  id: string;
  work_id: string;
  capability_id: string;
  subject_type: string;
  subject_id: string;
  input_json: Record<string, unknown>;
  status: GenerateJobStatus;
  result_reference: string | null;
  error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type EnqueueGenerateJobInput = {
  workId: string;
  capabilityId: string;
  subjectType: string;
  subjectId: string;
  inputJson: Record<string, unknown>;
  createdBy?: string | null;
};

function mapRow(raw: Record<string, unknown>): GenerateJobRow {
  const input = raw.input_json;
  return {
    id: String(raw.id),
    work_id: String(raw.work_id),
    capability_id: String(raw.capability_id),
    subject_type: String(raw.subject_type),
    subject_id: String(raw.subject_id),
    input_json:
      input != null && typeof input === "object" && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {},
    status: raw.status as GenerateJobStatus,
    result_reference:
      typeof raw.result_reference === "string" ? raw.result_reference : null,
    error: typeof raw.error === "string" ? raw.error : null,
    created_by: typeof raw.created_by === "string" ? raw.created_by : null,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
    started_at: typeof raw.started_at === "string" ? raw.started_at : null,
    finished_at: typeof raw.finished_at === "string" ? raw.finished_at : null,
  };
}

export function parseSceneFrameJobInput(
  inputJson: Record<string, unknown>
): SceneFrameJobInput {
  if (inputJson.asset_slot !== "scene_frame") {
    throw new Error(
      `expected input_json.asset_slot=scene_frame, got ${String(inputJson.asset_slot)}`
    );
  }
  const frameIndex = inputJson.frame_index;
  if (typeof frameIndex !== "number" || !Number.isInteger(frameIndex) || frameIndex < 0) {
    throw new Error("input_json.frame_index must be a non-negative integer");
  }
  const caption =
    typeof inputJson.caption === "string" ? inputJson.caption.trim() : "";
  if (!caption) {
    throw new Error("input_json.caption is required");
  }
  const routeTitleRaw = inputJson.route_title;
  const route_title =
    typeof routeTitleRaw === "string" && routeTitleRaw.trim()
      ? routeTitleRaw.trim()
      : undefined;
  const revisionRaw = inputJson.operator_revision;
  const operator_revision =
    typeof revisionRaw === "string" && revisionRaw.trim()
      ? revisionRaw.trim()
      : undefined;
  const exprParsed = parseRendererExpression(inputJson.renderer_expression);
  const renderer_expression = exprParsed.ok ? exprParsed.value : undefined;
  const face_safety_override = inputJson.face_safety_override === true;
  return {
    asset_slot: "scene_frame",
    frame_index: frameIndex,
    caption,
    ...(route_title ? { route_title } : {}),
    ...(operator_revision ? { operator_revision } : {}),
    ...(renderer_expression ? { renderer_expression } : {}),
    ...(face_safety_override ? { face_safety_override: true } : {}),
  };
}

/** Replace Expression on a scene_frame enqueue snapshot (queued jobs only). */
export function withSceneFrameRendererExpression(
  inputJson: Record<string, unknown>,
  expression: RendererExpression
): SceneFrameJobInput {
  const parsed = parseSceneFrameJobInput(inputJson);
  return {
    ...parsed,
    renderer_expression: expression,
  };
}

export function parseCharacterPortraitJobInput(
  inputJson: Record<string, unknown>
): CharacterPortraitJobInput {
  if (inputJson.asset_slot !== "portrait") {
    throw new Error(
      `expected input_json.asset_slot=portrait, got ${String(inputJson.asset_slot)}`
    );
  }
  const name = typeof inputJson.name === "string" ? inputJson.name.trim() : "";
  if (!name) {
    throw new Error("input_json.name is required");
  }
  const descriptionRaw = inputJson.description;
  const description =
    typeof descriptionRaw === "string" && descriptionRaw.trim()
      ? descriptionRaw.trim()
      : undefined;
  const referenceRaw = inputJson.reference_url;
  const reference_url =
    typeof referenceRaw === "string" &&
    (referenceRaw.startsWith("http://") || referenceRaw.startsWith("https://"))
      ? referenceRaw.trim()
      : undefined;
  const revisionRaw = inputJson.operator_revision;
  const operator_revision =
    typeof revisionRaw === "string" && revisionRaw.trim()
      ? revisionRaw.trim()
      : undefined;
  return {
    asset_slot: "portrait",
    name,
    ...(description ? { description } : {}),
    ...(reference_url ? { reference_url } : {}),
    ...(operator_revision ? { operator_revision } : {}),
  };
}

export async function enqueueGenerateJob(
  input: EnqueueGenerateJobInput,
  client: SupabaseClient = defaultSupabase
): Promise<GenerateJobRow> {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from(TABLE)
    .insert({
      work_id: input.workId,
      capability_id: input.capabilityId,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      input_json: input.inputJson,
      status: "queued",
      created_by: input.createdBy ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`enqueue generate_jobs failed: ${error.message}`);
  }
  return mapRow(data as Record<string, unknown>);
}

/**
 * Rewrite renderer_expression on a still-queued scene_frame job.
 * If the Worker already claimed the row, the status filter misses and this
 * throws so the operator can cancel/requeue instead.
 */
export async function patchQueuedSceneFrameRendererExpression(
  id: string,
  expression: RendererExpression,
  client: SupabaseClient = defaultSupabase
): Promise<GenerateJobRow> {
  const { data: row, error: fetchError } = await client
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(
      `load generate_jobs for Expression patch failed: ${fetchError.message}`
    );
  }
  if (!row) {
    throw new Error("任务不存在");
  }
  const current = mapRow(row as Record<string, unknown>);
  if (current.status !== "queued") {
    throw new Error(
      `任务已是 ${current.status}，无法改排队 Expression 快照`
    );
  }

  const nextInput = withSceneFrameRendererExpression(
    current.input_json,
    expression
  );
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await client
    .from(TABLE)
    .update({
      input_json: nextInput,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (updateError) {
    throw new Error(
      `patch queued generate_jobs Expression failed: ${updateError.message}`
    );
  }
  if (!updated) {
    throw new Error(
      "任务已开始生成，无法改 Expression。请等结束后重试，或取消后重新排队。"
    );
  }
  return mapRow(updated as Record<string, unknown>);
}

export async function listGenerateJobsForWork(
  workId: string,
  options?: {
    limit?: number;
    client?: SupabaseClient;
    /** Default false — cancelled (operator-discarded) jobs stay out of Admin lists */
    includeCancelled?: boolean;
  }
): Promise<GenerateJobRow[]> {
  const limit = options?.limit ?? 50;
  const client = options?.client ?? defaultSupabase;
  let query = client
    .from(TABLE)
    .select("*")
    .eq("work_id", workId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!options?.includeCancelled) {
    query = query.neq("status", "cancelled");
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`list generate_jobs failed: ${error.message}`);
  }
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}


/**
 * Claim oldest queued job: select then conditional update (single-worker safe).
 * Returns null when queue empty or lost the race.
 */
export async function claimNextQueuedJob(
  client: SupabaseClient
): Promise<GenerateJobRow | null> {
  const { data: candidates, error: selectError } = await client
    .from(TABLE)
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  if (selectError) {
    throw new Error(`claim select generate_jobs failed: ${selectError.message}`);
  }
  const candidate = candidates?.[0];
  if (!candidate) return null;

  const id = String((candidate as Record<string, unknown>).id);
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await client
    .from(TABLE)
    .update({
      status: "running",
      started_at: now,
      updated_at: now,
      error: null,
    })
    .eq("id", id)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (updateError) {
    throw new Error(`claim update generate_jobs failed: ${updateError.message}`);
  }
  if (!updated) return null;
  return mapRow(updated as Record<string, unknown>);
}

export async function completeGenerateJob(
  id: string,
  resultReference: string,
  client: SupabaseClient
): Promise<GenerateJobRow> {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from(TABLE)
    .update({
      status: "succeeded",
      result_reference: resultReference,
      error: null,
      finished_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "running")
    .select("*")
    .single();

  if (error) {
    throw new Error(`complete generate_jobs failed: ${error.message}`);
  }
  return mapRow(data as Record<string, unknown>);
}

export async function failGenerateJob(
  id: string,
  errorMessage: string,
  client: SupabaseClient
): Promise<GenerateJobRow> {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from(TABLE)
    .update({
      status: "failed",
      error: errorMessage.slice(0, 2000),
      finished_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .in("status", ["queued", "running"])
    .select("*")
    .single();

  if (error) {
    throw new Error(`fail generate_jobs failed: ${error.message}`);
  }
  return mapRow(data as Record<string, unknown>);
}

/**
 * Operator cancel/discard: hide a job from default Admin lists.
 * Allowed from queued|running (abort stuck Worker claim) or terminal succeeded|failed.
 * Does not touch Assets.
 */
export async function cancelGenerateJob(
  id: string,
  reason: string,
  client: SupabaseClient
): Promise<GenerateJobRow> {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from(TABLE)
    .update({
      status: "cancelled",
      error: reason.slice(0, 2000),
      finished_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .in("status", ["queued", "running", "succeeded", "failed"])
    .select("*")
    .single();

  if (error) {
    throw new Error(`cancel generate_jobs failed: ${error.message}`);
  }
  return mapRow(data as Record<string, unknown>);
}

export {
  buildHostedImageResultReference,
  parseHostedImageResultReference,
  type HostedImageResultReference,
} from "./resultReference";
