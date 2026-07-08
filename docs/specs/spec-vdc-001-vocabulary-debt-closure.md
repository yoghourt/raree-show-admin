# SPEC-VDC-001 — Runtime Vocabulary Debt Closure

**Status:** Accepted  
**Version:** v1.0  
**Date:** 2026-07-08  
**Owner:** Architect  
**Authority Chain:** Constitution → ADR-008 (Runtime Vocabulary Convergence) →
`governance/vocabulary/runtime-lexicon.md`  
**Scope:** All non-DB vocabulary debt across `raree-show-admin`, `raree-show-web`,
`raree-governance`, and the Discovery layer. TypeScript types, React components,
hooks, API routes, UI labels, UI copy strings, documentation annotations,
governance templates, and tests.  
**Supersedes:** `docs/specs/spec-xrm-001-cross-repo-vocabulary-migration.md`
in its entirety — all admin, governance, and web items from spec-xrm-001 are
absorbed and expanded here (see §15).

---

## Purpose

This SPEC operationalizes the Ubiquitous Language Policy declared in ADR-008
and closes all Runtime Vocabulary Debt that is not blocked by DB migration risk.

It defines:

1. Every rename target across all layers — the precise before/after identifier
   for each symbol that fails IP-01 (Inferability Principle).
2. The migration sequence — admin (Phases 0–5), web (W1–W3), Discovery (D1),
   and governance documentation (G1).
3. The Chinese localization register — canonical Chinese equivalents for all
   Runtime normative terms.
4. The inferability audit — confirming IP-01 satisfaction for every renamed
   identifier (VDC-INV-04).
5. Frozen symbols — DB identifiers deferred under the Alias Acceptance Rule.
6. Acceptance criteria — per-invariant checklists (VDC-INV-01 ~ VDC-INV-04).

---

## Out of Scope

Only the following are deferred, due to DB migration risk or topology
governance:

```
Database table name: scenes              (deferred — Alias Acceptance Rule; high migration cost)
DB column names: story_images_v2         (deferred — Alias Acceptance Rule; cost exceeds benefit)
Business ID prefix: scene_               (frozen — invalidates stored TSIDs if renamed)
Runtime Truth v1 topology changes        (topology is not vocabulary — ADR-004 governs)
Editorial Domain concept definitions     (Story / Character / Location — ADR-005 governs;
                                          normative in their own domain; no IP-01 failure)
```

Everything else — including Discovery candidate type naming, governance
documentation annotations, governance template synchronization, and web
vocabulary notices — is **in scope**.

---

## Normative Term Reference

All renamed identifiers map to the following normative terms from
`governance/vocabulary/runtime-lexicon.md`:

| ID | Normative Term | Legacy Alias | DB / Business Symbol (deferred/frozen) |
|----|----------------|--------------|----------------------------------------|
| RV-02 | Reading Route | Scene | `scenes` table; `scene_` TSID |
| RV-03 | Route Synopsis | summary | `scenes.summary` (acceptable alias — no change) |
| RV-04 | Reading Frame | Story Image | `story_images_v2` JSONB array |
| RV-05 | Frame Narrative | caption | `story_images_v2[].caption` (acceptable alias — no change) |
| RV-06 | Reader Step | slide / step index | — |
| RV-07 | Chapter Metadata | chapter_number, chapter_title | same (DB columns, directly inferable) |

---

## Deliverable 1 — Phase 0: Immediate (VDC-INV-03)

**Trigger:** SPEC acceptance. No dependency on later phases.

### P0-01 — UI label: `Story Sequence` → `Reading Frame`

| Attribute | Value |
|-----------|-------|
| File | `components/scenes/SceneForm.tsx` (admin) |
| Old | `<Label>Story Sequence</Label>` |
| New | `<Label>Reading Frame</Label>` |
| Chinese | `阅读帧` (see §13) |
| Invariant | VDC-INV-03 |
| Risk | None — UI string only |

---

## Deliverable 2 — Phase 1: Admin TypeScript Core Types

**Dependency:** None. Unblocks all downstream admin phases.

**Rule:** TypeScript **type names** are renamed. Field names that mirror DB
columns (`story_images_v2`, `summary`, `caption`) are **not** changed — they
remain identical to their DB column names.

### P1-01 — `type StoryImage` → `type ReadingFrame`

| File | `lib/types.ts` |
|------|----------------|
| Old | `export type StoryImage = { url: string; caption: string; }` |
| New | `export type ReadingFrame = { url: string; caption: string; }` |

**Dependents:** `lib/scenes.ts`, `lib/types.ts` (field ref), `components/scenes/SceneForm.tsx`, `lib/rollout/staging-mapper.ts`

### P1-02 — `type Scene` → `type ReadingRoute`

| File | `lib/types.ts` |
|------|----------------|
| Old | `export type Scene = { ...; story_images_v2: StoryImage[] \| null; ... }` |
| New | `export type ReadingRoute = { ...; story_images_v2: ReadingFrame[] \| null; ... }` |
| Note | Field name `story_images_v2` is **not** renamed (DB-mirroring) |

**Dependents:**

| File | Change |
|------|--------|
| `lib/scenes.ts` | `import type { Scene, StoryImage }` → `{ ReadingRoute, ReadingFrame }` |
| `lib/scenes.ts` | `type SceneRow` → `type ReadingRouteRow` |
| `lib/scenes.ts` | `function rowToScene(...)` → `rowToReadingRoute(...)` |
| `components/scenes/SceneForm.tsx` | import update |
| `lib/rollout/scene-projection.ts` | import update |
| `lib/rollout/staging-mapper.ts` | internal typed payload |
| `lib/rollout/types.ts` | all `Scene`-typed fields |

