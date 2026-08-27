import { beforeEach, describe, expect, it, vi } from "vitest";

import { descriptionWithArchiveAppearance } from "@/lib/discovery/portrait-appearance";
import {
  saveDiscoveryReviewSnapshot,
  type DiscoveryReviewSnapshot,
} from "@/lib/discovery/review-session-storage";
import type { DiscoverySession } from "@/lib/discovery/types";
import { readerFacingCharacterDescription } from "@/lib/prompts/avatar";

function stubSessionStorage() {
  const store = new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
  vi.stubGlobal("sessionStorage", sessionStorage);
}

const session: DiscoverySession = {
  sessionId: "sess-1",
  workId: "work-1",
  operatorId: "op-1",
  state: "review_pending",
  narrative: {
    excerpts: [{ text: "Guan Yu swears brotherhood.", orderIndex: 0 }],
    operatorSummary: null,
    inputMode: "excerpt_bundle",
  },
  lockedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

describe("descriptionWithArchiveAppearance", () => {
  beforeEach(() => {
    stubSessionStorage();
  });

  it("folds snapshot archive cues into description by character name", () => {
    const snapshot: DiscoveryReviewSnapshot = {
      sessionId: "sess-1",
      workId: "work-1",
      operatorId: "op-1",
      session,
      candidates: [
        {
          candidateId: "c1",
          candidateType: "character",
          workId: "work-1",
          displayName: "Guan Yu",
          summary: "Sworn brother",
          fields: {
            name: "Guan Yu",
            house: "Shu",
            description: "Sworn brother of Liu Bei.",
            characterArchive: {
              identityCues: ["red face"],
              costumeCues: ["green battle robe"],
              propCues: ["Green Dragon Crescent Blade"],
            },
          },
        },
      ],
      reviewItems: [],
      acceptedStoryUnits: [],
      acceptedSceneCandidates: [],
      savedAt: new Date().toISOString(),
    };
    saveDiscoveryReviewSnapshot(snapshot);

    const next = descriptionWithArchiveAppearance(
      "work-1",
      "Guan Yu",
      "Sworn brother of Liu Bei."
    );
    expect(next).toMatch(/\[视觉身份\]/);
    expect(next).toContain("green battle robe");
    expect(next).toContain("Sworn brother of Liu Bei.");
    expect(readerFacingCharacterDescription(next)).toBe(
      "Sworn brother of Liu Bei."
    );
  });
});
