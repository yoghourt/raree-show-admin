/**
 * IMPLEMENT-SCC-001-S1 — associate + Runtime Truth Gate + feature flag
 */

import { describe, expect, it } from "vitest";

import {
  associateStagingToSceneContext,
  upsertSceneContext,
} from "@/lib/scene-context/associate";
import {
  getSceneContextWorkAllowlist,
  isSceneContextProjectionEnabledForWork,
  isSceneContextProjectionGloballyEnabled,
} from "@/lib/scene-context/feature-flag";
import { parseSceneContextsV1 } from "@/lib/scene-context/parse";
import { assertRuntimeTruthGate } from "@/lib/scene-context/runtime-truth-gate";
import type { AcceptedSceneCandidateStaging } from "@/lib/discovery/review-types";

const staging: AcceptedSceneCandidateStaging = {
  workId: "work-1",
  sourceReviewId: "rev-scene-1",
  parentStorySourceReviewId: "rev-story-1",
  parentStoryTitle: "Arc",
  chapter_number: 1,
  chapter_title: "I",
  title: "Moonlit Farewell",
  summary: "Fantine holds Cosette before parting.",
  visualIntent: {
    characters: [
      { role: "mother", name: "Fantine" },
      { role: "child", name: "Cosette" },
    ],
    emotion: "tender dread",
    purpose: "cost of survival",
    relationship: "mother parting from child",
  },
  rendererExpression: {
    environment: "narrow Paris street at night",
    characters: [
      { role: "mother", visual: "thin woman in worn shawl" },
      { role: "child", visual: "small child clutched to chest" },
    ],
    action: "holding the child tightly",
    composition: "medium wide shot",
  },
  acceptedAt: "2026-08-08T00:00:00.000Z",
};

describe("feature flag", () => {
  it("defaults off", () => {
    expect(isSceneContextProjectionGloballyEnabled({})).toBe(false);
    expect(isSceneContextProjectionEnabledForWork("work-1", {})).toBe(false);
  });

  it("enables globally and respects allowlist", () => {
    const env = {
      SCENE_CONTEXT_PROJECTION_ENABLED: "1",
      SCENE_CONTEXT_WORK_ALLOWLIST: "work-a, work-b",
    };
    expect(isSceneContextProjectionGloballyEnabled(env)).toBe(true);
    expect(isSceneContextProjectionEnabledForWork("work-a", env)).toBe(true);
    expect(isSceneContextProjectionEnabledForWork("work-c", env)).toBe(false);
    expect(getSceneContextWorkAllowlist(env)?.has("work-b")).toBe(true);
  });
});

