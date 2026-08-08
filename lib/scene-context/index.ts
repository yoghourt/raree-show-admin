export {
  associateStagingToSceneContext,
  contextIdForEditorialScene,
  removeSceneContextBySourceReviewId,
  upsertSceneContext,
} from "@/lib/scene-context/associate";
export type { SceneContextArchiveCatalog } from "@/lib/scene-context/associate";
export {
  aggregateStoryRelatedFromContexts,
  aggregateStoryRelatedFromSceneStagings,
  aggregateStoryRelatedRefs,
  formatStoryRelatedAggregateLine,
  isStoryRelatedAggregateEmpty,
} from "@/lib/scene-context/aggregate-story-refs";
export type {
  AggregateSceneSource,
  StoryRelatedAggregate,
  StoryRelatedCharacterCue,
  StoryRelatedLocationCue,
} from "@/lib/scene-context/aggregate-story-refs";
export {
  getSceneContextWorkAllowlist,
  isSceneContextProjectionEnabledForWork,
  isSceneContextProjectionGloballyEnabled,
} from "@/lib/scene-context/feature-flag";
export { parseSceneContextsV1 } from "@/lib/scene-context/parse";
export { assertRuntimeTruthGate } from "@/lib/scene-context/runtime-truth-gate";
export type {
  SceneContextAppearance,
  SceneContextLocation,
  SceneContextRecord,
} from "@/lib/scene-context/types";
