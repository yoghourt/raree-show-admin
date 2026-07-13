# Discovery Runtime Drift Report — Sprint #2 (ACA-002)

## Metadata

| Field | Value |
| ----- | ----- |
| Sprint | Runtime Capability Sprint #2 — Discovery Runtime Realignment |
| Mode | Audit only — **no implementation** |
| Date | 2026-07-12 |
| Repository | `raree-show-admin` (Discovery lives here) |
| Frozen baseline | Runtime Reading Governance RC1 (read-only) |
| Status | **Submitted for ACA-002** |

---

## Product Question (Primary)

> If Story becomes the primary editorial aggregation unit, what changes inside Discovery, and what remains unchanged for readers?

| Domain | Answer |
| ------ | ------ |
| **Discovery (Admin)** | Must stop treating Scene as a work-level sibling of Story. Propose → Review → Staging must enforce **Work → Story → Scene** (Scene within Story). Types, prompts, UI, and Rollout staging sync require Major / Architecture Change. |
| **Readers (raree-show-web)** | **No Runtime Reading regression.** RC1, W-01, Reading Route → Reading Frame navigation, Assistant visibility, and retrieval remain unchanged. Discovery changes stop at Editorial / Rollout admin paths. |

Future Story-based editorial capabilities can extend Discovery + Rollout without rewriting Runtime Reading.

---

## 1. Current Runtime Architecture

### 1.1 Accepted editorial model (authority)

```text
Work
 └── Story          ← Mental Model Transition unit (ADR-005)
      └── Scene     ← Narrative Progression Step within Story (NIM-INV-01)
```

### 1.2 Discovery implementation today

```text
Work (session.workId)
 └── DiscoverySession (narrative lock)
      └── Propose (parallel candidate types)
           ├── character
           ├── location
           ├── story            ← work-scoped, no Scene children
           └── readingRoute     ← Editorial Scene fields, work-scoped, no Story parent
                └── Accept → AcceptedSceneCandidateStaging { workId only }
```

| Layer | Path |
| ----- | ---- |
| Page | `app/works/[workId]/discovery/page.tsx` |
| Session | `hooks/useDiscoverySession.ts`, `lib/discovery/session-factory.ts` |
| Propose | `lib/discovery/propose-service.ts`, `app/api/admin/discovery/propose/*` |
| Review | `lib/discovery/review-state.ts`, `components/discovery/DiscoveryReviewPanel.tsx` |
| Staging | `lib/discovery/review-types.ts` |
| Rollout sync | `lib/rollout/sync-discovery-staging.ts` |

**Story** is first-class editorial staging (not UI-only) — it has Accept → `AcceptedStoryUnitStaging` → `story_units` persist.  
**Scene** is also first-class staging, but **not nested under Story** in Discovery.

---

## 2. Drift Locations (D1–D4)

### D1 — Still assuming `Work → Scene` instead of `Work → Story → Scene`

| ID | Location | Severity | Evidence |
| -- | -------- | -------- | -------- |
| D1.1 | Session scope | High | `DiscoverySession` binds `workId` only — no Story scope (`lib/discovery/types.ts`) |
| D1.2 | Scene staging | **Critical** | `AcceptedSceneCandidateStaging` has `workId`, no `storyUnitId` / parent ref (`review-types.ts`) |
| D1.3 | Propose generation | **Critical** | `readingRoute` proposed in parallel with `story`; same narrative; no “within Story” (`propose-service.ts`) |
| D1.4 | Accept path | **Critical** | `case "readingRoute"` → `scene_staging` without Story dependency (`review-state.ts`) |
| D1.5 | Review / Rollout sync | High | Story units ∥ scene candidates as sibling arrays (`sync-discovery-staging.ts`) |
| D1.6 | SPEC-D3 staging contracts | Medium | SPEC-D3-002/003 also omit Scene→Story parent (spec + impl gap) |

### D2 — Story and Scene candidates coupled

