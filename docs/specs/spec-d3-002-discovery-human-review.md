# SPEC-D3-002 — Discovery Human Review: Accept, Edit, Discard, Re-propose

## Metadata

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Title        | Discovery Human Review — Accept, Edit, Discard, Re-propose            |
| Status       | Approved                                                              |
| Version      | v1.0                                                                  |
| Owner        | Architect                                                             |
| Last Updated | 2026-07-01                                                            |
| Derived From | ADR-006 (`docs/adr/006-discovery-copilot-architecture.md`)            |
| Related      | SPEC-D3-001, SPEC-D3-003, ADR-005, ADR-007, SPEC-CORE-001, SPEC-D2-002 |

**ADR-005 note:** Listed under Related for Story unit semantics and Human Review outcome paths. Story boundary adjudication (ONE Rule) remains ADR-005 authority; this SPEC MUST NOT define ONE Rule UI.

**ADR-006 note:** Human Review is the last step of Discovery (Decision 4). **Accept into an Approved Entity or Approved Story unit** is a Production entry action, not a Discovery persist operation.

**SPEC-D3-001 note:** Review operations MUST consume session state `review_pending` and the locked `NarrativeInputBundle` established by SPEC-D3-001 (Status: Implemented). Session lifecycle and Narrative Gate (NG-*) remain D3-001 authority. `review_pending` MUST reuse the locked narrative without unlock (OQ-D3-002-06).

**SPEC-D3-003 note:** Candidate payload schema authority remains SPEC-D3-003. Regen API shape is defined in SPEC-D3-003 §4.6; this SPEC owns operator Review UX and invoke timing only.

---

## 1. Purpose

ADR-006 closes Discovery architecture at the **What/Why** layer and defers **Candidate Review workflows** to downstream specifications.

SPEC-D3-002 closes that deferral for the **Discovery Human Review** layer (EAR-S1 topology). It becomes the **sole governance authority** for:

- Operator Review of ephemeral Candidates returned by SPEC-D3-003 propose
- Per-candidate Accept, Edit, Discard actions (Human Review as the last Discovery step)
- Re-propose operator UX: per-candidate regen with optional feedback and full re-propose
- Accept outcome handoff into Production entry paths (Catalog Entity vs Story unit vs Scene editorial staging)
- Review-phase enforcement of DISC-INV-01, DISC-INV-02, DISC-INV-03, and DISC-INV-07 subsets applicable at Review time

This specification defines **How** and **Validation** for the Review layer. It does not restate ADR-006 Authority Emergence rationale. Propose generation, regen API contracts, and LLM output shapes belong to SPEC-D3-003. Session lifecycle, Narrative Gate, and lock UI belong to SPEC-D3-001.

On Story semantics conflicts, ADR-005 governs. On Discovery boundary conflicts, ADR-006 governs.

---

## 2. Scope

### In Scope

- Review panel UX contract: normative operator behaviors (not pixel-level UI Spec)
- Per-candidate actions: Accept, Edit, Discard
- Per-candidate regen: invoke SPEC-D3-003 `POST /api/admin/discovery/propose/regen` with optional `feedback`
- Full re-propose: invoke SPEC-D3-003 `POST /api/admin/discovery/propose`; session `review_pending` ↔ `proposing`
- Review item state machine (`pending`, `edited_pending_accept`, `discarded`, `accepted`)
- Evidence and `fields` co-display when present (ADR-006 Human Cost optimization; per-candidate review without weakening Accept gate)
- Accept handoff v1 minimum for character and location Candidates (entity create prefill → existing CRUD Save)
- Accept staging v1 for story and scene Candidates (client session state; no Runtime writes)
- Session integration while `review_pending`; narrative immutability preserved during Re-propose
- Implementation acceptance criteria (§8.2) and validation commands (§10) — **after Approved, Implementation executes directly from this SPEC; no separate Implementation plan**

### Out of Scope

