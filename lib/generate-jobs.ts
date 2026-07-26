import type { SupabaseClient } from "@supabase/supabase-js";

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

export async function listGenerateJobsForWork(
  workId: string,
  options?: { limit?: number; client?: SupabaseClient }
): Promise<GenerateJobRow[]> {
  const limit = options?.limit ?? 50;
  const client = options?.client ?? defaultSupabase;
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("work_id", workId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`list generate_jobs failed: ${error.message}`);
  }
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}
