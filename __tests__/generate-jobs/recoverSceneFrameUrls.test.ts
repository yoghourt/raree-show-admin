import { describe, expect, it } from "vitest";

import { collectEmptyFrameUrlPatchesFromJobs } from "@/lib/generate-jobs/recoverSceneFrameUrls";
import type { GenerateJobRow } from "@/lib/generate-jobs";
import { buildHostedImageResultReference } from "@/lib/generate-jobs/resultReference";

function job(partial: Partial<GenerateJobRow> & Pick<GenerateJobRow, "id">): GenerateJobRow {
  return {
    work_id: "w",
    capability_id: "image.generate",
    subject_type: "scene",
    subject_id: "scene_1",
    input_json: { asset_slot: "scene_frame", frame_index: 0, caption: "c" },
    status: "succeeded",
    result_reference: buildHostedImageResultReference({
      url: "https://res.example/a.png",
      mimeType: "image/png",
      capabilityId: "image.generate",
      usedFallback: false,
    }),
    error: null,
    created_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    started_at: null,
    finished_at: null,
    ...partial,
  };
}

describe("collectEmptyFrameUrlPatchesFromJobs", () => {
  it("fills empty frames from newest succeeded job per index", () => {
    const patches = collectEmptyFrameUrlPatchesFromJobs({
      sceneTsid: "scene_1",
      frames: [
        { url: "", caption: "a" },
        { url: "https://keep.me/x.png", caption: "b" },
        { url: "", caption: "c" },
      ],
      jobs: [
        job({
          id: "j2",
          input_json: {
            asset_slot: "scene_frame",
            frame_index: 2,
            caption: "c",
          },
          result_reference: buildHostedImageResultReference({
            url: "https://res.example/frame2.png",
            mimeType: "image/png",
            capabilityId: "image.generate",
            usedFallback: false,
          }),
        }),
        job({
          id: "j0",
          input_json: {
            asset_slot: "scene_frame",
            frame_index: 0,
            caption: "a",
          },
        }),
      ],
    });

    expect(patches).toEqual([
      { frameIndex: 0, url: "https://res.example/a.png" },
      { frameIndex: 2, url: "https://res.example/frame2.png" },
    ]);
  });

  it("skips frames that already have Asset urls", () => {
    const patches = collectEmptyFrameUrlPatchesFromJobs({
      sceneTsid: "scene_1",
      frames: [{ url: "https://asset/x.png", caption: "a" }],
      jobs: [job({ id: "j0" })],
    });
    expect(patches).toEqual([]);
  });
});