| ID | Location | Severity | Evidence |
| -- | -------- | -------- | -------- |
| D2.1 | Same propose loop | High | `DISCOVERY_CANDIDATE_TYPES` includes both; sequential independent LLM calls (`propose-service.ts`) |
| D2.2 | Same regen API | Medium | Shared `candidateType` enum (`propose/regen/route.ts`) |
| D2.3 | Shared client state | High | `acceptedStoryUnits` + `acceptedSceneCandidates` in one hook (`useDiscoverySession.ts`) |
| D2.4 | Shared Review UI | High | Parallel type sections — not nested (`DiscoveryReviewPanel.tsx`) |
| D2.5 | Coupled helpers | Medium | `isStoryOrSceneAcceptedInStaging` (`review-state.ts`) |
| D2.6 | Parse aliases | Medium | `scene*` keys map to `readingRoute` (`propose-parse.ts`) |
| D2.7 | Rollout queue | Medium | Parallel merge of both staging kinds |

**Coupling character:** Shared pipeline / UX / session — **not** semantic parent-child. Generation is weakly coupled (independent LLM calls); Accept does not require Story before Scene.

### D3 — Implementation concepts leaking into editorial concepts

| ID | Leak | Severity | Evidence |
| -- | ---- | -------- | -------- |
| D3.1 | Editorial Scene typed as `readingRoute` | **Critical** | `DiscoveryCandidateType` (`propose-types.ts`); SPEC-D3-003 still says `"scene"` |
| D3.2 | UI “阅读路线候选” for Editorial Scene staging | **Critical** | `lib/locale/zh-CN.ts`, `ui-copy.ts` |
| D3.3 | Prompt “Reading route fields” vs `validateSceneFields` | High | `propose-service.ts`, `candidate-validate.ts` |
| D3.4 | Rollout field `readingRouteStaging` holds Scene staging | High | `lib/rollout/types.ts` |
| D3.5 | Scene as work top-level narrative unit | **Critical** | Full propose → accept path |
| D3.6 | Story as sibling section, not aggregation container | High | Review UI |
| D3.7 | `chapter_number` as primary Scene identity/sort | Medium | `SceneCandidateFields`; ADR-005 Chapter ≠ Scene tension |

### D4 — Modules requiring refactor if Story is editorial aggregation unit

See **Architecture Impact Matrix** (§3) and **Refactoring Roadmap** (§5).

---

## 3. Architecture Impact Matrix

| Module | Classification | Rationale |
| ------ | -------------- | --------- |
| `lib/discovery/propose-types.ts` | **Architecture Change** | `"readingRoute"` → `"scene"`; Scene fields need Story parent ref |
| `lib/discovery/review-types.ts` | **Architecture Change** | Staging hierarchy; Scene staging requires Story identity |
| `lib/discovery/propose-service.ts` | **Major Refactor** | Prompt + generation order (Story before Scene; Scene scoped to Story) |
| `lib/discovery/propose-parse.ts` | **Major Refactor** | Type aliases, nested parse if needed |
| `lib/discovery/candidate-validate.ts` | **Major Refactor** | Parent Story validation |
| `lib/discovery/propose-schemas.ts` | **Major Refactor** | Zod contracts |
| `lib/discovery/review-state.ts` | **Architecture Change** | Accept order / dependency; cascade revoke |
| `hooks/useDiscoverySession.ts` | **Major Refactor** | State tree Story → Scene[] |
| `components/discovery/DiscoveryReviewPanel.tsx` | **Major Refactor** | Nested UI; terminology |
| `components/discovery/DiscoveryComposer.tsx` | **Minor Refactor** | Story-first copy / flow hints |
| `lib/discovery/review-session-storage.ts` | **Major Refactor** | Snapshot schema version |
| `lib/discovery/ui-copy.ts` + `lib/locale/zh-CN.ts` | **Minor Refactor** | Layer 3 vocabulary |
| `lib/rollout/sync-discovery-staging.ts` | **Major Refactor** | Aggregate Scene under Story in queue |
| `lib/rollout/types.ts` / `rollout-queue-storage.ts` | **Major Refactor** | Rename `readingRouteStaging`; optional parent keys |
| `app/api/admin/discovery/propose/*` | **Minor Refactor** | Thin handlers; logic in service |
| Session lock / unlock / reset | **Minor Refactor** or **No Change** | May remain work-scoped |
| Character / Location accept → CRUD | **No Change** | Orthogonal Catalog path |
| `story_units` persist (ROL-001) | **Minor Refactor** | May gain Scene parent linkage at Rollout only |
| **Runtime Reading / W-01 / SPEC-RDX-001 / runtime-architecture.md** | **No Change** | **Forbidden to modify** |
| Reader (`raree-show-web` reading path) | **No Change** | RC1 Product Freeze preserved |

