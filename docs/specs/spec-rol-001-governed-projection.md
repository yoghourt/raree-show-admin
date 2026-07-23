# SPEC-ROL-001 — Governed Editorial↔Runtime Projection

## Hotfix amendment (2026-07-12) — Product Target Recovery

**Status addendum:** Product Freeze Hotfix recovers the intended storage mapping. Discovery candidate vocabulary remains Story / Scene (SPEC-D3-002). Rollout durable targets:

| Discovery staging | Rollout Persist target | Implementation |
| ----------------- | ---------------------- | -------------- |
| Story Candidate (`AcceptedStoryUnitStaging`) | **Reading Route** | `scenes` row (`discovery_source_review_id`) |
| Scene Candidate (`AcceptedSceneCandidateStaging`) | **Reading Frame** | `story_images_v2[]` element on **parent** Route |

Normative Hotfix rules:

- Rollout MUST NOT create a new Reading Route from Scene staging.
- Rollout MUST NOT write `story_units` / `approved_scene_units` / `scene_projection_links` as editorial authority on the happy path (soft-deprecated).
- Parent gate for Scene → Frame: parent Story staging MUST already be persisted as a Reading Route.
- Reader / SPEC-RDX-001 / Runtime topology unchanged (`Work → Reading Route → Reading Frame`).
Sections below that still say “Approved Story unit” / “Scene → Reading Route” describe the **pre-Hotfix** Sprint #1 contract; **Hotfix supersedes** those storage targets for implementation.

---

## Metadata

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Title        | Governed Editorial↔Runtime Projection                                 |
| Status       | Implemented                                                           |
| Version      | v1.2 (Hotfix Product Recovery)                                       |
| Owner        | Architect                                                             |
| Last Updated | 2026-07-12                                                            |
| Derived From | ADR-007 v1.2 (`docs/adr/007-rollout-architecture.md`)                      |
| Related      | ADR-004, ADR-005, ADR-006, SPEC-D3-001, SPEC-D3-002, SPEC-CORE-001 |

**ADR-004 note:** Listed under Related for Human Acceptance Gate (Decision 2) and Runtime Truth v1 topology. Projection Accept MUST satisfy explicit operator acceptance; no silent Runtime writes.

**ADR-005 note:** Listed under Related for Approved Story unit and **Approved Scene unit** (Editorial Scene) semantics and Editorial Domain authority. Story and Scene boundary adjudication remain ADR-005 v2.0 authority; this SPEC MUST NOT define ONE Rule UI, alternate Story/Scene definitions, or treat **Reading Frame** as Editorial Scene (NIM-INV-06; ROL-INV-04).

**ADR-006 note:** Discovery Accept for story/scene Candidates produces client staging only (SPEC-D3-002). Rollout MUST NOT collapse Discovery session semantics or reuse Enrichment Accept paths (ROL-INV-06).

**SPEC-D3-002 note:** Staging type authority for `AcceptedStoryUnitStaging` and `AcceptedSceneCandidateStaging` remains SPEC-D3-002 §4.5. This SPEC consumes those objects at the Rollout boundary; it MUST NOT redefine conflicting field names or semantics.

---

## 1. Purpose

ADR-007 closes Runtime Truth v1 architecture at the **What/Why** layer for Editorial↔Runtime governed projection and defers **projection schema, link model, and Scene Candidate→Runtime Reading Route operator paths** to downstream specifications.

SPEC-ROL-001 closes that deferral for the **Rollout** layer. It becomes the **sole governance authority** for:

- Work-scoped Rollout operator UX contract (normative behaviors; not pixel-level UI Spec)
- Durable Approved Story unit persistence from Discovery Accept staging
- Story ↔ Reading Route (implementation: Scene) **governed link** create, list, and remove (N:M association; no identity merge)
- Reading Route **Projection Accept** — **Editorial Scene** staging (`AcceptedSceneCandidateStaging`) → Runtime Reading Route (implementation: Scene) create or link to existing Reading Route. **Not** Reading Frame. Operator-initiated; architecture deferral closed at SPEC layer (ADR-007 v1.2 §Deferred Decisions → SPEC-ROL-001).
- Rollout-phase enforcement of ROL-INV-01 through ROL-INV-07 as testable runtime contracts

