import type { SupabaseClient } from "@supabase/supabase-js";

import type { FrameProvenanceEntry } from "@/lib/rollout/scenes-server";

export type FrameWriteStatus =
  | "ok"
  | "frame_write_rejected"
  | "stale_frame_structure"
  | "frame_structure_invariant";

const STATUS_MESSAGE: Record<Exclude<FrameWriteStatus, "ok">, string> = {
  frame_write_rejected: "无法写入画面结构。",
  stale_frame_structure: "画面结构已在其他会话中更新，请重新加载后再保存。",
  frame_structure_invariant: "画面身份不成立，已拒绝保存。",
};

export class FrameStructureWriteError extends Error {
  readonly status: Exclude<FrameWriteStatus, "ok">;

  constructor(status: Exclude<FrameWriteStatus, "ok">) {
    super(STATUS_MESSAGE[status]);
    this.name = "FrameStructureWriteError";
    this.status = status;
  }
}

export async function applySceneFrameStructure(
  supabase: SupabaseClient,
  args: {
    workId: string;
    sceneTsid: string;
    expected: unknown;
    storyImages: unknown;
    sceneContexts: unknown;
    provenance: unknown;
  }
): Promise<{ frameProvenance: FrameProvenanceEntry[] }> {
  const { data, error } = await supabase.rpc("apply_scene_frame_structure", {
    p_work_id: args.workId,
    p_scene_tsid: args.sceneTsid,
    p_expected: args.expected ?? [],
    p_story_images_v2: args.storyImages ?? [],
    p_scene_contexts_v1: args.sceneContexts ?? [],
    p_frame_provenance_v1: args.provenance ?? [],
  });

  if (error) {
    throw new Error(error.message);
  }

  const status =
    data && typeof data === "object" && "status" in data
      ? String((data as { status?: unknown }).status)
      : "";

  if (status === "ok") {
    const frameProvenance = (data as { frame_provenance_v1?: unknown })
      .frame_provenance_v1;
    return {
      frameProvenance: Array.isArray(frameProvenance)
        ? (frameProvenance as FrameProvenanceEntry[])
        : [],
    };
  }

  if (
    status === "frame_write_rejected" ||
    status === "stale_frame_structure" ||
    status === "frame_structure_invariant"
  ) {
    throw new FrameStructureWriteError(status);
  }

  throw new FrameStructureWriteError("frame_structure_invariant");
}