### Phase 1 — Inferability Audit

| Old | New | IP-01 ✓ |
|-----|-----|---------|
| `StoryImage` | `ReadingFrame` | ✓ "a frame used for reading" |
| `Scene` (type) | `ReadingRoute` | ✓ "a route for reading" |
| `rowToScene` | `rowToReadingRoute` | ✓ converts a row to a ReadingRoute |
| `SceneRow` | `ReadingRouteRow` | ✓ internal DB row type |

---

## Deliverable 3 — Phase 2: Admin Library and API Internal Symbols

**Dependency:** Phase 1 complete.

### P2-01 — `lib/rollout/types.ts` interface renames

| Old | New |
|-----|-----|
| `StorySceneProjectionLink` | `StoryReadingRouteProjectionLink` |
| `ProjectedSceneRecord` | `ProjectedReadingRouteRecord` |
| `sceneStaging` (field) | `readingRouteStaging` |
| `processedSceneReviewIds` | `processedReadingRouteReviewIds` |
| `dismissedSceneStaging` | `dismissedReadingRouteStaging` |
| `dismissedSceneReviewIds` | `dismissedReadingRouteReviewIds` |
| `projectedScenes` | `projectedReadingRoutes` |

### P2-02 — `lib/rollout/scene-projection.ts` file and exports

| Old | New |
|-----|-----|
| `lib/rollout/scene-projection.ts` | `lib/rollout/reading-route-projection.ts` |
| `SceneProjectionResult` | `ReadingRouteProjectionResult` |
| `insertScene(...)` (internal fn) | `insertReadingRoute(...)` |

DB query inside stays `FROM "scenes"` — table name is frozen.

**Dependents:** `lib/rollout/rollout-route-helpers.ts`, `app/api/admin/rollout/scene-projection/route.ts`, `app/api/admin/rollout/scene-projection/unproject/route.ts`

### P2-03 — API internal route path rename

| Old | New |
|-----|-----|
| `app/api/admin/rollout/scene-projection/` | `app/api/admin/rollout/reading-route-projection/` |
| `app/api/admin/rollout/scene-projection/unproject/` | `app/api/admin/rollout/reading-route-projection/unproject/` |

Internal admin routes only — no HTTP redirect required if all callers are updated atomically.

### P2-04 — App page route: `/scenes` → `/reading-routes`

| Old | New |
|-----|-----|
| `app/works/[workId]/scenes/page.tsx` | `app/works/[workId]/reading-routes/page.tsx` |
| `app/works/[workId]/scenes/new/page.tsx` | `app/works/[workId]/reading-routes/new/page.tsx` |
| `app/works/[workId]/scenes/[sceneId]/edit/page.tsx` | `app/works/[workId]/reading-routes/[readingRouteId]/edit/page.tsx` |

**HTTP redirect:** Add Next.js redirect in `next.config.ts` from
`/works/:workId/scenes/:rest*` → `/works/:workId/reading-routes/:rest*`.

**Dependents:** `lib/rollout/ui-copy.ts` href strings, `lib/rollout/rollout-route-helpers.ts`, all `Link`/`router.push()` calls referencing `/scenes`

### Phase 2 — Inferability Audit

| Old | New | IP-01 ✓ |
|-----|-----|---------|
| `StorySceneProjectionLink` | `StoryReadingRouteProjectionLink` | ✓ |
| `ProjectedSceneRecord` | `ProjectedReadingRouteRecord` | ✓ |
| `SceneProjectionResult` | `ReadingRouteProjectionResult` | ✓ |
| `scene-projection.ts` | `reading-route-projection.ts` | ✓ |
| `/scenes` | `/reading-routes` | ✓ |

---

## Deliverable 4 — Phase 3: Admin Component Names

**Dependency:** Phase 1 complete.

### P3-01 — `SceneForm` → `ReadingRouteForm`

| Old file | New file |
|----------|----------|
| `components/scenes/SceneForm.tsx` | `components/reading-routes/ReadingRouteForm.tsx` |

Directory: `components/scenes/` → `components/reading-routes/`

**Dependents:** `app/works/[workId]/reading-routes/[readingRouteId]/edit/page.tsx`, `app/works/[workId]/reading-routes/new/page.tsx`

### P3-02 — `SceneTable` → `ReadingRouteTable`

| Old file | New file |
|----------|----------|
| `components/scenes/SceneTable.tsx` | `components/reading-routes/ReadingRouteTable.tsx` |

**Dependents:** `app/works/[workId]/reading-routes/page.tsx`

**Note:** `MultiImageUploader.tsx` has no vocabulary debt — move to `components/reading-routes/` or `components/common/`.

### Phase 3 — Inferability Audit

| Old | New | IP-01 ✓ |
|-----|-----|---------|
| `SceneForm` | `ReadingRouteForm` | ✓ "a form for a Reading Route" |
| `SceneTable` | `ReadingRouteTable` | ✓ "a table of Reading Routes" |

---

## Deliverable 5 — Phase 4: i18n Foundation and UI Copy Migration

**Dependency:** Phase 2 complete.

### Phase 4a — i18n Foundation (prerequisite for 4b)

**Objective:** Extract all operator-facing UI strings into a centralized locale
module *before* making vocabulary changes. This ensures future
internationalization requires only adding locale files, not hunting hardcoded
strings across modules.

**Files to create:**

```
lib/
  locale/
    zh-CN.ts     ← Canonical Chinese strings, keyed by normative vocabulary
    index.ts     ← Locale accessor stub (swap for next-intl / react-i18next later)
    types.ts     ← Locale shape type (ensures all future locales are complete)
```