| Topic | Owner |
| ----- | ----- |
| Discovery Session, Narrative Gate, lock/unlock UI | SPEC-D3-001 (Implemented) |
| Propose / regen API shapes, Candidate payload schema, LLM generation | SPEC-D3-003 (Implemented) |
| Enrichment Copilot, `/api/admin/ai/suggest`, Retry Queue, entity-scoped Accept All | SPEC-D2-002 |
| Field registry Copilot routing | SPEC-CORE-001 |
| Story ONE Rule adjudication UI | ADR-005 |
| Governed Editorial↔Runtime projection writes, Story↔Scene link API | SPEC-ROL-001 / ADR-007 |
| Work-level Accept All Candidates, batch auto-accept | ADR-006 Decision 8 — prohibited |
| Durable review staging database schema | Deferred beyond v1 client session state (OQ-D3-002-04) |
| Knowledge Graph extraction | ADR-005 deferred capability |

### 2.1 Boundary Matrix (D3-001 / D3-002 / D3-003)

| Topic | D3-001 | D3-002 | D3-003 |
| ----- | ------ | ------ | ------ |
| Session create / teardown | Yes | Consume | Consume |
| Narrative bundle / gate | Yes | Read-only during Review | Propose input (locked) |
| Propose generation | Handoff only | Trigger only (full re-propose) | Yes |
| Candidate payload schema | — | Display / Edit consumes D3-003 | Yes |
| Accept / Edit / Discard | — | Yes | — |
| Re-propose UX + feedback | — | Yes | Regen API (generation) |
| Persist at propose / regen | Prohibited | — | Prohibited |
| Persist at Accept | — | Production handoff only; no silent DB insert (§4.4) | — |

This matrix MUST remain consistent with SPEC-D3-001 §2.1 and SPEC-D3-003 §2.1.

### 2.2 Contrast with Enrichment Accept (anti-pattern reference)

| Dimension | Enrichment (SPEC-D2-002) | Discovery Review (this SPEC) |
| --------- | ------------------------ | ------------------------------ |
| Review object | Field-level `SuggestionItem` | Typed `DiscoveryCandidate` (SPEC-D3-003) |
| Accept effect | Writes form state only; DB on entity Save | Production entry handoff per ADR-006 outcome path |
| Retry / regenerate | Enrichment Retry Queue + `/suggest/retry` | Re-propose via D3-003 regen / full propose |
| Session | Entity-scoped Enrichment session | Work-scoped Discovery session (DISC-INV-07) |
| Accept All | Entity-scoped permitted | Work-level Accept All **prohibited** (Decision 8) |

Extending `useCopilotSession` or Enrichment retry semantics for Discovery Review is prohibited.

---

## 3. Runtime Contracts

**D3-RC-REV-01 — Explicit Accept required**

Each Candidate MUST receive an explicit operator Accept action before entering a Production path. No auto-accept, default-accept, or implicit promotion is permitted (DISC-INV-02).

**D3-RC-REV-02 — Candidates are not canonical**

Review UI MUST NOT label Candidates as Approved Entities, Runtime Truth, or pre-approved catalog records. Optional `confidence` from propose output is a display hint only (DISC-INV-03).

**D3-RC-REV-03 — Discard is terminal**

Discard MUST remove the Candidate from the active review set with no canonical standing. Discarded Candidates MUST NOT be silently restored without a new propose or regen operation.

**D3-RC-REV-04 — Re-propose uses Discovery routes only**

Regen and full re-propose MUST invoke SPEC-D3-003 Discovery propose routes. Enrichment `/api/admin/ai/suggest/retry`, Batch Retry, or `useCopilotSession` retry semantics for Discovery Review are prohibited (DISC-INV-07; independent Discovery session per SPEC-D3-001 §5).

**D3-RC-REV-05 — Locked narrative during Re-propose**

Full re-propose and regen MUST reuse the active locked `NarrativeInputBundle` and `lockedAt` snapshot verified by SPEC-D3-003. Review MUST NOT unlock or edit narrative during Re-propose (SPEC-D3-001 D3-RC-04).

**D3-RC-REV-06 — Edit requires re-Accept**

Edit MAY change Candidate display fields and `fields` payload in client review state. An edited Candidate MUST remain a Candidate until the operator performs Accept. Edit alone MUST NOT enter Production.

**D3-RC-REV-07 — Catalog Entity Accept path**

