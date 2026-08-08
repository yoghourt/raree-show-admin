/**
 * IMPLEMENT-SCC-001-L2-B — Display aggregate: Story-related cast/place
 * = union of child Scene Context / Editorial Scene appearance·location refs.
 *
 * Display only — does NOT write Route character_ids / location_id (L2-A).
 */

import type { AcceptedSceneCandidateStaging } from "@/lib/discovery/review-types";
import {
  findExistingByName,
  normalizeEntityName,
} from "@/lib/discovery/entity-catalog-match";
import type {
  RendererExpression,
  VisualIntent,
} from "@/lib/discovery/visual-contract";
import type { SceneContextArchiveCatalog } from "@/lib/scene-context/associate";
import type { SceneContextRecord } from "@/lib/scene-context/types";

export type StoryRelatedCharacterCue = {
  name: string;
  archiveTsid?: string;
  role?: string;
};

export type StoryRelatedLocationCue = {
  label: string;
  archiveTsid?: string;
};

export type StoryRelatedAggregate = {
  characters: StoryRelatedCharacterCue[];
  locations: StoryRelatedLocationCue[];
};

export type AggregateSceneSource = {
  visualIntent?: VisualIntent | null;
  rendererExpression?: RendererExpression | null;
};

function emptyAggregate(): StoryRelatedAggregate {
  return { characters: [], locations: [] };
}

function addCharacter(
  map: Map<string, StoryRelatedCharacterCue>,
  name: string,
  extras?: { archiveTsid?: string; role?: string }
): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const key = normalizeEntityName(trimmed);
  if (!key) return;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      name: trimmed,
      ...(extras?.archiveTsid ? { archiveTsid: extras.archiveTsid } : {}),
      ...(extras?.role ? { role: extras.role } : {}),
    });
    return;
  }
  if (!existing.archiveTsid && extras?.archiveTsid) {
    existing.archiveTsid = extras.archiveTsid;
  }
  if (!existing.role && extras?.role) {
    existing.role = extras.role;
  }
}

function addLocation(
  map: Map<string, StoryRelatedLocationCue>,
  label: string,
  archiveTsid?: string
): void {
  const trimmed = label.trim();
  if (!trimmed) return;
  const key = normalizeEntityName(trimmed);
  if (!key) return;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      label: trimmed,
      ...(archiveTsid ? { archiveTsid } : {}),
    });
    return;
  }
  if (!existing.archiveTsid && archiveTsid) {
    existing.archiveTsid = archiveTsid;
  }
}

function collectFromSceneSource(
  source: AggregateSceneSource,
  characters: Map<string, StoryRelatedCharacterCue>,
  locations: Map<string, StoryRelatedLocationCue>,
  archive?: SceneContextArchiveCatalog
): void {
  const intent = source.visualIntent ?? null;
  const expr = source.rendererExpression ?? null;

  if (intent?.characters?.length) {
    for (const c of intent.characters) {
      const name = c.name?.trim();
      if (!name) continue;
      const matched = archive
        ? findExistingByName(name, archive.characters)
        : undefined;
      addCharacter(characters, name, {
        role: c.role,
        ...(matched ? { archiveTsid: matched.tsid } : {}),
      });
    }
  } else if (expr?.characters?.length) {
    for (const c of expr.characters) {
      const role = c.role?.trim();
      if (!role) continue;
      // Role-only cue when Intent has no names — still Story-scoped from this scene.
      addCharacter(characters, role, { role });
    }
  }

  const environment = expr?.environment?.trim() ?? "";
  if (environment) {
    const matched = archive
      ? findExistingByName(environment, archive.locations)
      : undefined;
    addLocation(locations, environment, matched?.tsid);
  }
}

/** Prefer Context records when present (post-Projection). */
export function aggregateStoryRelatedFromContexts(
  contexts: SceneContextRecord[],
  archive?: SceneContextArchiveCatalog
): StoryRelatedAggregate {
  const characters = new Map<string, StoryRelatedCharacterCue>();
  const locations = new Map<string, StoryRelatedLocationCue>();

  for (const ctx of contexts) {
    for (const appearance of ctx.characterAppearanceContext ?? []) {
      const name = appearance.name?.trim() || appearance.role?.trim() || "";
      if (!name) continue;
      const matched =
        appearance.archiveTsid ||
        (archive && appearance.name
          ? findExistingByName(appearance.name, archive.characters)?.tsid
          : undefined);
      addCharacter(characters, name, {
        role: appearance.role,
        ...(matched || appearance.archiveTsid
          ? { archiveTsid: appearance.archiveTsid ?? matched }
          : {}),
      });
    }
    const loc = ctx.locationContext;
    const label =
      loc.archiveName?.trim() || loc.environmentFromExpression?.trim() || "";
    if (label) {
      addLocation(locations, label, loc.archiveTsid);
    }
  }

  return {
    characters: [...characters.values()],
    locations: [...locations.values()],
  };
}

export function aggregateStoryRelatedFromSceneSources(
  sources: AggregateSceneSource[],
  archive?: SceneContextArchiveCatalog
): StoryRelatedAggregate {
  const characters = new Map<string, StoryRelatedCharacterCue>();
  const locations = new Map<string, StoryRelatedLocationCue>();
  for (const source of sources) {
    collectFromSceneSource(source, characters, locations, archive);
  }
  return {
    characters: [...characters.values()],
    locations: [...locations.values()],
  };
}

export function aggregateStoryRelatedFromSceneStagings(
  scenes: AcceptedSceneCandidateStaging[],
  archive?: SceneContextArchiveCatalog
): StoryRelatedAggregate {
  return aggregateStoryRelatedFromSceneSources(
    scenes.map((s) => ({
      visualIntent: s.visualIntent,
      rendererExpression: s.rendererExpression,
    })),
    archive
  );
}

/**
 * Display projection entry: Contexts win when non-empty; else child scene staging/sources.
 */
export function aggregateStoryRelatedRefs(input: {
  contexts?: SceneContextRecord[];
  sceneStagings?: AcceptedSceneCandidateStaging[];
  sceneSources?: AggregateSceneSource[];
  archive?: SceneContextArchiveCatalog;
}): StoryRelatedAggregate {
  const contexts = input.contexts ?? [];
  if (contexts.length > 0) {
    return aggregateStoryRelatedFromContexts(contexts, input.archive);
  }
  if (input.sceneStagings?.length) {
    return aggregateStoryRelatedFromSceneStagings(
      input.sceneStagings,
      input.archive
    );
  }
  if (input.sceneSources?.length) {
    return aggregateStoryRelatedFromSceneSources(
      input.sceneSources,
      input.archive
    );
  }
  return emptyAggregate();
}

export function formatStoryRelatedAggregateLine(
  aggregate: StoryRelatedAggregate,
  options?: { alreadyExistsLabel?: string }
): string | null {
  const exists = options?.alreadyExistsLabel;
  const parts = [
    ...aggregate.characters.map((c) =>
      c.archiveTsid && exists ? `${c.name}（${exists}）` : c.name
    ),
    ...aggregate.locations.map((l) =>
      l.archiveTsid && exists ? `${l.label}（${exists}）` : l.label
    ),
  ];
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function isStoryRelatedAggregateEmpty(
  aggregate: StoryRelatedAggregate
): boolean {
  return (
    aggregate.characters.length === 0 && aggregate.locations.length === 0
  );
}
