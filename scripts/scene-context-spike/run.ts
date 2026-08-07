/**
 * SPIKE-SCC-001 — Minimal Runtime Materialization Validation
 *
 * Pure in-memory path:
 *   Editorial Scene Source → Scene Context Adapter → Frame Projection → Evidence
 *
 * Does NOT touch DB, schema, Admin UI, Web URL, or production rollout modules.
 *
 *   npx tsx scripts/scene-context-spike/run.ts
 */

import { mkdir, writeFile } from "node:fs/promises"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  associateEditorialSceneToContext,
  assertSpikeInvariants,
  auditOwnership,
  buildReaderCompatibilityView,
  projectContextToFrame,
  type EditorialSceneSource,
  type OwnershipAudit,
  type SpikeReadingRouteDelivery,
  type SpikeSceneContext,
  type WorkArchiveHints,
} from "./adapt"

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url))
const RESULTS_DIR = path.join(SPIKE_DIR, "results")

type Fixtures = {
  spikeId: string
  workId: string
  readingRouteDelivery: SpikeReadingRouteDelivery
  workArchiveHints: WorkArchiveHints
  editorialSceneSources: EditorialSceneSource[]
}

type CaseResult = {
  sourceReviewId: string
  contextId: string
  frameIndex: number
  audit: OwnershipAudit
  invariants: { ok: boolean; failures: string[] }
  frame: { url: string; caption: string }
}

async function main(): Promise<void> {
  const fixtures = JSON.parse(
    readFileSync(path.join(SPIKE_DIR, "fixtures.json"), "utf8")
  ) as Fixtures

  let route: SpikeReadingRouteDelivery = {
    ...fixtures.readingRouteDelivery,
    story_images_v2: [...fixtures.readingRouteDelivery.story_images_v2],
    characterIds: [...fixtures.readingRouteDelivery.characterIds],
    frame_provenance_v1: [...fixtures.readingRouteDelivery.frame_provenance_v1],
  }

  const contexts: SpikeSceneContext[] = []
  const cases: CaseResult[] = []

  console.info("[SPIKE-SCC-001] start", {
    spikeId: fixtures.spikeId,
    workId: fixtures.workId,
    sources: fixtures.editorialSceneSources.length,
  })

  for (const source of fixtures.editorialSceneSources) {
    const routeBefore = structuredClone(route)

    // 1) association → temporary Scene Context
    const context0 = associateEditorialSceneToContext(
      source,
      fixtures.workArchiveHints
    )

    // 2) projection → existing Frame shape on Route delivery
    const projected = projectContextToFrame(context0, route, {
      assetUrl: `https://spike.local/assets/${source.sourceReviewId}.jpg`,
    })
    route = projected.route
    contexts.push(projected.context)

    const audit = auditOwnership(
      projected.context,
      routeBefore,
      projected.route,
      projected.frame
    )
    const invariants = assertSpikeInvariants(audit)

    cases.push({
      sourceReviewId: source.sourceReviewId,
      contextId: projected.context.contextId,
      frameIndex: projected.frameIndex,
      audit,
      invariants,
      frame: projected.frame,
    })

    console.info("[SPIKE-SCC-001] case", {
      sourceReviewId: source.sourceReviewId,
      contextId: projected.context.contextId,
      frameIndex: projected.frameIndex,
      ok: invariants.ok,
      failures: invariants.failures,
    })
  }

  const readerView = buildReaderCompatibilityView(route, contexts)

  // Route delivery contraction check: after Context path, Route still empty of narrative ownership fields
  const routeRemainsDeliveryOnly =
    route.characterIds.length === 0 && route.locationId == null

  const allOk = cases.every((c) => c.invariants.ok) && routeRemainsDeliveryOnly

  const evidence = {
    spikeId: fixtures.spikeId,
    ranAt: new Date().toISOString(),
    status: allOk ? "PASS" : "FAIL",
    path: {
      input: "EditorialSceneSource (Discovery Scene Candidate staging shape)",
      association: "associateEditorialSceneToContext → SpikeSceneContext",
      projection: "projectContextToFrame → ReadingFrame {url,caption}",
      delivery: "Reading Route holds Frames as delivery container only",
      output: "Runtime evidence JSON + ReaderCompatibilityView",
    },
    questions: {
      Q1_sceneContextExpressesNarrativeMoment: cases.every(
        (c) => c.audit.contextOwns.narrativeMoment
      ),
      Q2_frameRemainsRepresentationOnly: cases.every(
        (c) =>
          !c.audit.leakage.frameOwnsNarrativeMeaning &&
          !c.audit.leakage.frameOwnsCharacterAppearance &&
          !c.audit.leakage.frameOwnsLocation
      ),
      Q3_routeContractsToDeliveryProjection: routeRemainsDeliveryOnly,
      Q4_blockers: [] as Array<{
        class: "Contract gap" | "Runtime gap" | "Data gap" | "Migration risk"
        note: string
      }>,
    },
    cases,
    finalRoute: {
      tsid: route.tsid,
      title: route.title,
      frameCount: route.story_images_v2.length,
      characterIds: route.characterIds,
      locationId: route.locationId,
      frames: route.story_images_v2,
      provenanceCount: route.frame_provenance_v1.length,
    },
    contexts: contexts.map((c) => ({
      contextId: c.contextId,
      editorialAssociation: c.editorialAssociation,
      narrativeMoment: c.narrativeMoment,
      characterAppearanceContext: c.characterAppearanceContext,
      locationContext: c.locationContext,
      readerFacingNarrativeContext: c.readerFacingNarrativeContext,
      projectsToFrameIndex: c.projectsToFrameIndex,
      expressionEnvironment: c.creationFacingVisualExpression.environment,
    })),
    readerCompatibilityView: readerView,
  }

  // Known gaps for Q4 (informational; do not fail ownership proof)
  evidence.questions.Q4_blockers.push(
    {
      class: "Runtime gap",
      note: "Production Hot Path still writes Expression into frame_provenance_v1 without an intermediate Scene Context layer.",
    },
    {
      class: "Data gap",
      note: "Discovery Scene Candidate has no Archive FK fields; Archive refs today arrive via Story→Route persist (character_ids/location_id on Route).",
    },
    {
      class: "Migration risk",
      note: "Legacy Route-held character_ids/location_id remain production Reality until a later sunset authorization; spike did not remove them.",
    },
    {
      class: "Contract gap",
      note: "SPEC-ROL-001 Implemented operator path still describes Scene staging→Frame; semantic rematerialization through Context is Accepted in ROL-002 v1.2 but not operationalized.",
    }
  )

  await mkdir(RESULTS_DIR, { recursive: true })
  const outPath = path.join(RESULTS_DIR, "evidence.json")
  await writeFile(outPath, `${JSON.stringify(evidence, null, 2)}\n`)

  console.info("[SPIKE-SCC-001] complete", {
    status: evidence.status,
    outPath,
    Q1: evidence.questions.Q1_sceneContextExpressesNarrativeMoment,
    Q2: evidence.questions.Q2_frameRemainsRepresentationOnly,
    Q3: evidence.questions.Q3_routeContractsToDeliveryProjection,
    blockerCount: evidence.questions.Q4_blockers.length,
  })

  if (!allOk) process.exitCode = 1
}

main().catch((err) => {
  console.error("[SPIKE-SCC-001] fatal", err)
  process.exitCode = 1
})