Accept on `character` or `location` Candidates MUST follow the ADR-006 Catalog Entity outcome path: handoff to entity create flow with field prefill; first catalog authority occurs only after operator Save through existing CRUD (not at Accept click alone).

**D3-RC-REV-08 — Story unit Accept path**

Accept on `story` Candidates MUST produce an Approved Story unit semantic object in client staging. Accept MUST NOT insert a catalog Entity row or claim Entity standing (ADR-006 Human Review outcome paths, ADR-005).

**D3-RC-REV-09 — Scene Accept path**

Accept on `scene` Candidates MUST mark an accepted editorial scene candidate in client staging. Accept MUST NOT create or update Runtime Scene records. Governed projection belongs to SPEC-ROL-001 / ADR-007.

**D3-RC-REV-10 — No work-level Accept All**

Review MUST NOT expose work-level or catalog-level Accept All for Candidates (ADR-006 Decision 8).

**D3-RC-REV-11 — Evidence co-display**

When `candidate.evidence` is present, Review MUST display evidence alongside `fields` and `summary` in the same review context.

**D3-RC-REV-12 — Review does not persist at generation boundary**

Review actions MUST NOT be implemented inside propose or regen route handlers. Generation and Review authority boundaries MUST remain separate (ADR-006 Decision 4).

**D3-RC-REV-13 — v1 review staging is client session state**

Review item state and accepted staging objects for story/scene v1 MUST live in Discovery client session state aligned with SPEC-D3-001 (no durable review DB in v1). Page refresh MAY lose unstaged review progress; UI MUST warn when leaving with pending items.

**D3-RC-REV-14 — No Candidate persist at Review**

Review operations MUST NOT insert, update, or upsert Candidate rows or review staging rows in catalog or Runtime tables. Accept handoff for character/location MUST occur only through explicit navigation to existing CRUD create flows (DISC-INV-01).

**D3-RC-REV-15 — Locked narrative reuse during Review**

While session state is `review_pending`, Re-propose and regen MUST reuse the locked `NarrativeInputBundle` and `lockedAt` from the active Discovery session without requiring unlock. This closes SPEC-D3-001 deferral on `review_pending` narrative reuse (OQ-D3-002-06).

---

## 4. Data Contracts

### 4.1 Review item envelope

Review wraps SPEC-D3-003 `DiscoveryCandidate` objects. Candidate schema authority remains SPEC-D3-003 §4.3–§4.4.

```typescript
type ReviewItemStatus =
  | "pending"
  | "edited_pending_accept"
  | "discarded"
  | "accepted";

interface DiscoveryReviewItem {
  reviewId:      string;   // client correlation id; not a production id
  candidate:     DiscoveryCandidate;
  status:        ReviewItemStatus;
  editedFields?: DiscoveryCandidate["fields"];
  editedDisplayName?: string;
  editedSummary?: string;
  operatorNotes?: string;
  reviewedAt?:   string;  // ISO-8601 when terminal action taken
}
```

On Accept, the effective Candidate payload MUST be:

- `editedFields` / edited display fields when status was `edited_pending_accept`
- otherwise the original `candidate` fields and display values

### 4.2 Review panel contract (normative behaviors)

Implementation MUST provide, for each active (non-discarded) review item:

| UI element | Requirement |
| ---------- | ----------- |
| Candidate summary | Show `displayName`, `summary`, `candidateType`, optional `confidence` (hint only) |
| Fields panel | Show type-specific `fields` from SPEC-D3-003 §4.4 |
| Evidence panel | Show `evidence[]` when present (D3-RC-REV-11) |
| Accept | Enabled for `pending` and `edited_pending_accept` |
| Edit | Enabled for `pending` only |
| Discard | Enabled for `pending` and `edited_pending_accept` |
| Regen | Enabled for `pending` and `edited_pending_accept`; opens optional feedback input |

Review MUST be grouped by `candidateType` (`character`, `location`, `story`, `scene`) to support chunked operator review without work-level Accept All.

### 4.3 Operator action contracts