**`lib/locale/zh-CN.ts` — prescribed structure:**

```typescript
export const zhCN = {
  // Shared domain labels — used across features
  domain: {
    readingRoute:    '阅读路线',
    readingFrame:    '阅读帧',
    frameNarrative:  '帧叙述',
    routeSynopsis:   '路线摘要',
    readerStep:      '读者步进',
    chapterMetadata: '章节元数据',
    work:            '作品',
  },
  // Rollout workspace strings
  rollout: {
    stagingTitle:       '待投影阅读路线候选',
    noStaging:          '暂无待投影阅读路线候选',
    runtimeTitle:       '阅读路线',
    noRuntime:          '暂无阅读路线',
    editItem:           '编辑阅读路线',
    listItems:          '阅读路线列表',
    linksTitle:         'Story ↔ 阅读路线关联',
    noLinks:            '暂无 Story ↔ 阅读路线关联',
    projectCreate:      '创建阅读路线并投影',
    projectLink:        '关联已有阅读路线',
    dismissedTitle:     '已移出队列的阅读路线候选',
    noDismissed:        '暂无已移出的阅读路线候选',
    projectedTitle:     '已投影阅读路线候选',
    noProjected:        '暂无已投影阅读路线候选',
    associationBlocked: '存在阅读路线关联，请先解除全部关联后再取消持久化',
    linkItem:           '阅读路线',
    selectItem:         '选择阅读路线',
    confirmCreate:      '确认创建阅读路线',
    runtimeTab:         '阅读路线',
    nextStep:           '阅读路线',
  },
  // Discovery workspace strings
  discovery: {
    readingRouteCandidate: '阅读路线候选',
    storyCandidate:        '故事单元',
  },
} as const;

export type ZhCNLocale = typeof zhCN;
```

**`lib/locale/index.ts` — prescribed accessor:**

```typescript
import { zhCN, type ZhCNLocale } from './zh-CN';

// Single-locale stub. Replace zhCN with the output of next-intl / react-i18next
// when multi-locale support is needed; no call-site changes required.
export const messages: ZhCNLocale = zhCN;
```

**`lib/locale/types.ts` — shape contract:**

```typescript
import type { ZhCNLocale } from './zh-CN';
// Every future locale must satisfy this shape
export type AppLocale = ZhCNLocale;
```

**Key naming convention:**

- Namespace = feature layer (`domain`, `rollout`, `discovery`, …)
- Key = normative English concept in camelCase
- No locale string may appear outside `zh-CN.ts` (or future locale files)
- String interpolation values keep the same function signature as the current
  `ui-copy.ts` entry; the locale key holds the template string

### Phase 4b — `lib/rollout/ui-copy.ts` migration

Replace hardcoded Chinese strings with locale references:

```typescript
import { messages } from '@/lib/locale';

export const rolloutCopy = {
  runtimeScenesTitle: messages.rollout.runtimeTitle,
  noRuntimeScenes:    messages.rollout.noRuntime,
  // … all entries below
};
```

**P4-01 — `ui-copy.ts` key → locale path mapping:**

| `ui-copy.ts` key | Locale path | Resolved value |
|-----------------|-------------|----------------|
| `sceneStagingTitle` | `messages.rollout.stagingTitle` | `待投影阅读路线候选` |
| `runtimeScenesTitle` | `messages.rollout.runtimeTitle` | `阅读路线` |
| `noRuntimeScenes` | `messages.rollout.noRuntime` | `暂无阅读路线` |
| `goEditScene` | `messages.rollout.editItem` | `编辑阅读路线` |
| `goScenesList` | `messages.rollout.listItems` | `阅读路线列表` |
| `linksTitle` | `messages.rollout.linksTitle` | `Story ↔ 阅读路线关联` |
| `noSceneStaging` | `messages.rollout.noStaging` | `暂无待投影阅读路线候选` |
| `noLinks` | `messages.rollout.noLinks` | `暂无 Story ↔ 阅读路线关联` |
| `projectCreate` | `messages.rollout.projectCreate` | `创建阅读路线并投影` |
| `projectLink` | `messages.rollout.projectLink` | `关联已有阅读路线` |
| `dismissedSceneTitle` | `messages.rollout.dismissedTitle` | `已移出队列的阅读路线候选` |
| `noDismissedSceneStaging` | `messages.rollout.noDismissed` | `暂无已移出的阅读路线候选` |
| `projectedSceneTitle` | `messages.rollout.projectedTitle` | `已投影阅读路线候选` |
| `noProjectedScenes` | `messages.rollout.noProjected` | `暂无已投影阅读路线候选` |
| `unpersistStoryBlocked` | `messages.rollout.associationBlocked` | `存在阅读路线关联…` |
| `linkScene` / `selectScene` | `messages.rollout.linkItem` / `messages.rollout.selectItem` | `阅读路线` / `选择阅读路线` |
| `confirmCreateScene` | `messages.rollout.confirmCreate` | `确认创建阅读路线` |
| `tabRuntimeScenes` | `messages.rollout.runtimeTab` | `阅读路线` |
| `nextStepRuntimeScenes` | `messages.rollout.nextStep` | `阅读路线` |
| *(string-interpolation keys: `pageSubtitle`, `confirmCreateSceneDesc`, `workspaceDescription`, `flowHint*`, `confirmUnprojectScene`)* | Preserve function/template shape; replace inline string portions using `messages.domain.readingRoute` | — |

**Note:** `lib/discovery/ui-copy.ts` is updated in Phase D1 (§8), using the
same locale pattern:

```typescript
import { messages } from '@/lib/locale';
export const discoveryCopy = {
  readingRoute: messages.discovery.readingRouteCandidate,
  story:        messages.discovery.storyCandidate,
};
```

