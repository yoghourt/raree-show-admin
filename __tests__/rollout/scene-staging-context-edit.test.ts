import { describe, expect, it } from "vitest";

import type { AcceptedSceneCandidateStaging } from "@/lib/discovery/review-types";
import {
  applySceneStagingContextEdits,
  applySceneStagingContextEditsFromArchive,
  frameContextArchiveSelectionFromStaging,
} from "@/lib/rollout/scene-staging-context-edit";

const base: AcceptedSceneCandidateStaging = {
  workId: "work-1",
  sourceReviewId: "rev-scene-1",
  parentStorySourceReviewId: "rev-story-1",
  chapter_number: 1,
  title: "门外",
  acceptedAt: "2026-08-11T00:00:00.000Z",
  visualIntent: {
    characters: [
      { role: "Jon", name: "琼恩" },
      { role: "watcher", name: "守夜人" },
    ],
  },
  rendererExpression: {
    environment: "长城",
    characters: [
      { role: "琼恩", visual: "cloaked" },
      { role: "守夜人", visual: "figure" },
    ],
    action: "standing",
    composition: "wide view",
  },
};

const archive = {
  characters: [
    { name: "琼恩", tsid: "char_jon" },
    { name: "山姆", tsid: "char_sam" },
  ],
  locations: [
    { name: "长城", tsid: "loc_wall" },
    { name: "临冬城", tsid: "loc_winterfell" },
  ],
};

describe("scene-staging-context-edit", () => {
  it("selects matched archive tsids and reports unmatched names", () => {
    const sel = frameContextArchiveSelectionFromStaging(base, archive);
    expect(sel.characterTsids).toEqual(["char_jon"]);
    expect(sel.locationTsid).toBe("loc_wall");
    expect(sel.unmatchedCastNames).toEqual(["守夜人"]);
  });

  it("soft-matches descriptive environment to archive location", () => {
    const staging = {
      ...base,
      rendererExpression: {
        ...base.rendererExpression!,
        environment: "临冬城院落，雪地，城门在后",
      },
    };
    const sel = frameContextArchiveSelectionFromStaging(staging, archive);
    expect(sel.locationTsid).toBe("loc_winterfell");
    expect(sel.unmatchedLocationLabel).toBeNull();
  });

  it("applies archive picker edits onto Intent + Expression", () => {
    const next = applySceneStagingContextEditsFromArchive(
      base,
      {
        characterTsids: ["char_jon", "char_sam"],
        locationTsid: "loc_winterfell",
      },
      archive
    );
    expect(next.visualIntent?.characters).toEqual([
      { role: "琼恩", name: "琼恩" },
      { role: "山姆", name: "山姆" },
    ]);
    expect(next.rendererExpression?.environment).toBe("临冬城");
  });

  it("preserves Discovery environment when archive location is not selected", () => {
    const next = applySceneStagingContextEditsFromArchive(
      base,
      {
        characterTsids: ["char_jon"],
        locationTsid: null,
        unmatchedCastNames: ["守夜人"],
      },
      archive
    );
    expect(next.rendererExpression?.environment).toBe("长城");
  });

  it("preserves visual when role name is kept", () => {
    const next = applySceneStagingContextEdits(base, {
      castNames: ["琼恩"],
      locationLabel: "临冬城",
    });
    expect(next.rendererExpression?.characters[0]?.visual).toBe("cloaked");
  });
});
