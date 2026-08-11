/**
 * Patch Discovery scene staging cast/place so Scene Context association
 * (associateStagingToSceneContext) picks up operator edits at write time.
 */

import type { AcceptedSceneCandidateStaging } from "@/lib/discovery/review-types";
import {
  MINIMAL_RENDERER_EXPRESSION,
  type RendererExpression,
  type VisualIntent,
} from "@/lib/discovery/visual-contract";
import {
  aggregateStoryRelatedRefs,
  type StoryRelatedAggregate,
} from "@/lib/scene-context/aggregate-story-refs";

export type SceneStagingArchiveCatalog = {
  characters: Array<{ name: string; tsid: string }>;
  locations: Array<{ name: string; tsid: string }>;
};

export type FrameContextArchiveSelection = {
  characterTsids: string[];
  locationTsid: string;
  /** Discovery names not matched to Work Archive (shown as hint; cleared when picker changes). */
  unmatchedCastNames: string[];
  unmatchedLocationLabel: string | null;
  aggregate: StoryRelatedAggregate;
};

export function frameContextArchiveSelectionFromStaging(
  staging: AcceptedSceneCandidateStaging,
  archive?: SceneStagingArchiveCatalog
): FrameContextArchiveSelection {
  const aggregate = aggregateStoryRelatedRefs({
    sceneStagings: [staging],
    archive,
  });
  const characterTsids = [
    ...new Set(
      aggregate.characters
        .map((c) => c.archiveTsid?.trim())
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const unmatchedCastNames = aggregate.characters
    .filter((c) => !c.archiveTsid)
    .map((c) => c.name.trim())
    .filter(Boolean);
  const matchedLoc = aggregate.locations.find((l) => l.archiveTsid);
  const unmatchedLoc = aggregate.locations.find((l) => !l.archiveTsid);
  return {
    characterTsids,
    locationTsid: matchedLoc?.archiveTsid?.trim() ?? "",
    unmatchedCastNames,
    unmatchedLocationLabel: unmatchedLoc?.label?.trim() || null,
    aggregate,
  };
}

/** @deprecated Prefer frameContextArchiveSelectionFromStaging */
export function frameContextFieldsFromStaging(
  staging: AcceptedSceneCandidateStaging,
  archive?: SceneStagingArchiveCatalog
): {
  castNames: string;
  locationLabel: string;
  aggregate: StoryRelatedAggregate;
} {
  const sel = frameContextArchiveSelectionFromStaging(staging, archive);
  return {
    castNames: [
      ...sel.characterTsids.map(
        (id) => archive?.characters.find((c) => c.tsid === id)?.name ?? id
      ),
      ...sel.unmatchedCastNames,
    ].join("、"),
    locationLabel:
      (sel.locationTsid
        ? archive?.locations.find((l) => l.tsid === sel.locationTsid)?.name
        : null) ||
      sel.unmatchedLocationLabel ||
      "",
    aggregate: sel.aggregate,
  };
}

function preserveCharacterVisual(
  prev: RendererExpression | undefined,
  role: string
): string {
  const hit = prev?.characters?.find(
    (c) => c.role.trim().toLowerCase() === role.toLowerCase()
  );
  const visual = hit?.visual?.trim();
  return visual || "character present";
}

/**
 * Writes operator cast/place into Intent + Expression (Context projection inputs).
 * Does not touch Route membership fields.
 */
export function applySceneStagingContextEdits(
  staging: AcceptedSceneCandidateStaging,
  edits: {
    castNames: string[];
    locationLabel: string;
  }
): AcceptedSceneCandidateStaging {
  const castNames = edits.castNames.map((n) => n.trim()).filter(Boolean);
  const locationLabel = edits.locationLabel.trim();

  const prevExpr = staging.rendererExpression ?? {
    ...MINIMAL_RENDERER_EXPRESSION,
  };
  const prevIntent: VisualIntent = staging.visualIntent
    ? { ...staging.visualIntent }
    : {};

  const rendererExpression: RendererExpression = {
    ...prevExpr,
    environment: locationLabel || "unspecified place",
    characters: castNames.map((name) => ({
      role: name,
      visual: preserveCharacterVisual(prevExpr, name),
    })),
  };

  const visualIntent: VisualIntent = {
    ...prevIntent,
    characters: castNames.map((name) => ({ role: name, name })),
  };

  return {
    ...staging,
    visualIntent,
    rendererExpression,
  };
}

/** Resolve archive picks → names, then patch Intent/Expression. */
export function applySceneStagingContextEditsFromArchive(
  staging: AcceptedSceneCandidateStaging,
  edits: {
    characterTsids: string[];
    locationTsid: string | null;
    /** Optional Discovery names kept until operator changes cast picker */
    unmatchedCastNames?: string[];
    /**
     * Discovery environment cue when no archive location is selected.
     * When omitted, preserve existing Expression.environment (do not wipe).
     */
    unmatchedLocationLabel?: string | null;
  },
  archive: SceneStagingArchiveCatalog
): AcceptedSceneCandidateStaging {
  const castNames = [
    ...edits.characterTsids
      .map((id) => archive.characters.find((c) => c.tsid === id)?.name?.trim())
      .filter((n): n is string => Boolean(n)),
    ...(edits.unmatchedCastNames ?? [])
      .map((n) => n.trim())
      .filter(Boolean),
  ];
  let locationLabel = "";
  if (edits.locationTsid) {
    locationLabel =
      archive.locations.find((l) => l.tsid === edits.locationTsid)?.name?.trim() ||
      "";
  } else if (edits.unmatchedLocationLabel !== undefined) {
    locationLabel = edits.unmatchedLocationLabel?.trim() || "";
  } else {
    // Editing cast/title must not erase Discovery place cues.
    const prev = staging.rendererExpression?.environment?.trim() || "";
    locationLabel =
      prev && prev.toLowerCase() !== "unspecified place" ? prev : "";
  }
  return applySceneStagingContextEdits(staging, { castNames, locationLabel });
}