---

## Deliverable 6 — Phase 5: Admin Tests

Test updates are **co-migrated** with each phase PR — not a separate PR.

| Phase | Test files |
|-------|-----------|
| Phase 1 | `__tests__/rollout/staging-mapper.test.ts`, `__tests__/rollout/sync-discovery-staging.test.ts`, `__tests__/ai/field-registry.test.ts` |
| Phase 2 | `__tests__/rollout/rollout-routes.test.ts`, `__tests__/rollout/sync-discovery-staging.test.ts` |
| Phase D1 | `__tests__/discovery/propose-service.test.ts`, `__tests__/discovery/candidate-validate.test.ts` (if exists), `__tests__/discovery/propose-parse.test.ts` |

### Variable rename convention

| Old pattern | New pattern |
|-------------|-------------|
| `scene` holding a `Scene` object | `readingRoute` |
| `storyImage` / `storyImages` in test data | `readingFrame` / `readingFrames` |
| `SceneProjectionResult` type assertions | `ReadingRouteProjectionResult` |
| `"scene"` as Discovery candidate type string | `"readingRoute"` |

---

## Deliverable 7 — Web Phases (raree-show-web)

Web phases are independent of admin phases and may proceed in parallel.

Base path: `src/` relative to `raree-show-web` root.
Source inventory: `docs/specs/spec-xrm-001-cross-repo-vocabulary-migration.md §1.3`.

---

### Phase W1 — Web TypeScript Core Types

**Dependency:** None. Unblocks W2 and W3.

#### PW1-01 — `interface Scene` → `interface ReadingRoute`

| File | `src/lib/types.ts` |
|------|--------------------|
| Note | Field `story_images_v2` inside the type is **not** renamed (DB-mirroring) |

#### PW1-02 — `type StoryImage` → `type ReadingFrame`

| File | `src/lib/types.ts` |
|------|--------------------|

#### PW1-03 — `EffectiveStorySlide` → `EffectiveReadingFrame`

| File | `src/lib/story-images-v2.ts` |
|------|------------------------------|

#### PW1-04 — File rename: `story-images-v2.ts` → `reading-frames.ts`

| Old | `src/lib/story-images-v2.ts` |
|-----|-------------------------------|
| New | `src/lib/reading-frames.ts` |
| Note | File name mirrors DB column and fails IP-01 at module level |

**PW1 dependents:** All `src/components/raree/` files and any hooks/pages using `Scene` or `StoryImage` types.

### Phase W1 — Inferability Audit

| Old | New | IP-01 ✓ |
|-----|-----|---------|
| `Scene` (interface) | `ReadingRoute` | ✓ |
| `StoryImage` | `ReadingFrame` | ✓ |
| `EffectiveStorySlide` | `EffectiveReadingFrame` | ✓ "effective (resolved) Reading Frame" |
| `story-images-v2.ts` | `reading-frames.ts` | ✓ module name matches contents |

---

### Phase W2 — Web Hook and State Types

**Dependency:** Phase W1 complete.

#### PW2-01 — `useSceneAtomicNavigation` → `useReadingRouteNavigation`

| Old file | `src/components/raree/useSceneAtomicNavigation.ts` |
|----------|-----------------------------------------------------|
| New file | `src/components/raree/useReadingRouteNavigation.ts` |

#### PW2-02 — State/action types inside the hook

| Old | New |
|-----|-----|
| `SceneReadingState` | `ReadingRouteState` |
| `SceneReadingAction` | `ReadingRouteAction` |

**Dependents:** All components importing `useSceneAtomicNavigation`, `SceneReadingState`, `SceneReadingAction`.

### Phase W2 — Inferability Audit

| Old | New | IP-01 ✓ |
|-----|-----|---------|
| `useSceneAtomicNavigation` | `useReadingRouteNavigation` | ✓ hook for navigating a Reading Route |
| `SceneReadingState` | `ReadingRouteState` | ✓ |
| `SceneReadingAction` | `ReadingRouteAction` | ✓ |

---

### Phase W3 — Web Component Names

**Dependency:** W1 and W2 complete.

All files in `src/components/raree/`:

| Old file | New file | Old export | New export |
|----------|----------|------------|------------|
| `SceneExperience.tsx` | `ReadingRouteExperience.tsx` | `SceneExperience` | `ReadingRouteExperience` |
| `SceneAssistant.tsx` | `ReadingRouteAssistant.tsx` | `SceneAssistant` | `ReadingRouteAssistant` |
| `SceneNavButtons.tsx` | `ReadingRouteNavButtons.tsx` | `SceneNavButtons` | `ReadingRouteNavButtons` |
| `SceneNavControls.tsx` | `ReadingRouteNavControls.tsx` | `SceneNavControls` | `ReadingRouteNavControls` |
| `SceneRopes.tsx` | `ReadingRouteRopes.tsx` | `SceneRopes` | `ReadingRouteRopes` |
| `SceneTimeCard.tsx` | `ReadingRouteTimeCard.tsx` | `SceneTimeCard` | `ReadingRouteTimeCard` |
| `SceneSlide.tsx` | `ReadingFrameView.tsx` | `SceneSlide` | `ReadingFrameView` |

**`SceneSlide` → `ReadingFrameView`:** SceneSlide renders one step in the
`story_images_v2` sequence — one Reading Frame, not a Reading Route.
`ReadingFrameView` correctly expresses "a view that renders one Reading Frame."

**`CaptionDisplay.tsx` — no rename.** `caption` is an acceptable alias for
Frame Narrative (IP-01 satisfied).

### Phase W3 — Inferability Audit

