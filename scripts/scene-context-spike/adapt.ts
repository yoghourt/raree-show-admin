/**
 * SPIKE-SCC-001 — Temporary Scene Context adapter (in-memory only).
 *
 * Validates ADR-012 / SPEC-SCC-001 ownership boundaries against existing
 * Discovery Scene Candidate → Frame projection shapes.
 *
 * MUST NOT be imported by production Admin/Web paths.
 */

export type VisualIntentCharacter = { role: string; name?: string }

export type VisualIntent = {
  characters?: VisualIntentCharacter[]
  relationship?: string | null
  emotion?: string
  purpose?: string
}

export type RendererExpressionCharacter = { role: string; visual: string }

export type RendererExpression = {
  environment: string
  characters: RendererExpressionCharacter[]
  action: string
  composition: string
  lighting?: string
  styleHints?: string
  atmosphere?: string
  threatPerception?: string
  visualEmphasis?: string
}

/** Editorial Scene staging shape (subset of AcceptedSceneCandidateStaging). */
export type EditorialSceneSource = {
  sourceReviewId: string
  parentStorySourceReviewId: string
  parentStoryTitle: string
  workId: string
  chapter_number: number
  chapter_title?: string | null
  title: string
  summary?: string | null
  visualIntent?: VisualIntent | null
  rendererExpression: RendererExpression
}

/** Work Archive refs — today often attached at Story→Route persist time. */
export type WorkArchiveHints = {
  characterArchiveRefs?: Array<{ tsid: string; name: string; roleHint?: string }>
  locationArchiveRef?: { tsid: string; name: string } | null
}

/** Temporary Runtime-authoritative Scene Context (spike representation). */
export type SpikeSceneContext = {
  contextId: string
  workId: string
  storyDeliveryHint: {
    parentStorySourceReviewId: string
    parentStoryTitle: string
  }
  editorialAssociation: {
    editorialSceneSourceReviewId: string
    associationKind: "editorial_scene_to_scene_context"
  }
  narrativeMoment: {
    title: string
    summary: string | null
    chapter_number: number
    chapter_title: string | null
  }
  characterAppearanceContext: Array<{
    role: string
    name?: string
    visual?: string
    archiveTsid?: string
  }>
  locationContext: {
    environmentFromExpression: string
    archiveTsid?: string
    archiveName?: string
  }
  creationFacingVisualExpression: RendererExpression
  readerFacingNarrativeContext: {
    beatSummary: string
    emotion?: string
    purpose?: string
    relationship?: string | null
  }
  /** Projection relation — not ownership transfer. */
  projectsToFrameIndex: number | null
}

/** Existing Runtime Frame Truth shape. */
export type SpikeReadingFrame = {
  url: string
  caption: string
}

/** Creator-only provenance (existing Hot Path analogue) — not Frame ownership. */
export type SpikeFrameProvenance = {
  sourceContextId: string
  editorialSceneSourceReviewId: string
  frameIndex: number
  rendererExpression: RendererExpression
  visualIntent: VisualIntent | null
}

/** Delivery container — must NOT receive narrative ownership from Context path. */
export type SpikeReadingRouteDelivery = {
  tsid: string
  title: string
  chapter_number: number
  story_images_v2: SpikeReadingFrame[]
  /** Legacy Route fields — spike proves Context path does not write these. */
  characterIds: string[]
  locationId: string | null
  frame_provenance_v1: SpikeFrameProvenance[]
}

export type OwnershipAudit = {
  contextOwns: {
    characterAppearanceContext: boolean
    locationContext: boolean
    narrativeMoment: boolean
    creationFacingVisualExpression: boolean
  }
  leakage: {
    routeReceivedCharacterIdsFromContext: boolean
    routeReceivedLocationIdFromContext: boolean
    frameOwnsNarrativeMeaning: boolean
    frameOwnsCharacterAppearance: boolean
    frameOwnsLocation: boolean
    storyContainerOwnsAppearance: boolean
  }
  identitySeparation: {
    editorialSceneNeSceneContext: boolean
    sceneContextNeReadingFrame: boolean
    sceneContextNeReadingRoute: boolean
    sceneContextNeStory: boolean
  }
}