| Action | Preconditions | Effects |
| ------ | ------------- | ------- |
| **Discard** | status `pending` or `edited_pending_accept` | status → `discarded`; excluded from Production handoff |
| **Edit** | status `pending` | Open editor for `fields`, `displayName`, `summary`; on save → `edited_pending_accept` |
| **Accept** | status `pending` or `edited_pending_accept` | Execute Accept handoff per §4.4; status → `accepted` |
| **Regen** | status `pending` or `edited_pending_accept` | Call SPEC-D3-003 regen (§4.6); replace candidate in review set; reset item to `pending` |
| **Full re-propose** | session `review_pending`, lock active | Call SPEC-D3-003 full propose; replace entire review set; reinitialize review items as `pending` |

### 4.4 Accept outcome handoff (v1)

Accept is a **Production entry** operator action (ADR-006 Decision 4). Accept MUST NOT perform silent database insert/update/upsert.

Outcome paths MUST align with ADR-006 **Human Review outcome paths** (Catalog Entity vs Story unit vs Scene editorial).

#### 4.4.1 Character Candidate Accept

| Step | Behavior |
| ---- | -------- |
| 1 | Validate effective fields against SPEC-CORE-001 character registry field names and mandatory-at-creation rules applicable to create flow |
| 2 | Navigate operator to `/works/{workId}/characters/new` with `DiscoveryAcceptPrefill` (§4.4.5) |
| 3 | Operator MUST explicitly Save through existing Character CRUD to create catalog record |
| 4 | Mark review item `accepted` after handoff navigation succeeds |

#### 4.4.2 Location Candidate Accept

Same pattern as §4.4.1 with location create route `/works/{workId}/locations/new`, SPEC-CORE-001 location registry validation, and `DiscoveryAcceptPrefill` (§4.4.5).

#### 4.4.3 Story Candidate Accept

| Step | Behavior |
| ---- | -------- |
| 1 | Construct `AcceptedStoryUnitStaging` object in client session state (§4.5) |
| 2 | Mark review item `accepted` |
| 3 | MUST NOT insert catalog Entity rows or claim Entity standing |

Durable Approved Story unit storage schema is **Deferred** beyond v1 client staging (OQ-D3-002-02).

#### 4.4.4 Scene Candidate Accept

| Step | Behavior |
| ---- | -------- |
| 1 | Construct `AcceptedSceneCandidateStaging` object in client session state (§4.5) |
| 2 | Mark review item `accepted` |
| 3 | MUST NOT create or update Runtime Scene records (D3-RC-REV-09) |

SPEC-ROL-001 consumes accepted scene staging for governed projection.

#### 4.4.5 Entity create prefill contract (character / location)

Accept handoff for catalog Entity Candidates MUST use client-side navigation state only until CRUD Save:

```typescript
interface DiscoveryAcceptPrefill {
  source:        "discovery_review";
  reviewId:      string;
  candidateType: "character" | "location";
  workId:        string;
  fields:        Record<string, unknown>;  // effective fields after Edit
  displayName:   string;
  summary:       string;
}
```

Implementation MUST pass `DiscoveryAcceptPrefill` via router state or equivalent ephemeral client transport. Prefill MUST NOT write to Supabase. Entity create forms MUST treat prefill as initial form values subject to operator edit before Save.

### 4.5 Accepted staging objects (v1 client session)