| Old | New | IP-01 ✓ |
|-----|-----|---------|
| `SceneExperience` | `ReadingRouteExperience` | ✓ |
| `SceneAssistant` | `ReadingRouteAssistant` | ✓ |
| `SceneNavButtons` | `ReadingRouteNavButtons` | ✓ |
| `SceneNavControls` | `ReadingRouteNavControls` | ✓ |
| `SceneRopes` | `ReadingRouteRopes` | ✓ |
| `SceneTimeCard` | `ReadingRouteTimeCard` | ✓ |
| `SceneSlide` | `ReadingFrameView` | ✓ view renderer for one Reading Frame |

---

## Deliverable 8 — Phase D1: Discovery Layer

**Dependency:** None (parallel to admin phases).

The Discovery `scene` candidate type collides with the Runtime `Scene` alias
(RV-02). After renaming to `readingRoute`, the candidate type makes the
projection intent explicit and eliminates the collision.

**`story` candidate type — no rename required.** After `StoryImage` →
`ReadingFrame` (Phase 1 / W1), the only remaining "collision" for `story` is
with the Editorial Story concept — which is the **correct** domain meaning of
`story` in Discovery. IP-01 is satisfied: a newcomer reading `story` candidate
correctly infers "an Editorial Story candidate." No change needed.

### PD1-01 — `"scene"` → `"readingRoute"` in `DiscoveryCandidateType`

| File | Change |
|------|--------|
| `lib/discovery/propose-types.ts` | `"scene"` in `DiscoveryCandidateType` union → `"readingRoute"` |
| `lib/discovery/propose-service.ts` | string literals `"scene"`, `candidateType === "scene"`, `case "scene":` → `"readingRoute"` |
| `lib/discovery/propose-service.ts` | `REGISTRY_FIELD_HINTS` key: `scene:` → `readingRoute:` |
| `lib/discovery/propose-service.ts` | `TYPE_EXAMPLES` key: `scene:` → `readingRoute:` |
| `lib/discovery/propose-service.ts` | Mock data `case "scene":` → `case "readingRoute":` |
| `lib/discovery/propose-service.ts` | LLM prompt: update candidate type label from `scene` to `readingRoute` |
| `lib/discovery/candidate-validate.ts` | validation switch/guard for `"scene"` → `"readingRoute"` |
| `lib/discovery/ui-copy.ts` | rename key `scene:` → `readingRoute:`; replace hardcoded string with `messages.discovery.readingRouteCandidate` from `@/lib/locale` (requires Phase 4a complete) |
| `lib/discovery/normative-copy.ts` | if it references `"scene"` as a type key |
| `lib/discovery/constants.ts` | if it has a `SCENE` constant |
| `lib/rollout/staging-mapper.ts` | any guard that checks `candidateType === "scene"` |
| `lib/rollout/schemas.ts` | if `"scene"` appears in a Zod enum or literal |

### PD1-02 — LLM prompt update

The Discovery LLM prompt currently uses `scene` as a type identifier in XML
tags and JSON keys. Update all occurrences:

- XML tag `<scene>` → `<readingRoute>`
- JSON key `"scene"` in candidate type fields → `"readingRoute"`
- Narrative description in prompt: "scene candidates" → "reading route candidates"

### Phase D1 — Inferability Audit

| Old | New | IP-01 ✓ |
|-----|-----|---------|
| `"scene"` (Discovery candidate type) | `"readingRoute"` | ✓ "a candidate for a Reading Route" — makes projection intent explicit |
| `场景` (Discovery UI label) | `阅读路线` | ✓ canonical Chinese for Reading Route |
| `story` (Discovery candidate type) | unchanged | ✓ "a candidate for an Editorial Story" — correct domain meaning |

---

## Deliverable 9 — Phase G1: Documentation Annotations, Templates, and Web Vocabulary Notices

**Dependency:** None (parallel to all other phases). Documentation-only changes;
zero functional impact.

This phase absorbs items A-01 through A-15, G-01 through G-02, and W-01 through
W-04 from `docs/specs/spec-xrm-001-cross-repo-vocabulary-migration.md`, which
is superseded by this SPEC.

---

### PG1-A — Admin governance document annotations (raree-show-admin)

Inline alias annotations in ADR-004, ADR-007, and SPEC-ROL-001 where bare
`Scene` / `Story Images` appear in normative sections without annotation:

| # | File | Location | Change |
|---|------|----------|--------|
| A-01 | `docs/adr/004-source-of-canonical-truth.md` | L1897 | `Runtime Scene` → `Runtime Reading Route (implementation: Scene)` |
| A-02 | `docs/adr/004-source-of-canonical-truth.md` | L2065 | `Work → Scene → Story Images` → add `[legacy: implementation symbols]` note |
| A-03 | `docs/adr/004-source-of-canonical-truth.md` | L2086 | `Runtime Scene association` → `Runtime Reading Route (implementation: Scene) association` |
| A-04 | `docs/adr/004-source-of-canonical-truth.md` | L2263 | `Story ↔ Scene orthogonal` → `Story ↔ Reading Route orthogonal` |
| A-05 | `docs/adr/004-source-of-canonical-truth.md` | L1868 | `imageCaption` → `imageCaption (Deprecated)` |
| A-06 | `docs/adr/007-rollout-architecture.md` | L42–46 §What diagram | add `(normative: Reading Route / Reading Frame)` annotation |
| A-07 | `docs/adr/007-rollout-architecture.md` | L340 | `Runtime Scene records` → `Runtime Reading Route records (implementation: Scene)` |
| A-08 | `docs/adr/007-rollout-architecture.md` | L473 | `Story ↔ Scene orthogonal association model` → annotate `(implementation: Scene)` |
| A-09 | `docs/adr/007-rollout-architecture.md` | L494 | `Runtime Scene association` → annotate `(implementation: Scene)` |
| A-10 | `docs/specs/spec-rol-001-governed-projection.md` | §4.3 title | `Story ↔ Scene` → `Story ↔ Reading Route (implementation: Scene)` |
| A-11 | `docs/specs/spec-rol-001-governed-projection.md` | §4.4 title | `Scene Projection Accept outcomes` → `Reading Route Projection Accept outcomes (implementation: Scene)` |
| A-12 | `docs/specs/spec-rol-001-governed-projection.md` | §4.7.3 title | `Scene Projection Accept` → `Reading Route Projection Accept (implementation: Scene)` |
| A-13 | `docs/specs/spec-rol-001-governed-projection.md` | ROL-AC-01 | `Story↔Scene N:M association` → `Story↔Reading Route N:M association (implementation: Scene)` |