export type ReaderCompatibilityView = {
  /** Existing Reader Truth */
  frames: SpikeReadingFrame[]
  /** Optional Context-scoped narrative overlay (not URL identity) */
  contextScopedNarrative: Array<{
    contextId: string
    frameIndex: number
    beatSummary: string
    characterAppearance: SpikeSceneContext["characterAppearanceContext"]
    locationContext: SpikeSceneContext["locationContext"]
  }>
}

function captionFromSource(source: EditorialSceneSource): string {
  const summary = source.summary?.trim()
  if (summary) return summary
  return source.title.trim()
}

function matchArchive(
  role: string,
  name: string | undefined,
  hints: WorkArchiveHints
): string | undefined {
  const refs = hints.characterArchiveRefs ?? []
  const byName = name
    ? refs.find((r) => r.name.toLowerCase() === name.toLowerCase())
    : undefined
  if (byName) return byName.tsid
  const byRole = refs.find(
    (r) => r.roleHint && r.roleHint.toLowerCase() === role.toLowerCase()
  )
  return byRole?.tsid
}

/**
 * Association: Editorial Scene source → temporary Scene Context.
 * Human acceptance is assumed already done for the staging fixture.
 */
export function associateEditorialSceneToContext(
  source: EditorialSceneSource,
  archiveHints: WorkArchiveHints = {},
  options?: { contextId?: string }
): SpikeSceneContext {
  const expr = source.rendererExpression
  const intent = source.visualIntent ?? null

  const appearance = expr.characters.map((c) => {
    const intentChar = intent?.characters?.find(
      (ic) => ic.role.toLowerCase() === c.role.toLowerCase()
    )
    const name = intentChar?.name
    return {
      role: c.role,
      name,
      visual: c.visual,
      archiveTsid: matchArchive(c.role, name, archiveHints),
    }
  })

  const loc = archiveHints.locationArchiveRef
  const beatSummary = captionFromSource(source)

  return {
    contextId: options?.contextId ?? `ctx_spike_${source.sourceReviewId}`,
    workId: source.workId,
    storyDeliveryHint: {
      parentStorySourceReviewId: source.parentStorySourceReviewId,
      parentStoryTitle: source.parentStoryTitle,
    },
    editorialAssociation: {
      editorialSceneSourceReviewId: source.sourceReviewId,
      associationKind: "editorial_scene_to_scene_context",
    },
    narrativeMoment: {
      title: source.title.trim(),
      summary: source.summary?.trim() || null,
      chapter_number: source.chapter_number,
      chapter_title: source.chapter_title?.trim() || null,
    },
    characterAppearanceContext: appearance,
    locationContext: {
      environmentFromExpression: expr.environment,
      archiveTsid: loc?.tsid,
      archiveName: loc?.name,
    },
    creationFacingVisualExpression: { ...expr, characters: [...expr.characters] },
    readerFacingNarrativeContext: {
      beatSummary,
      emotion: intent?.emotion,
      purpose: intent?.purpose,
      relationship: intent?.relationship ?? null,
    },
    projectsToFrameIndex: null,
  }
}

/**
 * Projection: Scene Context → Reading Frame (visual representation only).
 * Does not transfer narrative ownership into Frame.
 */
export function projectContextToFrame(
  context: SpikeSceneContext,
  route: SpikeReadingRouteDelivery,
  options?: { assetUrl?: string }
): {
  context: SpikeSceneContext
  route: SpikeReadingRouteDelivery
  frameIndex: number
  frame: SpikeReadingFrame
  provenance: SpikeFrameProvenance
} {
  const frameIndex = route.story_images_v2.length
  const frame: SpikeReadingFrame = {
    url: options?.assetUrl ?? "",
    caption: context.readerFacingNarrativeContext.beatSummary,
  }
  const provenance: SpikeFrameProvenance = {
    sourceContextId: context.contextId,
    editorialSceneSourceReviewId:
      context.editorialAssociation.editorialSceneSourceReviewId,
    frameIndex,
    rendererExpression: context.creationFacingVisualExpression,
    visualIntent: {
      characters: context.characterAppearanceContext.map((c) => ({
        role: c.role,
        name: c.name,
      })),
      relationship: context.readerFacingNarrativeContext.relationship,
      emotion: context.readerFacingNarrativeContext.emotion,
      purpose: context.readerFacingNarrativeContext.purpose,
    },
  }

  // Route remains delivery: append Frame + provenance only.
  // Explicitly do NOT write characterIds / locationId from Context.
  const nextRoute: SpikeReadingRouteDelivery = {
    ...route,
    story_images_v2: [...route.story_images_v2, frame],
    frame_provenance_v1: [...route.frame_provenance_v1, provenance],
    characterIds: [...route.characterIds],
    locationId: route.locationId,
  }

  const nextContext: SpikeSceneContext = {
    ...context,
    projectsToFrameIndex: frameIndex,
  }

  return { context: nextContext, route: nextRoute, frameIndex, frame, provenance }
}

