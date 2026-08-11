import type { ReadingFrame } from "@/lib/types";

import type { GenerateJobRow } from "./index";
import { parseHostedImageResultReference } from "./resultReference";

/**
 * For empty Asset slots, take the latest succeeded scene_frame job URL
 * (jobs must already be ordered newest-first).
 */
export function collectEmptyFrameUrlPatchesFromJobs(input: {
  sceneTsid: string;
  frames: ReadingFrame[];
  jobs: GenerateJobRow[];
}): Array<{ frameIndex: number; url: string }> {
  const patches: Array<{ frameIndex: number; url: string }> = [];
  const claimed = new Set<number>();

  for (let frameIndex = 0; frameIndex < input.frames.length; frameIndex++) {
    const existing = input.frames[frameIndex]?.url?.trim();
    if (existing) continue;

    for (const job of input.jobs) {
      if (job.status !== "succeeded") continue;
      if (job.subject_type !== "scene") continue;
      if (job.subject_id !== input.sceneTsid) continue;
      if (job.input_json.asset_slot !== "scene_frame") continue;
      const jobFrame = job.input_json.frame_index;
      if (jobFrame !== frameIndex) continue;
      if (claimed.has(frameIndex)) continue;
      const hosted = parseHostedImageResultReference(job.result_reference);
      if (!hosted?.url) continue;
      patches.push({ frameIndex, url: hosted.url });
      claimed.add(frameIndex);
      break;
    }
  }

  return patches;
}