### PG1-B — raree-governance template synchronization

Propagate Legacy Alias Reference section from admin submodule to canonical governance:

| # | File | Change |
|---|------|--------|
| G-01 | `governance/templates/ADR_TEMPLATE.md` (local submodule + canonical raree-governance) | Add Legacy Alias Reference section |
| G-02 | `governance/templates/SPEC_TEMPLATE.md` (local submodule + canonical raree-governance) | Add Legacy Alias Reference section |

After local template update: run `npm run sync:governance` to push to
`.github/pull_request_template.md` and synchronize with `raree-governance`.

### PG1-C — raree-show-web vocabulary notices

Documentation-only changes in `raree-show-web`:

| # | File | Change |
|---|------|--------|
| W-01 | `docs/runtime-architecture.md` | Add vocabulary notice header pointing to `governance/vocabulary/runtime-lexicon.md` |
| W-02 | `docs/adr/002-hybrid-rag-retrieval.md` | Add vocabulary notice header |
| W-03 | `docs/specs/w-01-visibility-synchronized-navigation.md` | Add vocabulary notice header |
| W-04 | `README.md` | Add vocabulary notice footnote |

**Vocabulary notice format** (from spec-xrm-001 §XRM-INV-07):

```markdown
> **Vocabulary Notice:** This document uses implementation symbols (`Scene`,
> `StoryImage`, `story_images_v2`). Normative Runtime vocabulary is
> `Reading Route`, `Reading Frame`, and `Frame Narrative`. See
> `governance/vocabulary/runtime-lexicon.md` in `raree-show-admin`.
```

---

## Deliverable 10 — Migration Phase Summary

### Admin phases

```
Phase 0 (Immediate)         P0-01  Story Sequence → Reading Frame label
                             Risk: None
Phase 1 (TypeScript types)  P1-01  StoryImage → ReadingFrame
                             P1-02  Scene → ReadingRoute
                             Risk: Low | Unblocks: 2, 3, 4, 5
Phase 2 (Lib + API routes)  P2-01  rollout/types.ts interface renames
                             P2-02  scene-projection.ts → reading-route-projection.ts
                             P2-03  API /scene-projection → /reading-route-projection
                             P2-04  App /scenes → /reading-routes + HTTP redirect
                             Risk: Medium | Requires atomic PR
Phase 3 (Components)        P3-01  SceneForm → ReadingRouteForm
                             P3-02  SceneTable → ReadingRouteTable
                             Risk: Low
Phase 4 (i18n + UI copy)    Phase 4a  lib/locale/ foundation (zh-CN.ts, index.ts, types.ts)
                             Phase 4b  lib/rollout/ui-copy.ts migrated to locale refs
                             Phase 4c  lib/discovery/ui-copy.ts migrated (with Phase D1)
                             Risk: Low | Unblocks: future locale additions without code change
Phase 5 (Tests)             Co-migrated with each phase PR
```

### Web phases (parallel to admin)

```
Phase W1 (TS core types)    PW1-01  Scene → ReadingRoute (interface)
                             PW1-02  StoryImage → ReadingFrame (type)
                             PW1-03  EffectiveStorySlide → EffectiveReadingFrame
                             PW1-04  story-images-v2.ts → reading-frames.ts
                             Risk: Low | Unblocks: W2, W3
Phase W2 (Hook + state)     PW2-01  useSceneAtomicNavigation → useReadingRouteNavigation
                             PW2-02  SceneReadingState/Action → ReadingRouteState/Action
                             Risk: Low
Phase W3 (Components)       7 components renamed; CaptionDisplay unchanged
                             Risk: Low
```

### Discovery phase (parallel to all)

```
Phase D1 (Discovery layer)  PD1-01  "scene" candidate type → "readingRoute"
                             PD1-02  LLM prompt identifiers updated
                             Risk: Low-Medium | LLM prompt change requires output validation
```

### Documentation phase (parallel to all)

```
Phase G1 (Docs + templates) PG1-A  A-01 ~ A-13: inline alias annotations (admin ADRs + SPECs)
                             PG1-B  G-01 ~ G-02: governance template sync
                             PG1-C  W-01 ~ W-04: web vocabulary notices
                             Risk: None (documentation-only)
```

### Acceptance gate (see §16)

---

## Deliverable 11 — Ordering Rationale

1. **Phase 1 / W1 first:** Type renames produce compile errors that guide the
   implementer to every dependent file. Nothing is missed.
2. **Phase 2 before Phase 3 (admin):** Library symbols must be renamed before
   the components consuming them.
3. **W2 before W3 (web):** Hook types must be renamed before the components
   importing them.