This specification defines **How** and **Validation** for governed projection. It does not restate ADR-007 Rollout Model rationale. Discovery propose/regen, Human Review actions, and Candidate lifecycle belong to SPEC-D3-001, SPEC-D3-002, and SPEC-D3-003. Catalog Entity persist (Character, Location) remains the existing Production path unchanged.

On Story semantics conflicts, ADR-005 governs. On Discovery boundary conflicts, ADR-006 governs. On Runtime topology conflicts, ADR-004 governs.

---

## 2. Scope

### In Scope

- Rollout panel UX contract for Path C operator workflow (Master frozen intent §1.F)
- Input consumption: `AcceptedStoryUnitStaging`, `AcceptedSceneCandidateStaging` (SPEC-D3-002 §4.5)
- Approved Story unit durable storage v1 minimum (closes partial deferral of SPEC-D3-002 OQ-D3-002-02)
- Story ↔ Reading Route (implementation: Scene) governed link CRUD with explicit operator Accept per link
- Reading Route Projection Accept: create new Runtime Reading Route (implementation: Scene) from staging **or** associate staging with existing Reading Route (`scenes.tsid`)
- Projection Accept MUST route through existing Reading Route (implementation: Scene) CRUD validation and Human Save confirmation where applicable
- ROL-RC-* runtime contracts and ROL-INV-* traceability in §3
- Admin route contracts for persist, projection, and link operations (§4.7)
- §2.1 boundary matrix with SPEC-D3-002 and existing Scene CRUD
- §8.2 implementation acceptance criteria and §10 validation commands — **after Approved, Implementation executes from this SPEC; a separate Implementation plan MAY be used when DB migrations are required**

### Out of Scope

| Topic | Owner |
| ----- | ----- |
| Discovery Session, Narrative Gate, lock/unlock | SPEC-D3-001 (Implemented) |
| Human Review Accept / Edit / Discard / Re-propose | SPEC-D3-002 (Implemented) |
| Propose / regen API, Candidate generation | SPEC-D3-003 (Implemented) |
| Enrichment Copilot, `/api/admin/ai/suggest` | SPEC-D2-002 |
| Character / Location catalog persist | Existing Production CRUD path (ADR-006 Catalog Entity outcome) |
| Story ONE Rule adjudication UI | ADR-005 |
| Batch projection sync, background reconciliation jobs | Deferred v1 (OQ-ROL-001-07) |
| Reader routing changes, Reading Frame (Story Images) topology redesign | ADR-004 (ROL-INV-01) |
| Knowledge Graph, Relationship Graph, Story Arc Runtime | Post-v1 capabilities |
| Generative AI in Rollout | Prohibited v1 — no LLM routes under Rollout namespace |

### 2.1 Boundary Matrix (D3-002 / Scene CRUD / ROL-001)

| Topic | D3-002 | Scene CRUD (existing) | ROL-001 |
| ----- | ------ | --------------------- | ------- |
| Discovery Accept (story/scene) | Client staging only | — | Consumes staging |
| Discovery Accept (character/location) | Prefill → CRUD create | Persist on Save | — |
| Runtime Reading Route create/update | Prohibited | Yes (form Save) | Projection Accept **via** governed path |
| Story ↔ Reading Route link | Prohibited | — | Yes |
| Generative AI | D3-003 propose/regen | Enrichment suggest | **Prohibited** |
| Human Accept gate | Review Accept | Form Save | **Projection Accept** / **Link Accept** |
| Durable story/scene editorial state | Deferred in D3-002 v1 | — | Yes (Rollout persist) |

This matrix MUST remain consistent with SPEC-D3-002 §2.1. ROL-001 is **downstream** of D3-002 for story/scene staging ingress.

### 2.2 Contrast with Catalog Entity Path (reference)

| Dimension | Catalog Entity (Character/Location) | Rollout (this SPEC) |
| --------- | ----------------------------------- | --------------------- |
| Editorial ingress | Discovery Accept → entity create prefill | Discovery Accept → story/scene staging |
| First durable authority | Entity CRUD Save | Rollout Persist Story unit / Projection Accept Scene |
| Runtime outcome | Reading Route (impl: Scene) references catalog IDs (existing) | Reading Route record + optional Story↔Reading Route link |
| Generative AI | Enrichment (entity-scoped) | None |
| Identity model | Catalog Entity tsid | Story unit id **distinct from** Reading Route ID (`scenes.tsid`) (N:M) |