describe("associateStagingToSceneContext", () => {
  it("builds Context ownership without Route archive fields", () => {
    const ctx = associateStagingToSceneContext(staging, {
      readingRouteTsid: "scene_route_1",
      frameIndex: 0,
      now: "2026-08-08T00:00:00.000Z",
    });

    expect(ctx.contextId).toBe("ctx_rev-scene-1");
    expect(ctx.editorialAssociation.editorialSceneSourceReviewId).toBe(
      "rev-scene-1"
    );
    expect(ctx.narrativeMoment.title).toBe("Moonlit Farewell");
    expect(ctx.characterAppearanceContext.map((c) => c.role)).toEqual([
      "mother",
      "child",
    ]);
    expect(ctx.locationContext.environmentFromExpression).toContain("Paris");
    expect(ctx.creationFacingVisualExpression?.action).toBe(
      "holding the child tightly"
    );
    expect(ctx.projectsToFrameIndex).toBe(0);
    expect(ctx.contextId).not.toBe("scene_route_1");
  });

  it("L2-A: enriches Context archive refs from Work catalog by name (not Route)", () => {
    const ctx = associateStagingToSceneContext(staging, {
      readingRouteTsid: "scene_route_1",
      frameIndex: 0,
      now: "2026-08-08T00:00:00.000Z",
      archive: {
        characters: [
          { name: "Fantine", tsid: "char_fantine" },
          { name: "Cosette", tsid: "char_cosette" },
          { name: "Javert", tsid: "char_javert" },
        ],
        locations: [
          { name: "narrow Paris street at night", tsid: "loc_paris_street" },
        ],
      },
    });

    expect(ctx.characterAppearanceContext.map((c) => c.archiveTsid)).toEqual([
      "char_fantine",
      "char_cosette",
    ]);
    expect(ctx.locationContext.archiveTsid).toBe("loc_paris_street");
    // Enrichment must not invent Route membership — associate has no characterIds
    expect(
      (ctx as { characterIds?: unknown }).characterIds
    ).toBeUndefined();
  });

  it("joins Intent.name to Expression.role when roles diverge (Discovery Rule 7)", () => {
    const rule7: AcceptedSceneCandidateStaging = {
      ...staging,
      visualIntent: {
        characters: [
          { role: "knight", name: "Ser Waymar Royce" },
          { role: "ranger", name: "Will" },
        ],
      },
      rendererExpression: {
        environment: "haunted forest",
        characters: [
          { role: "Ser Waymar Royce", visual: "black cloak" },
          { role: "Will", visual: "nervous ranger" },
        ],
        action: "watching",
        composition: "wide",
      },
    };
    const ctx = associateStagingToSceneContext(rule7, {
      readingRouteTsid: "scene_route_1",
      frameIndex: 0,
      now: "2026-08-08T00:00:00.000Z",
      archive: {
        characters: [
          { name: "Ser Waymar Royce", tsid: "char_waymar" },
          { name: "Will", tsid: "char_will" },
        ],
        locations: [{ name: "Haunted Forest", tsid: "loc_forest" }],
      },
    });
    expect(ctx.characterAppearanceContext.map((c) => c.archiveTsid)).toEqual([
      "char_waymar",
      "char_will",
    ]);
    expect(ctx.characterAppearanceContext.map((c) => c.name)).toEqual([
      "Ser Waymar Royce",
      "Will",
    ]);
    expect(ctx.locationContext.archiveTsid).toBe("loc_forest");
  });

  it("matches archive from Expression.role alone when Intent names missing", () => {
    const exprOnly: AcceptedSceneCandidateStaging = {
      ...staging,
      visualIntent: null,
      rendererExpression: {
        environment: "Winterfell courtyard",
        characters: [{ role: "Arya Stark", visual: "small figure" }],
        action: "standing",
        composition: "medium",
      },
    };
    const ctx = associateStagingToSceneContext(exprOnly, {
      readingRouteTsid: "scene_route_1",
      frameIndex: 0,
      archive: {
        characters: [{ name: "Arya Stark", tsid: "char_arya" }],
        locations: [{ name: "Winterfell", tsid: "loc_winterfell" }],
      },
    });
    expect(ctx.characterAppearanceContext[0]?.archiveTsid).toBe("char_arya");
    expect(ctx.locationContext.archiveTsid).toBe("loc_winterfell");
  });

  it("upserts by editorial sourceReviewId", () => {
    const a = associateStagingToSceneContext(staging, {
      readingRouteTsid: "scene_route_1",
      frameIndex: 0,
      now: "2026-08-08T00:00:00.000Z",
    });
    const b = associateStagingToSceneContext(
      { ...staging, summary: "Updated beat." },
      {
        readingRouteTsid: "scene_route_1",
        frameIndex: 0,
        now: "2026-08-08T01:00:00.000Z",
      }
    );
    const list = upsertSceneContext(upsertSceneContext([], a), b);
    expect(list).toHaveLength(1);
    expect(list[0]?.readerFacingNarrativeContext.beatSummary).toBe(
      "Updated beat."
    );
    expect(list[0]?.createdAt).toBe("2026-08-08T00:00:00.000Z");
  });
});

describe("Runtime Truth Gate", () => {
  it("passes for Context → Frame representation-only projection", () => {
    const context = associateStagingToSceneContext(staging, {
      readingRouteTsid: "scene_route_1",
      frameIndex: 0,
    });
    const frame = {
      url: "",
      caption: context.readerFacingNarrativeContext.beatSummary,
    };
    const gate = assertRuntimeTruthGate({
      context,
      frame,
    });
    expect(gate.ok).toBe(true);
    expect(gate.failures).toEqual([]);
  });

  it("fails when Frame carries archive ownership fields", () => {
    const context = associateStagingToSceneContext(staging, {
      readingRouteTsid: "scene_route_1",
      frameIndex: 0,
    });
    const gate = assertRuntimeTruthGate({
      context,
      frame: {
        url: "",
        caption: "x",
        characterIds: ["char_1"],
      } as { url: string; caption: string },
    });
    expect(gate.ok).toBe(false);
    expect(gate.failures).toContain("frame_owns_archive_fields");
  });
});

describe("parseSceneContextsV1", () => {
  it("round-trips associate output", () => {
    const context = associateStagingToSceneContext(staging, {
      readingRouteTsid: "scene_route_1",
      frameIndex: 2,
    });
    const parsed = parseSceneContextsV1([context]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.contextId).toBe(context.contextId);
    expect(parsed[0]?.projectsToFrameIndex).toBe(2);
    expect(parsed[0]?.creationFacingVisualExpression?.environment).toBe(
      "narrow Paris street at night"
    );
  });
});