4. **Phase D1 parallel:** Discovery candidate type rename is independent of
   the Runtime layer — `lib/discovery/` has no TypeScript import dependency on
   `lib/types.ts` `Scene`/`StoryImage`.
5. **Phase G1 parallel:** Documentation-only; no compilation dependency.
6. **Phase 4 last (admin):** UI copy does not affect compilation; updating last
   reduces review noise during type-level phases.

---

## Deliverable 12 — Chinese Localization Register

This register is the **canonical authority** for all Chinese equivalents of
normative Runtime terms. Its content is materialized in `lib/locale/zh-CN.ts`
(introduced in Phase 4a). No Chinese string for a normative Runtime concept
may be defined outside `lib/locale/zh-CN.ts`.

### Domain label register

| Normative Term | Canonical Chinese | `zh-CN.ts` key | Notes |
|----------------|-------------------|----------------|-------|
| Work | 作品 | `domain.work` | Existing — no change |
| Reading Route | **阅读路线** | `domain.readingRoute` | Replaces `Scene` / `场景` in Runtime and Discovery operator contexts |
| Route Synopsis | **路线摘要** | `domain.routeSynopsis` | Maps to `summary` field |
| Reading Frame | **阅读帧** | `domain.readingFrame` | Replaces `Story Image` / `Story Sequence` |
| Frame Narrative | **帧叙述** | `domain.frameNarrative` | Maps to `caption` field |
| Reader Step | **读者步进** | `domain.readerStep` | Maps to step/slide index |
| Chapter Metadata | **章节元数据** | `domain.chapterMetadata` | `chapter_number`, `chapter_title` collectively |

### i18n compatibility rules

1. **Single source:** All Chinese strings for normative Runtime concepts live
   in `lib/locale/zh-CN.ts`. No hardcoded Chinese string may appear in
   `ui-copy.ts`, component files, or prompt templates.
2. **Key as contract:** The locale key (e.g. `domain.readingRoute`) is a
   stable public contract. Renaming a locale key is a breaking change and
   requires updating all usages.
3. **Future locale files** (`en.ts`, `ja.ts`, etc.) must satisfy the
   `AppLocale` type from `lib/locale/types.ts`, ensuring structural completeness.
4. **Library migration path:** Replacing the `messages` export in
   `lib/locale/index.ts` with a call to `useTranslations()` (next-intl) or
   `t()` (react-i18next) does not require changes to any `ui-copy.ts` file,
   provided the namespace/key structure is preserved.
5. **Reader-facing strings (raree-show-web):** May adopt these canonical
   Chinese values or define reader-appropriate variants. Web variants must not
   contradict the canonical definitions in this register.

---

## Deliverable 13 — Frozen and Deferred Symbols

The following symbols must **not** be renamed in this SPEC:

| Symbol | Layer | Reason |
|--------|-------|--------|
| `scenes` (table name) | Database | High migration cost; partial inferability retained within DB layer |
| `story_images_v2` (column + JSON field) | Database / TypeScript field | DB column; explicit aliasing in every Supabase `select()` — cost exceeds benefit |
| `scene_` (TSID prefix) | Business ID | Invalidates all stored TSIDs; requires a data migration |
| `caption` (field on ReadingFrame/Row) | TypeScript / DB | Directly inferable as Frame Narrative; satisfies IP-01 |
| `summary` (field on ReadingRoute) | TypeScript / DB | Directly inferable as Route Synopsis; satisfies IP-01 |
| `chapter_number`, `chapter_title` | TypeScript / DB | DB column names; directly inferable as Chapter Metadata |
| `story` (Discovery candidate type) | Discovery layer | Correct domain term — Editorial Story candidate; IP-01 satisfied after `StoryImage` rename |
| `CaptionDisplay` (web component) | React / web | `caption` is an acceptable alias; component name directly inferable |

---

## Deliverable 14 — Inferability Audit Summary (VDC-INV-04)

Complete audit across all phases:

| Phase | Identifiers audited | All satisfy IP-01? |
|-------|--------------------|--------------------|
| Phase 1 (admin types) | `ReadingFrame`, `ReadingRoute`, `rowToReadingRoute`, `ReadingRouteRow` | ✓ |
| Phase 2 (admin lib) | `StoryReadingRouteProjectionLink`, `ProjectedReadingRouteRecord`, `ReadingRouteProjectionResult`, `reading-route-projection.ts`, `/reading-routes` | ✓ |
| Phase 3 (admin components) | `ReadingRouteForm`, `ReadingRouteTable` | ✓ |
| Phase W1 (web types) | `ReadingRoute`, `ReadingFrame`, `EffectiveReadingFrame`, `reading-frames.ts` | ✓ |
| Phase W2 (web hook) | `useReadingRouteNavigation`, `ReadingRouteState`, `ReadingRouteAction` | ✓ |
| Phase W3 (web components) | 7 renamed components including `ReadingFrameView` | ✓ |
| Phase D1 (Discovery) | `"readingRoute"` candidate type | ✓ |
| Unchanged (acceptable aliases) | `caption`, `summary`, `story`, `CaptionDisplay` | ✓ — satisfy IP-01 |

---

## Deliverable 15 — Reconciliation with SPEC-XRM-001

`docs/specs/spec-xrm-001-cross-repo-vocabulary-migration.md` is **superseded**
by this SPEC.