export function auditOwnership(
  context: SpikeSceneContext,
  routeBefore: SpikeReadingRouteDelivery,
  routeAfter: SpikeReadingRouteDelivery,
  frame: SpikeReadingFrame
): OwnershipAudit {
  // Context path must not mutate Route character/location ownership fields.
  const characterIdsMutated =
    JSON.stringify(routeAfter.characterIds) !==
    JSON.stringify(routeBefore.characterIds)
  const locationMutated = routeAfter.locationId !== routeBefore.locationId

  const frameKeys = Object.keys(frame).sort()
  const frameIsRepresentationOnly =
    frameKeys.length === 2 &&
    frameKeys[0] === "caption" &&
    frameKeys[1] === "url"

  return {
    contextOwns: {
      characterAppearanceContext:
        context.characterAppearanceContext.length > 0 ||
        !!context.creationFacingVisualExpression.characters.length,
      locationContext: !!context.locationContext.environmentFromExpression,
      narrativeMoment:
        !!context.narrativeMoment.title &&
        !!context.readerFacingNarrativeContext.beatSummary,
      creationFacingVisualExpression:
        !!context.creationFacingVisualExpression.environment &&
        !!context.creationFacingVisualExpression.action,
    },
    leakage: {
      routeReceivedCharacterIdsFromContext: characterIdsMutated,
      routeReceivedLocationIdFromContext: locationMutated,
      // caption may carry reader-facing text copied from Context; Frame still
      // does not own character/location/appearance fields as structured ownership.
      frameOwnsNarrativeMeaning: !frameIsRepresentationOnly,
      frameOwnsCharacterAppearance: "characterIds" in (frame as object),
      frameOwnsLocation: "locationId" in (frame as object),
      storyContainerOwnsAppearance: false,
    },
    identitySeparation: {
      editorialSceneNeSceneContext:
        context.editorialAssociation.editorialSceneSourceReviewId !==
        context.contextId,
      sceneContextNeReadingFrame:
        context.contextId !== `frame:${context.projectsToFrameIndex}`,
      sceneContextNeReadingRoute: context.contextId !== routeAfter.tsid,
      sceneContextNeStory:
        context.contextId !==
        context.storyDeliveryHint.parentStorySourceReviewId,
    },
  }
}

/** Reader compatibility: Frame Truth + optional Context overlay (no Reader code change). */
export function buildReaderCompatibilityView(
  route: SpikeReadingRouteDelivery,
  contexts: SpikeSceneContext[]
): ReaderCompatibilityView {
  return {
    frames: route.story_images_v2.map((f) => ({ ...f })),
    contextScopedNarrative: contexts
      .filter((c) => c.projectsToFrameIndex != null)
      .map((c) => ({
        contextId: c.contextId,
        frameIndex: c.projectsToFrameIndex as number,
        beatSummary: c.readerFacingNarrativeContext.beatSummary,
        characterAppearance: c.characterAppearanceContext,
        locationContext: c.locationContext,
      })),
  }
}

export function assertSpikeInvariants(
  audit: OwnershipAudit
): { ok: boolean; failures: string[] } {
  const failures: string[] = []
  for (const [k, v] of Object.entries(audit.contextOwns)) {
    if (!v) failures.push(`context_missing:${k}`)
  }
  for (const [k, v] of Object.entries(audit.leakage)) {
    if (v) failures.push(`ownership_leak:${k}`)
  }
  for (const [k, v] of Object.entries(audit.identitySeparation)) {
    if (!v) failures.push(`identity_collapse:${k}`)
  }
  return { ok: failures.length === 0, failures }
}