```typescript
interface AcceptedStoryUnitStaging {
  workId:        string;
  sourceReviewId: string;
  title:         string;
  summary:       string;
  boundaryHint?: string;
  acceptedAt:    string;
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

These objects are **Editorial staging** only. They MUST NOT be written to Supabase in v1 Accept handler code within this SPEC scope.

### 4.6 Regen invoke contract (consumer of SPEC-D3-003 §4.6)

Review layer MUST call regen with:

```typescript
interface ReviewRegenInvoke {
  workId:            string;
  sessionId:         string;
  narrative:         NarrativeInputBundle;  // locked snapshot from session
  lockedAt:          string;
  candidateType:     DiscoveryCandidateType;
  previousCandidate: DiscoveryCandidate;    // item being regenerated
  feedback?:         string | null;         // operator optional
}
```

On success, Review MUST **replace** the matching review item's `candidate` with the returned candidate and set item status to `pending`. Regen MUST NOT append duplicate slots for the same logical item (OQ-D3-002-07).

Review MUST NOT redefine regen request/response shapes; SPEC-D3-003 §4.6 remains authoritative.

### 4.7 Full re-propose invoke contract

Review layer MUST call full propose with locked `narrative` and `lockedAt` per SPEC-D3-003 §4.5.

Effects:

- Session state transitions `review_pending` → `proposing` → `review_pending` on success
- Prior review items and unstaged edits are discarded when the new candidate set replaces the review set
- Operator MUST confirm before full re-propose when pending or edited items exist

Full re-propose MAY omit per-candidate feedback (regenerates all four types per SPEC-D3-003 OQ-D3-003-01).

### 4.8 Partial propose failure in Review context

When SPEC-D3-003 returns `errors[]` for failed types alongside successful `candidates`:

- Review MUST still initialize review items for returned candidates
- Review MUST surface failed types with empty sections and a regen or full re-propose call-to-action
- Successful types MUST remain reviewable without blocking on failed types (OQ-D3-002-09)

### 4.9 Resolved Open Questions

| ID | Resolution |
| -- | ---------- |
| OQ-D3-002-01 | Accept v1 MUST NOT silent DB insert. Character/location Accept = navigate prefill + existing CRUD Save. Story/scene Accept = client staging objects only |
| OQ-D3-002-02 | Durable Approved Story unit DB schema **Deferred**. v1 uses `AcceptedStoryUnitStaging` in client session |
| OQ-D3-002-03 | Scene Accept marks `AcceptedSceneCandidateStaging` only; no Runtime Scene write in D3-002; ROL-001 owns projection |
| OQ-D3-002-04 | Review staging v1 is **client session state** aligned with D3-001 (no durable review DB). UI warns on navigation away with pending items |
| OQ-D3-002-05 | Edit UX v1: modal editor for `fields`, `displayName`, `summary`; save → `edited_pending_accept` |
| OQ-D3-002-06 | `review_pending` **reuses** locked narrative for Re-propose/regen without unlock (D3-RC-REV-15). Session remains `review_pending` until operator teardown; terminal review items do not auto-unlock narrative |
| OQ-D3-002-07 | Regen **replaces** candidate in the same review slot (match by `reviewId` or replaced `candidateId`) |
| OQ-D3-002-08 | Evidence co-display **required** when `evidence[]` present (D3-RC-REV-11) |
| OQ-D3-002-09 | Partial propose errors MUST NOT block review of successful types |
| OQ-D3-002-10 | Single active Discovery session per `(workId, operatorId)`; cross-tab conflict aligns with SPEC-D3-001 `SESSION_ALREADY_ACTIVE` |

---

## 5. State Transitions

Review integrates with SPEC-D3-001 and SPEC-D3-003 session states:

```text
[review_pending] + candidates present       entry: SPEC-D3-003 propose success
[review_pending] → [proposing]              trigger: operator full re-propose (confirmed)
[proposing] → [review_pending]              trigger: SPEC-D3-003 propose success (review set replaced)
[review_item] pending → edited_pending_accept   trigger: Edit save
[review_item] pending | edited_pending_accept → discarded   trigger: Discard
[review_item] pending | edited_pending_accept → accepted    trigger: Accept handoff (§4.4)
[review_pending] → [closed]                 trigger: operator teardown / navigate away (D3-001 D3-RC-08)
```

While regen is in-flight for a single item, other review items MUST remain interactable unless Implementation chooses a global busy lock; if a global lock is used, it MUST NOT exceed the regen request lifecycle.

Re-propose during Review MUST NOT transition narrative to editable `draft` without explicit unlock (SPEC-D3-001 §5).

---

## 6. Error Handling

| Condition | Required response | Recovery |
| --------- | ----------------- | -------- |
| Regen without active lock | Surface SPEC-D3-003 `NARRATIVE_NOT_LOCKED` | Operator re-lock or reset session |
| Regen invalid previous candidate | Surface `REGEN_INVALID` | Keep prior candidate; operator may Edit or Discard |
| Regen transport failure | Show error; keep prior candidate | Retry regen |
| Accept validation fail (CORE-001 / required fields) | Block Accept; show field errors | Operator Edit |
| Full re-propose total failure | Surface `PROPOSE_GENERATION_FAILED` | Operator retry or end session |
| Session conflict | Surface `SESSION_ALREADY_ACTIVE` | Align SPEC-D3-001 recovery |
| Navigate away with pending items | Warn before teardown | Operator confirm discard or stay |

---

## 7. Security Constraints

- Review UI and any Review-specific routes MUST require Supabase Auth (consistent with Admin middleware)
- Review state MUST be isolated by `workId`; cross-work handoff is prohibited
- Accept handoff MUST NOT bypass operator confirmation on entity CRUD Save
- Review MUST NOT expose auto-accept or bypass paths (DISC-INV-02)
- Review MUST NOT write Candidates or Accepted outcomes to durable catalog or Runtime tables in v1 Accept handlers except through existing explicit CRUD paths for character/location (D3-RC-REV-07)
- Review MUST NOT be mounted on Runtime reading paths (DISC-INV-05)

---

## 8. Acceptance Criteria

### 8.1 SPEC document criteria (verified at Approved)

- [x] D3-AC-REV-01: Per-candidate Accept, Edit, Discard, Regen actions defined in §4.3
- [x] D3-AC-REV-02: Boundary matrix consistent with SPEC-D3-001 §2.1 and SPEC-D3-003 §2.1
- [x] D3-AC-REV-03: ADR-006 Human Review outcome paths reflected in §4.4
- [x] D3-AC-REV-04: Re-propose + optional feedback defined in §4.6–§4.7 (operator alternative to Discard per ADR-006 Decision 4)
- [x] D3-AC-REV-05: OQ-D3-002-01 through OQ-D3-002-10 resolved in §4.9
- [x] D3-AC-REV-06: Enrichment contrast documented in §2.2 without normative dependency on `/suggest`
- [x] D3-AC-REV-07: DISC-INV-01/02/03/07 reflected in §3 contracts
- [x] D3-AC-REV-08: Entity create prefill contract defined in §4.4.5 without silent persist

### 8.2 Implementation criteria (verified after Approved — execute directly from this SPEC)

- [ ] D3-AC-IMP-REV-01: Review panel replaces ephemeral Candidate preview in `DiscoveryComposer`
- [ ] D3-AC-IMP-REV-02: Per-candidate Accept, Edit, Discard wired for all four types
- [ ] D3-AC-IMP-REV-03: Regen invokes `/api/admin/discovery/propose/regen` with optional feedback
- [ ] D3-AC-IMP-REV-04: Full re-propose invokes `/api/admin/discovery/propose`; session `review_pending` ↔ `proposing`
- [ ] D3-AC-IMP-REV-05: Accept (character/location) handoff to entity create prefill routes via `DiscoveryAcceptPrefill` (§4.4.5)
- [ ] D3-AC-IMP-REV-06: No work-level Accept All; no auto-accept controls
- [ ] D3-AC-IMP-REV-07: Unit or integration tests for review item state machine and handoff guards
- [ ] D3-AC-IMP-REV-08: Discard permanently removes item from active review set
- [ ] D3-AC-IMP-REV-09: Story/scene Accept writes client staging objects only (no Runtime DB write)
- [ ] D3-AC-IMP-REV-10: Evidence displayed when present on Candidate

**Implementation authority:** SPEC Approved → implement §8.2 → run §10 → mark SPEC **Implemented**. No separate Implementation plan required.

---

## 9. Non-Goals

- Discovery Session lifecycle, Narrative Gate (NG-*), lock/unlock composer — SPEC-D3-001
- Propose generation, regen API route implementation, Candidate JSON schema — SPEC-D3-003
- Enrichment field suggestion, Retry Queue, Narrative Regenerate on entity forms — SPEC-D2-002
- Field registry Copilot routing rules — SPEC-CORE-001
- Story ONE Rule operator UI — ADR-005
- Governed projection API, Runtime Scene writes from accepted scene Candidates — SPEC-ROL-001
- Work-level Accept All Candidates — ADR-006 Decision 8
- Durable review staging database — deferred beyond v1 (OQ-D3-002-04)
- Modifying SPEC-D3-003 regen or propose contracts
- Modifying SPEC-D3-001 Narrative Gate thresholds or session state enum

---

## 10. Validation

### 10.1 Governance review (Approved)

```bash
npm run check:governance
```

Manual checks:

- SPEC_RULES §6 section order and required metadata
- Derived From references ADR-006 without version suffix in cross-references
- §2.1 boundary matrix consistent with SPEC-D3-001 §2.1 and SPEC-D3-003 §2.1
- §4.4 Accept handoff traceable to ADR-006 Human Review outcome paths
- §4.6 consumes SPEC-D3-003 §4.6 without redefining shapes
- No normative dependency on Enrichment `/api/admin/ai/suggest` or retry routes
- SPEC body English-only (no mixed CJK in normative text)

### 10.2 Implementation validation (after Approved)

```bash
npm run test -- __tests__/discovery/
```

| Check | Maps to |
| ----- | ------- |
| Review state machine tests | D3-AC-IMP-REV-07, D3-RC-REV-06 |
| Regen invoke tests | D3-AC-IMP-REV-03, D3-RC-REV-04 |
| Accept handoff guard tests | D3-AC-IMP-REV-05, D3-RC-REV-07, §4.4.5 |
| No auto-accept / Accept All | D3-AC-IMP-REV-06, D3-RC-REV-10 |
| Discard terminal behavior | D3-AC-IMP-REV-08, D3-RC-REV-03 |
| Story/scene staging only | D3-AC-IMP-REV-09, D3-RC-REV-08/09 |

Expected implementation anchors (read-only planning reference):

- `components/discovery/DiscoveryReviewPanel.tsx` (new)
- `components/discovery/DiscoveryComposer.tsx`
- `hooks/useDiscoverySession.ts`
- `app/works/[workId]/characters/new/page.tsx`
- `app/works/[workId]/locations/new/page.tsx`
- `__tests__/discovery/review-session.test.ts`

Manual runtime checks:

- Propose → Review each type → Discard / Edit / Accept paths
- Regen with feedback replaces single candidate
- Full re-propose replaces entire set after confirmation
- Character Accept prefill → Save creates record; no insert on Accept click alone

---

## 11. Refs

### Governance

- `governance/Constitution.md`
- `governance/FOUNDATION.md`
- `governance/ADR_RULES.md`
- `governance/SPEC_RULES.md`
- `governance/templates/SPEC_TEMPLATE.md`

### ADR

- `docs/adr/006-discovery-copilot-architecture.md` — ADR-006 (parent; Decision 4; Human Review outcome paths; DISC-INV-*)
- `docs/adr/005-narrative-information-model.md` — ADR-005 (Story unit semantics)
- `docs/adr/007-rollout-architecture.md` — ADR-007 (Scene Candidate vs Runtime Scene; projection deferral)

### Related SPECs

- `docs/specs/spec-d3-001-discovery-platform.md` — SPEC-D3-001 (Implemented; session + lock authority)
- `docs/specs/spec-d3-003-discovery-proposals.md` — SPEC-D3-003 (Implemented; Candidate schema + regen API)
- `docs/specs/spec-core-001-entity-schema-registry.md` — SPEC-CORE-001 (Accept field validation)
- `docs/specs/spec-d2-002-enrichment-copilot.md` — SPEC-D2-002 (Enrichment boundary; anti-pattern reference)

### Precedence

```text
ADR-006 > SPEC-D3-002 (Review authority)
SPEC-D3-003 > SPEC-D3-002 (Candidate schema + generation)
SPEC-D3-001 > SPEC-D3-002 (session + lock authority)
ADR-005 > SPEC-D3-002 (Story unit semantics)
SPEC-ROL-001 > SPEC-D3-002 (Scene Runtime projection — downstream)
```

Review MUST NOT modify Narrative Gate rules, propose contracts, or Candidate payload schema owned by upstream SPECs.

### Read-only implementation anchors (not modified by this SPEC document)

- `components/discovery/DiscoveryComposer.tsx` — ephemeral preview to be replaced
- `hooks/useDiscoverySession.ts` — candidates and session state
- `app/api/admin/discovery/propose/regen/route.ts` — regen consumer target
- `lib/discovery/propose-types.ts` — Candidate types
- `hooks/useCopilotSession.ts` — Enrichment anti-pattern reference
- `components/characters/CharacterForm.tsx` — Accept prefill target