| XRM-001 item | Status under this SPEC |
|---|---|
| A-01 through A-13 (admin doc annotations) | Absorbed → PG1-A |
| A-14, A-15 (governance template sync, admin side) | Absorbed → PG1-B |
| G-01, G-02 (raree-governance templates) | Absorbed → PG1-B |
| W-01 through W-04 (web vocabulary notices) | Absorbed → PG1-C |
| W-05 through W-09 (web Implementation Symbols — NO-CHANGE) | Superseded — web symbols are **renamed** in Phases W1–W3 per ADR-008 Decision 3 (IP-01 policy overrides prior freeze) |
| XRM-INV-04 (admin Implementation Symbols frozen) | Superseded for TypeScript types and components; DB/TSID symbols remain frozen per §13 |
| XRM-INV-01 through XRM-INV-03, XRM-INV-05 through XRM-INV-09 | Subsumed by VDC-INV-01 ~ VDC-INV-04 and acceptance gate in §16 |

---

## Deliverable 16 — Acceptance Criteria

### VDC-INV-01 — No new vocabulary debt after 2026-07-08

Any PR introducing a new TypeScript type or React component for an
RV-registered concept must use the canonical identifier.

- [ ] VDC-INV-01 gate in place for subsequent PRs in admin and web repos

### VDC-INV-02 — No `Story` prefix for Reading Frame / Route / Narrative

No new component, type, or API field may use `Story` as prefix/suffix for a
Reading Frame, Reading Route, or Frame Narrative concept.

- [ ] VDC-INV-02 gate in place for subsequent PRs

### VDC-INV-03 — `Story Sequence` label replaced

- [ ] **P0-01** — `<Label>Story Sequence</Label>` → `<Label>Reading Frame</Label>` in `SceneForm.tsx`
- [ ] No other `Story Sequence` remains as admin UI label

### VDC-INV-04 — Inferability audit complete

- [ ] Deliverable 14 audit table reviewed and confirmed for all phases

### Full acceptance gate — admin

- [ ] P0-01 UI label
- [ ] P1-01 `StoryImage` → `ReadingFrame`
- [ ] P1-02 `Scene` → `ReadingRoute` + all import sites
- [ ] P2-01 `lib/rollout/types.ts` interfaces
- [ ] P2-02 `scene-projection.ts` → `reading-route-projection.ts`
- [ ] P2-03 API routes renamed
- [ ] P2-04 App routes renamed + HTTP redirect
- [ ] P3-01 `SceneForm` → `ReadingRouteForm`
- [ ] P3-02 `SceneTable` → `ReadingRouteTable`
- [ ] Phase 4a `lib/locale/zh-CN.ts`, `index.ts`, `types.ts` created
- [ ] Phase 4b `lib/rollout/ui-copy.ts` migrated to locale refs (no hardcoded Chinese remains)
- [ ] No hardcoded Chinese string for a normative Runtime concept outside `lib/locale/zh-CN.ts`
- [ ] Phase 5 tests co-migrated

### Full acceptance gate — web

- [ ] PW1-01 `Scene` → `ReadingRoute`
- [ ] PW1-02 `StoryImage` → `ReadingFrame`
- [ ] PW1-03 `EffectiveStorySlide` → `EffectiveReadingFrame`
- [ ] PW1-04 `story-images-v2.ts` → `reading-frames.ts`
- [ ] All web `Scene` / `StoryImage` import sites updated
- [ ] PW2-01 hook renamed
- [ ] PW2-02 `SceneReadingState` / `SceneReadingAction` renamed
- [ ] PW3 all 7 components renamed
- [ ] `CaptionDisplay.tsx` confirmed unchanged

### Full acceptance gate — Discovery

- [ ] PD1-01 `"scene"` → `"readingRoute"` across all Discovery files
- [ ] PD1-02 LLM prompt identifiers updated and output validated
- [ ] Phase 4c `lib/discovery/ui-copy.ts` migrated to locale refs (`messages.discovery.readingRouteCandidate`)
- [ ] `story` candidate type confirmed unchanged with documented rationale

### Full acceptance gate — governance docs

- [ ] PG1-A: A-01 through A-13 annotations applied in ADR-004, ADR-007, SPEC-ROL-001
- [ ] PG1-B: G-01, G-02 governance templates updated and `npm run sync:governance` passes
- [ ] PG1-C: W-01 through W-04 vocabulary notices added in raree-show-web

### Cross-repository gate

- [ ] No `scenes` table rename (frozen)
- [ ] No `story_images_v2` column/field rename (frozen)
- [ ] No `scene_` TSID rename (frozen)
- [ ] `governance/vocabulary/runtime-lexicon.md` is the sole normative vocabulary source
- [ ] VDC-INV-01, VDC-INV-02 gates in place in both repos

---

## Legacy Alias Reference

*This SPEC references Runtime vocabulary as defined in*
`governance/vocabulary/runtime-lexicon.md`.

| Normative Term | Legacy Term | Classification | Status under this SPEC |
|---|---|---|---|
| Reading Route | Scene | Implementation Alias | Replaced at TypeScript/component/route/Discovery layers; retained at DB layer |
| Reading Frame | Story Image / StoryImage | Implementation Alias | Replaced at TypeScript layer; retained at DB column level |
| Frame Narrative | caption | Documentation Alias | Acceptable — satisfies IP-01; no change |
| Route Synopsis | summary | Documentation Alias | Acceptable — satisfies IP-01; no change |
| Reading Frame | Story Sequence (UI) | Unregistered ad-hoc | Replaced — Phase 0 |
| Reading Frame | EffectiveStorySlide | Implementation Alias | Replaced — Phase W1 |
| Reading Route | SceneExperience / SceneAssistant etc. | Implementation Alias | Replaced — Phase W3 |
| Reading Frame | SceneSlide | Semantic mismatch | Replaced as `ReadingFrameView` — Phase W3 |
| Reading Route | `"scene"` (Discovery type) | Layer collision | Replaced as `"readingRoute"` — Phase D1 |