Rollout MUST NOT auto-promote Approved Story units to catalog Entities (ROL-INV-05).

---

## 3. Runtime Contracts

**ROL-RC-01 — Runtime topology unchanged**

Rollout operations MUST NOT alter the `Work → Reading Route → Reading Frame` topology defined by ADR-004 (implementation: `Work → Scene → Story Images`). Story MUST NOT become a first-class Runtime routable entity in Reader paths (ROL-INV-01).

**ROL-RC-02 — No silent Editorial→Runtime conflation**

Editorial approval alone MUST NOT create, modify, or equate Runtime Reading Route records (implementation: Scene records). Discovery Review Accept for scene Candidates MUST NOT perform Runtime writes. **Discovery Accept ≠ Projection Accept** (OQ-ROL-001-04; ROL-INV-02).

**ROL-RC-03 — Explicit operator Accept for projection**

Every projection decision (Persist Story unit, Projection Accept Scene, Link Accept, Unlink) MUST be an explicit operator action satisfying ADR-004 Decision 2 Human Acceptance Gate. No default projection, cron sync, or background reconciliation in v1 (ROL-INV-03; OQ-ROL-001-07).

**ROL-RC-04 — Story semantics authority preserved**

This SPEC MUST NOT publish alternate Story definitions, Story boundary rules, or ONE Rule adjudication. ADR-005 remains authoritative for Editorial Story semantics (ROL-INV-04).

**ROL-RC-05 — Approved Story unit not a catalog Entity**

Approved Story units MUST NOT be inserted into Character, Location, or other catalog Entity tables without separate governance. Story unit records are Editorial Rollout artifacts, not Production Entities (ROL-INV-05).

**ROL-RC-06 — Discovery and Enrichment boundaries preserved**

Rollout routes and UI MUST NOT invoke Discovery propose/regen handlers, Enrichment `/suggest` routes, or collapse Discovery session state into Enrichment Copilot semantics (ROL-INV-06).

**ROL-RC-07 — Runtime does not define Editorial Story boundaries**

Reading Route (implementation: Scene) ordering, routing, or storage convenience MUST NOT define Editorial Story unit boundaries. Story unit boundaries remain Editorial Domain authority (ROL-INV-07; ADR-005 NIM-INV-02).

**ROL-RC-08 — Story ↔ Reading Route (implementation: Scene) N:M without identity merge**

Story ↔ Reading Route (implementation: Scene) association MUST allow many-to-many links. A Story unit MUST NOT be forced into 1:1 identity equivalence with a Reading Route. Link records are association metadata only; Reading Route identity (`scenes.tsid`) is unchanged by linking (ADR-007 Decision 2).

**ROL-RC-09 — Reading Route Projection Accept produces valid business ID**

Reading Route Projection Accept MUST result in a reference to a valid Reading Route business ID (implementation: `scene_` prefixed TSID per existing conventions) either by creating a new Reading Route (implementation: Scene) through existing CRUD or by selecting an existing Reading Route within the same `workId`.

**ROL-RC-10 — Unlink does not silently delete domain objects**

Removing a Story ↔ Reading Route (implementation: Scene) link MUST NOT delete the Runtime Reading Route or archive the Approved Story unit unless the operator performs a separate explicit delete/archive action (ROL-INV-02).

**ROL-RC-11 — Provenance from Discovery**

Durable Rollout records created from Discovery staging MUST retain `sourceReviewId` (and `acceptedAt` where applicable) for audit. Rollout MUST NOT discard Discovery provenance at persist time.

**ROL-RC-12 — Work scope isolation**

All Rollout queries and mutations MUST be isolated by `workId`. Cross-work Scene or Story unit references MUST be rejected.

**ROL-RC-13 — Rollout does not mutate Discovery session**

Rollout operations MUST NOT mutate locked Discovery narrative state, reopen Discovery Review items, or write to Discovery propose/regen routes.

---

## 4. Data Contracts

### 4.1 Input staging (authority: SPEC-D3-002 — reference only)

Rollout ingress MUST accept staging objects defined in SPEC-D3-002 §4.5 without redefining field semantics:

```typescript
interface AcceptedStoryUnitStaging {
  workId:         string;
  sourceReviewId: string;
  title:          string;
  summary:        string;
  boundaryHint?:  string;
  acceptedAt:     string;
}

interface AcceptedSceneCandidateStaging {
  workId:         string;
  sourceReviewId: string;
  chapter_title?: string | null;
  chapter_number: number | string;
  title:          string;
  summary?:       string;
  acceptedAt:     string;
}
```

Implementation MAY import staging from Discovery client session snapshot export (SPEC-D3-002 review session storage) or accept equivalent JSON via Rollout API. Manual re-entry after session loss is permitted v1 (OQ-ROL-001-03).

### 4.2 Approved Story unit (durable)

Normative v1 shape:

```typescript
type StoryUnitStatus = "active" | "archived";

interface ApprovedStoryUnit {
  id:             string;   // uuid v4 — OQ-ROL-001-01
  workId:         string;
  sourceReviewId: string;
  title:          string;
  summary:        string;
  boundaryHint?:  string;
  approvedAt:     string;   // ISO-8601; Rollout Persist timestamp
  status:         StoryUnitStatus;
}
```

Approved Story units MUST NOT use catalog Entity tsid prefixes (`char_`, `loc_`, `scene_`).

### 4.3 Story ↔ Reading Route governed link (implementation: Scene)

```typescript
interface StorySceneProjectionLink {
  id:           string;   // uuid v4
  workId:       string;
  storyUnitId:  string;   // ApprovedStoryUnit.id
  sceneTsid:    string;   // scenes.tsid — Runtime business ID
  linkedAt:     string;   // ISO-8601
  linkedBy:     string;   // operator user id
  source:       "operator_projection_accept";
}
```

**Invariant:** A link record is **association metadata only**. It MUST NOT merge Story unit identity with Scene identity. Duplicate `(storyUnitId, sceneTsid)` pairs MUST be rejected (§6).

### 4.4 Reading Route Projection Accept outcomes (implementation: Scene)

**Sprint #1 (ACA-004):** Projection Accept runs through an explicit **Projection Engine** (`validate` → `execute`). Runtime writes occur only after validation. Parent Story MUST be persisted (`story_units`, active, matching `parentStorySourceReviewId`). Successful Accept persists:

1. Runtime Reading Route (create or `link_existing`)
2. `approved_scene_units` (Editorial Approved Scene unit)
3. `scene_projection_links` (SceneProjectionLink)
4. Companion `story_scene_links` to parent Story when missing

Transport path alias: `POST /api/admin/rollout/reading-route-projection` (equivalent to §4.7.3 `scene-projection`). Unproject removes SceneProjectionLink (+ companion Story link if owned); does **not** delete Reading Route or Approved Scene unit (ROL2-PR-06).

**Invariant:** Projection Accept MUST NOT be implemented inside Discovery propose, regen, or Review route handlers (ROL-RC-06, ROL-RC-13).

| Operator choice | Preconditions | Effect |
| --------------- | ------------- | ------ |
| **Create Scene from staging** | Valid `AcceptedSceneCandidateStaging`; parent Story persisted; operator confirms create | Projection Engine validate→execute; Runtime Route + Approved Scene + SceneProjectionLink |
| **Link staging to existing Scene** | Staging present; parent Story persisted; target `sceneTsid` exists in same `workId` | Same metadata boundary; no duplicate Scene row when linking |
| **Dismiss staging** | Staging in Rollout queue | Remove from Rollout queue; no Runtime write |