---

## 4. Root Causes

1. **Discovery v1 design:** Four work-scoped parallel `candidateType`s — predates ADR-005 A4 Story→Scene hierarchy enforcement in the type system.
2. **Vocabulary leakage:** Historical Runtime alias Scene ≈ Reading Route entered Discovery type names (`readingRoute`) and operator UI (“阅读路线”).
3. **SPEC gap:** SPEC-D3-002/003 describe Editorial Scene but do not require Scene→Story parent in staging contracts.
4. **Rollout compensation:** Story↔Route links happen after Discovery Accept — cannot substitute for Discovery-time hierarchy.

This is **not** a Runtime Reading defect. Readers already consume Reading Route → Frame under RC1.

---

## 5. Refactoring Roadmap (Proposed — ACA-002 Approval Required)

No code until Architect approves.

### Phase 0 — Governance delta (admin SPECs only)

- Amend SPEC-D3-002 / SPEC-D3-003: Scene Candidate / staging MUST reference parent Approved or Accepted Story unit (or provisional Story candidate id within session).
- Align candidate type name `"scene"` (SPEC) vs `"readingRoute"` (impl) — vocabulary closure.
- **Do not** touch SPEC-RDX-001 / W-01 / RC1.

### Phase 1 — Contracts

- Update `propose-types`, `review-types`, schemas, validation.
- Introduce `parentStoryReviewId` / `storyUnitId` on Scene fields & staging (exact field naming TBD in SPEC amendment).

### Phase 2 — Propose service

- Story-first generation policy (Story propose before Scene, or Scene prompt conditioned on accepted/proposed Story set).
- Prompt: “Scene within Story”; remove Reading-route-as-editorial framing.

### Phase 3 — Review UX + session state

- Nested Review: Story sections contain Scene items.
- Accept/revoke cascade rules.
- Locale: Editorial Scene wording, not “阅读路线”.

### Phase 4 — Rollout sync

- Queue / staging sync preserves Story→Scene association into Projection Accept inputs.
- Rename `readingRouteStaging` → Scene staging field.

### Phase 5 — Verification

- Discovery unit tests + propose route tests updated.
- Manual: Accept Story → Accept Scene under Story → Rollout sees parent link.
- Confirm reader paths untouched (smoke RC1 checklist).

---

## 6. Impact Analysis

| Stakeholder | Impact |
| ----------- | ------ |
| Operators (Discovery UI) | Story-first review; Scene no longer free-floating at Work |
| Rollout operators | Clearer Projection Accept inputs (Scene already scoped to Story) |
| Readers | **None** — Runtime Reading RC1 unchanged |
| Catalog Entity Discovery | **None** — character/location path orthogonal |
| Future Story features | Unblocked without Runtime rewrite |

---

## 7. Explicit Non-Goals (Sprint #2)

- Modify Runtime Reading, W-01, SPEC-RDX-001, runtime-architecture.md
- Scene-aware Reading / SceneProjectionLink consumption
- Navigation or Assistant redesign
- Implementation before ACA-002 approval

---

## 8. Refs

```text
docs/adr/005-narrative-information-model.md
docs/adr/006-discovery-copilot-architecture.md
docs/specs/spec-d3-001-discovery-platform.md
docs/specs/spec-d3-002-discovery-human-review.md
docs/specs/spec-d3-003-discovery-proposals.md
docs/specs/spec-rol-001-governed-projection.md
docs/specs/runtime-reading-governance-rc1.md
lib/discovery/propose-types.ts
lib/discovery/review-types.ts
lib/discovery/propose-service.ts
lib/discovery/review-state.ts
hooks/useDiscoverySession.ts
components/discovery/DiscoveryReviewPanel.tsx
```

---

## 9. ACA-002 Submission Checklist

- [x] Discovery Runtime Drift Report (this document)
- [x] Architecture Impact Matrix (§3)
- [x] Refactoring Roadmap (§5)
- [ ] Architect approval before any implementation

**Audit verdict:** Discovery is **misaligned** with ADR-005 Story→Scene hierarchy at propose/review/staging layers. Realignment is an **Admin Editorial / Discovery / Rollout** concern. **Runtime Reading RC1 remains valid and frozen.**