When creating a Scene via Projection Accept, operator confirms through the Projection dialog (Sprint #1). Full Scene form prefill loop remains deferred.

### 4.5 Rollout operator actions

| Action | Preconditions | Effects |
| ------ | ------------- | ------- |
| **Persist Story unit** | Valid `AcceptedStoryUnitStaging` or equivalent queue item | Insert `ApprovedStoryUnit`; remove staging from Rollout queue |
| **Projection Accept (Reading Route)** | Valid scene staging; create **or** link target chosen | Runtime Reading Route (impl: Scene) create/link per §4.4; record provenance |
| **Link Accept** | Active `ApprovedStoryUnit` and existing Reading Route (impl: Scene) in same `workId` | Insert `StorySceneProjectionLink` |
| **Unlink** | Link exists | Delete link row; Reading Route and Story unit remain |
| **Archive Story unit** | Unit `active` | Set `status` → `archived`; link retention policy per OQ-ROL-001-11 |
| **Import staging snapshot** | Discovery session export JSON | Populate Rollout queue without Discovery route calls |

### 4.6 Reading Route field mapping (staging → Runtime Reading Route create)

*Normative term: Reading Route. Implementation symbol: Scene (`scenes` table).*

Normative v1 mapping from `AcceptedSceneCandidateStaging` to existing Reading Route (implementation: Scene) create fields:

| Staging field | Scene field | Rule |
| ------------- | ----------- | ---- |
| `title` | `title` | Required; trimmed non-empty |
| `chapter_number` | `chapter_number` | Coerce to number; reject NaN |
| `chapter_title` | `chapter_title` | Nullable string |
| `summary` | `summary` | Default `""` if absent |
| — | `tsid` | Generated `scene_{tsid}` by existing create path if omitted |
| — | `tags` | Default `[]` |
| — | `story_images_v2` | Default `null` |
| — | `locationId` | Default `null` (unassigned) |
| — | `characterIds` | Default `[]` |

Unmapped Discovery Candidate fields MUST be ignored v1 (OQ-ROL-001-05). Implementation MUST reuse SPEC-CORE-001 / existing Reading Route (implementation: Scene) form validation rules at Save time.

### 4.7 Admin route contracts (v1 minimum)

All routes MUST require Supabase Auth consistent with Admin middleware and MUST scope by `workId`.

#### 4.7.1 Import staging snapshot

`POST /api/admin/rollout/staging/import`

Request body:

```typescript
{
  workId: string;
  storyUnits?: AcceptedStoryUnitStaging[];
  sceneCandidates?: AcceptedSceneCandidateStaging[];
}
```

Response: `{ ok: true, queue: RolloutQueueSnapshot }` or error (§6).

MUST NOT call Discovery propose/regen internally.

#### 4.7.2 Persist Approved Story unit

`POST /api/admin/rollout/story-units`

Request body:

```typescript
{
  workId: string;
  staging: AcceptedStoryUnitStaging;
}
```

Response: `{ ok: true, storyUnit: ApprovedStoryUnit }`.

#### 4.7.3 Reading Route Projection Accept (implementation: Scene)

`POST /api/admin/rollout/scene-projection`

Request body:

```typescript
{
  workId: string;
  staging: AcceptedSceneCandidateStaging;
  mode: "create" | "link_existing";
  sceneTsid?: string;           // required when mode = link_existing
  linkToStoryUnitId?: string;   // optional auto-link after success
}
```

Response: `{ ok: true, sceneTsid: string, link?: StorySceneProjectionLink }`.

Create mode MUST delegate to existing Scene persist module after operator confirmation.

#### 4.7.4 Link / Unlink

`POST /api/admin/rollout/story-scene-links`

```typescript
{ workId: string; storyUnitId: string; sceneTsid: string; }
```

`DELETE /api/admin/rollout/story-scene-links/{linkId}?workId={workId}`

#### 4.7.5 List Rollout state

`GET /api/admin/rollout?workId={workId}`

Response MUST include: pending staging queue, `ApprovedStoryUnit[]`, `StorySceneProjectionLink[]`, and work Scenes list reference for link UI.

Exact response envelope is Implementation detail; fields above are normative minimum.

### 4.8 Rollout queue snapshot (client/server)

```typescript
interface RolloutQueueSnapshot {
  workId: string;
  storyStaging: AcceptedStoryUnitStaging[];
  sceneStaging: AcceptedSceneCandidateStaging[];
  updatedAt: string;
}
```

v1 MAY persist queue server-side (OQ-ROL-001-02) or rely on client-held snapshot until Persist/Projection Accept. After durable persist, Rollout records supersede Discovery sessionStorage for post-projection workflow (OQ-ROL-001-08).

### 4.9 Resolved and Deferred Open Questions

| ID | Resolution |
| -- | ---------- |
| OQ-ROL-001-01 | Approved Story unit `id` MUST be **uuid v4** v1; MUST NOT use catalog Entity tsid prefixes |
| OQ-ROL-001-02 | v1 minimum durable tables: `story_units`, `story_scene_links`. Optional `rollout_staging_queue` — **Deferred**; client import + ephemeral queue acceptable v1 |
| OQ-ROL-001-03 | Staging ingress v1: (a) import Discovery session snapshot JSON, or (b) manual re-entry in Rollout UI after refresh loss |
| OQ-ROL-001-04 | **Two-step Accept:** D3 Review Accept = editorial staging; ROL Persist / Projection Accept = Runtime/projection (ROL-RC-02) |
| OQ-ROL-001-05 | Scene create mapping per §4.6; unmapped fields ignored v1 |
| OQ-ROL-001-06 | Work-scoped Rollout entry path **`/works/{workId}/rollout`** — normative v1; exact layout Deferred to Implementation |
| OQ-ROL-001-07 | Batch / auto sync — **Deferred** v1; explicit Accept only |
| OQ-ROL-001-08 | After Rollout persist, durable records are authoritative; Discovery sessionStorage remains Discovery-only |
| OQ-ROL-001-09 | When Scene title collision: operator chooses link vs create; **no** auto-dedupe |
| OQ-ROL-001-10 | Same Supabase Admin auth as Discovery; strict `workId` isolation on all routes |
| OQ-ROL-001-11 | Archive Story unit: existing links MAY remain v1; Unlink required before delete if policy added later — **Deferred** archive link policy detail |

---

## 5. State Transitions

```text
[Discovery Accept story] → AcceptedStoryUnitStaging (D3-002, client)
  → [import snapshot] → Rollout queue
  → [operator: Persist Story unit] → ApprovedStoryUnit (durable)

[Discovery Accept scene] → AcceptedSceneCandidateStaging (D3-002, client)
  → [import snapshot] → Rollout queue
  → [operator: Projection Accept create] → Runtime Reading Route (scenes.tsid)
  → [optional: Link Accept] → StorySceneProjectionLink

[Discovery Accept scene]
  → [operator: Projection Accept link_existing] → StorySceneProjectionLink only

[ApprovedStoryUnit] + [Reading Route ID (scenes.tsid)]
  → [operator: Link Accept] → StorySceneProjectionLink

[StorySceneProjectionLink]
  → [operator: Unlink] → link removed (Reading Route + Story unit remain)

[ApprovedStoryUnit active]
  → [operator: Archive] → status archived
```

Rollout transitions MUST NOT mutate Discovery session `review_pending` state or locked narrative (ROL-RC-13).

---

## 6. Error Handling

| Condition | HTTP | Code | Response |
| --------- | ---- | ---- | -------- |
| Unauthenticated | 401 | `UNAUTHORIZED` | Message |
| Missing staging / queue item | 404 | `STAGING_NOT_FOUND` | Message |
| Story unit not found | 404 | `STORY_UNIT_NOT_FOUND` | Message |
| Scene not found | 404 | `SCENE_NOT_FOUND` | Message |
| Scene belongs to different work | 403 | `SCENE_WORK_MISMATCH` | Message |
| Duplicate link (storyUnitId + sceneTsid) | 409 | `LINK_ALREADY_EXISTS` | Message |
| Invalid staging payload | 422 | `STAGING_INVALID` | Field detail |
| Scene CRUD validation failure | 422 | `SCENE_VALIDATION_FAILED` | Existing form errors |
| Archive active links policy violation | 409 | `ARCHIVE_BLOCKED` | Message (if policy enabled) |
| Import snapshot workId mismatch | 400 | `WORK_MISMATCH` | Message |

Rollout MUST surface existing Scene form validation errors rather than swallowing CRUD failures (ROL-RC-09).

---

## 7. Security Constraints

- All Rollout routes MUST require Supabase Auth (consistent with Admin middleware)
- All queries MUST be isolated by `workId`; cross-work access MUST return `SCENE_WORK_MISMATCH` or `NOT_FOUND` without leaking existence
- Projection Accept MUST NOT bypass operator confirmation on Scene Save
- No auto-projection, scheduled sync, or hidden Runtime writes in v1
- `linkedBy` and `approvedAt` audit fields MUST be populated from authenticated operator context
- Rollout routes MUST NOT be mounted on public Reader paths
- Rollout MUST NOT expose bypass paths from Discovery Accept directly to Scene table insert

---

## 8. Acceptance Criteria

### 8.1 SPEC document criteria (verified at Approved)

- [x] ROL-AC-01: Story↔Reading Route (implementation: Scene) N:M association with no identity merge documented in §4.3 and ROL-RC-08
- [x] ROL-AC-02: ROL-INV-01 through ROL-INV-07 mapped to testable ROL-RC-* in §3
- [x] ROL-AC-03: SPEC-D3-002 staging consumption and two-step Accept documented in §4.1, §4.5, OQ-ROL-001-04
- [x] ROL-AC-04: Scene Projection Accept create/link outcomes in §4.4 with CRUD delegation
- [x] ROL-AC-05: §2.1 boundary matrix consistent with SPEC-D3-002 §2.1
- [x] ROL-AC-06: OQ-ROL-001-01 through OQ-ROL-001-11 resolved or Deferred in §4.9
- [x] ROL-AC-07: No normative dependency on Discovery propose/regen or Enrichment `/suggest` routes
- [x] ROL-AC-08: Admin route minimum contracts in §4.7
- [x] ROL-AC-09: §8.2 implementation criteria and §10 validation commands present

### 8.2 Implementation criteria (verified at Implemented)

- [x] ROL-AC-IMP-01: Durable Approved Story unit persist from staging via Rollout API
- [x] ROL-AC-IMP-02: Reading Route Projection Accept creates or links Runtime Reading Route (implementation: Scene) via existing CRUD path
- [x] ROL-AC-IMP-03: Story ↔ Reading Route (implementation: Scene) link create/delete with explicit operator Accept
- [x] ROL-AC-IMP-04: Discovery Accept alone does not insert Reading Route (Scene) or Story unit durable rows
- [x] ROL-AC-IMP-05: Work-scoped Rollout UI entry at `/works/{workId}/rollout` (or equivalent)
- [x] ROL-AC-IMP-06: Unit/integration tests for link guards, staging validation, and workId isolation
- [x] ROL-AC-IMP-07: Reader topology unchanged — no Story routable entity added
- [x] ROL-AC-IMP-08: Staging import from Discovery snapshot without calling propose/regen
- [x] ROL-AC-IMP-09: `sourceReviewId` provenance retained on durable persist

**Implementation authority:** SPEC Approved → implement §8.2 → run §10 → mark SPEC **Implemented**. A separate Implementation plan MAY be used when migrations are required.

---

## 9. Non-Goals

- Discovery propose, regen, Review panel, or Candidate schema changes — SPEC-D3-001, SPEC-D3-002, SPEC-D3-003
- Enrichment field suggestion, Accept All, Retry Queue — SPEC-D2-002
- Story ONE Rule operator UI — ADR-005
- Auto-sync Story units to Reading Routes (implementation: Scenes) by title similarity or LLM matching — prohibited v1
- Background reconciliation jobs comparing Editorial vs Runtime — Deferred
- Reader routing, Story Images jsonb topology, or Scene ordering model changes — ADR-004
- Promoting Approved Story units to catalog Entities — ROL-INV-05
- Knowledge Graph extraction or Relationship Graph — post-v1
- Modifying SPEC-D3-002 Review state machine or Accept handoff semantics
- i18n framework — Implementation concern; SPEC body English-only

---

## 10. Validation

### 10.1 Governance review (Approved)

```bash
npm run check:governance
```

Manual checks:

- SPEC_RULES §6 section order and required metadata
- Derived From references ADR-007 without version suffix in cross-references
- §2.1 boundary matrix consistent with SPEC-D3-002 §2.1 and §9 Non-Goals
- §4.1 staging types traceable to SPEC-D3-002 §4.5 without field conflicts
- §4.4 Projection Accept traceable to ADR-007 Decision 4 and ROL-INV-02
- No normative dependency on Discovery propose/regen or Enrichment `/suggest`
- SPEC body English-only (no mixed CJK in normative text)
- ROL-RC-02 two-step Accept explicitly testable

### 10.2 Implementation validation (Implemented)

```bash
npm run check:governance
npm run test -- __tests__/rollout/
npx tsc --noEmit
```

| Check | Maps to |
| ----- | ------- |
| Story unit persist from staging | ROL-AC-IMP-01, ROL-RC-11 |
| Scene Projection Accept create/link | ROL-AC-IMP-02, ROL-RC-09, §4.4 |
| Link create/delete guards | ROL-AC-IMP-03, ROL-RC-08, ROL-RC-10 |
| No Discovery-only Accept Runtime write | ROL-AC-IMP-04, ROL-RC-02 |
| workId isolation tests | ROL-AC-IMP-06, ROL-RC-12 |
| Staging import without propose | ROL-AC-IMP-08, ROL-RC-06 |

Manual runtime checks (Path C):

- Discovery Accept story + scene → export/import staging → Persist Story unit → Projection Accept (create) → Link → Unlink
- Projection Accept (link_existing) without duplicate Scene row
- Verify Discovery routes do not write `story_units`, `story_scene_links`, or `scenes` on Review Accept alone
- Verify archived Story unit does not alter Scene records silently

Expected implementation anchors (read-only planning reference):

- `app/works/[workId]/rollout/page.tsx` (new)
- `app/api/admin/rollout/**` (new)
- `lib/rollout/story-units.ts` (new)
- `lib/rollout/story-scene-links.ts` (new)
- `lib/scenes.ts` — existing Scene persist
- `lib/discovery/review-types.ts` — staging type authority (read-only)
- `lib/discovery/review-session-storage.ts` — snapshot export (read-only)

---

## 11. Refs

### Governance

- `governance/Constitution.md`
- `governance/FOUNDATION.md`
- `governance/ADR_RULES.md`
- `governance/SPEC_RULES.md`
- `governance/templates/SPEC_TEMPLATE.md`
- `governance/specs/AUTHORITY_BOUNDARY_AND_PRECEDENCE_SPEC.md`

### ADR

- `docs/adr/007-rollout-architecture.md` — ADR-007 (parent; ROL-INV-*; Rollout Model; Architecture Closure)
- `docs/adr/004-source-of-canonical-truth.md` — ADR-004 (Human Acceptance; Runtime topology)
- `docs/adr/005-narrative-information-model.md` — ADR-005 (Story unit semantics; Editorial authority)
- `docs/adr/006-discovery-copilot-architecture.md` — ADR-006 (Discovery Accept outcome paths; staging ingress)

### Related SPECs

- `docs/specs/spec-d3-002-discovery-human-review.md` — SPEC-D3-002 (Implemented; staging authority; Discovery Accept)
- `docs/specs/spec-d3-001-discovery-platform.md` — SPEC-D3-001 (Implemented; session boundary)
- `docs/specs/spec-d3-003-discovery-proposals.md` — SPEC-D3-003 (Implemented; anti-reference for generation routes)
- `docs/specs/spec-core-001-entity-schema-registry.md` — SPEC-CORE-001 (Scene field validation reference)
- `docs/specs/spec-d2-002-enrichment-copilot.md` — SPEC-D2-002 (Enrichment boundary; anti-pattern reference)

### Precedence

```text
ADR-007 > SPEC-ROL-001 (Rollout authority)
ADR-005 > SPEC-ROL-001 (Story semantics)
ADR-004 > SPEC-ROL-001 (Runtime topology + Human Acceptance)
SPEC-D3-002 > SPEC-ROL-001 (staging type authority)
SPEC-ROL-001 > SPEC-D3-002 (downstream Runtime projection — does not alter Review semantics)
```

Rollout MUST NOT modify Discovery Review actions, Narrative Gate rules, or Candidate payload schema owned by upstream SPECs.

### Read-only implementation anchors (not modified by this SPEC document)

- `lib/discovery/review-types.ts` — staging interfaces
- `lib/discovery/review-session-storage.ts` — Discovery session snapshot
- `hooks/useDiscoverySession.ts` — upstream staging producer
- `components/discovery/DiscoveryReviewPanel.tsx` — no Runtime writes at Accept
- `lib/scenes.ts` — Runtime Reading Route (implementation: Scene) persist
- `components/scenes/*` — Reading Route (implementation: Scene) form fields

---

## Legacy Alias Reference

*Runtime vocabulary aligned with `governance/vocabulary/runtime-lexicon.md` (ADR-BP-RT-001).*

| Normative Term | Legacy Term | Classification | Status |
| -------------- | ----------- | -------------- | ------ |
| Reading Route | Scene | Implementation Alias | Active — implementation symbol `scenes` |
| Reading Frame | Story Image | Implementation Alias | Active — implementation symbol `story_images_v2[]` element |
