# SPEC-D3-003 — Discovery Proposals: Candidate Generation

## Metadata

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Title        | Discovery Proposals — Candidate Generation                            |
| Status       | Implemented                                                           |
| Version      | v1.0                                                                  |
| Owner        | Architect                                                             |
| Last Updated | 2026-06-30                                                            |
| Derived From | ADR-006 (`docs/adr/006-discovery-copilot-architecture.md`)            |
| Related      | SPEC-D3-001, SPEC-D3-002, ADR-005, ADR-007, SPEC-ROL-001, SPEC-D2-003, SPEC-CORE-001, SPEC-D2-002 |

**ADR-005 note:** Listed under Related for Story Candidate semantics and narrative-first alignment. Story boundary adjudication (ONE Rule) remains ADR-005 authority; this SPEC MUST NOT define ONE Rule UI.

**SPEC-D3-001 note:** Propose operations MUST consume a **locked** `NarrativeInputBundle` from an Implemented platform session (SPEC-D3-001 Status: Implemented). Narrative Gate rules (NG-*) remain D3-001 authority.

---

## 1. Purpose

ADR-006 closes Discovery architecture at the **What/Why** layer and defers **Character Discovery, Location Discovery, Story Discovery, and Scene Candidate Generation** to downstream specifications.

SPEC-D3-003 closes that deferral for the **Discovery Proposals** layer (EAR-S1 topology). It becomes the **sole governance authority** for:

- Propose operation: authenticated, work-scoped, narrative-locked Candidate generation
- Four Candidate type payloads (Character, Location, Story, Scene)
- Propose and regen API contracts (v1 minimum shapes)
- LLM output JSON schema and prompt input variable contract (not provider selection)
- Propose-phase enforcement of DISC-INV-01, DISC-INV-02, DISC-INV-03, DISC-INV-05, DISC-INV-06, and DISC-INV-07 subsets applicable at generation time

This specification defines **How** and **Validation** for the proposals layer. It does not restate ADR-006 Authority Emergence rationale. Human Review UI, Accept / Edit / Discard, and Re-propose operator workflows belong to SPEC-D3-002. Session lifecycle, Narrative Gate, and lock UI belong to SPEC-D3-001.

On Story semantics conflicts, ADR-005 governs. On Discovery boundary conflicts, ADR-006 governs.

---

## 2. Scope

### In Scope

- Propose API: requires `narrative_locked` session state; consumes locked `NarrativeInputBundle`
- Four `DiscoveryCandidateType` values with normative per-type `fields` bundles
- Base Candidate envelope (`candidateId`, `displayName`, `summary`, optional `confidence`, optional `evidence`)
- Partial success semantics for per-type generation failures
- Session handoff: `narrative_locked` → `proposing` → `review_pending` (aligns with SPEC-D3-001 §5)
- Regen API **shape** for Re-propose (operator feedback consumed by D3-002; generation triggered here)
- Server re-validation of locked narrative snapshot on propose (OQ-D3-003-04)
- v1 caps: all four types per propose call; max Candidates per type
- Implementation acceptance criteria (§8.2) and validation commands (§10) — **after Approved, Implementation executes directly from this SPEC; no separate Implementation plan**

### Out of Scope

| Topic | Owner |
| ----- | ----- |
| Discovery Session, Narrative Gate, lock/unlock UI | SPEC-D3-001 (Implemented) |
| Human Review panel, Accept / Edit / Discard, Re-propose UX | SPEC-D3-002 |
| Candidate persistence, staging DB, durable propose store | Deferred (ADR-006); SPEC-D3-002 may define review staging |
| Enrichment Copilot, `/api/admin/ai/suggest`, field-registry Copilot routing | SPEC-D2-002, SPEC-CORE-001 |
| Story ONE Rule adjudication UI | ADR-005 |
| Governed Editorial↔Runtime projection | SPEC-ROL-001 / ADR-007 |
| Work-level batch Discovery, catalog Accept All | ADR-006 Decision 8 — prohibited |
| LLM provider selection and deployment topology | Implementation layer |
| Production persist of Approved Entities | Production path (post-Review) |

### 2.1 Boundary Matrix (D3-001 / D3-003 / D3-002)

| Topic | D3-001 | D3-003 | D3-002 |
| ----- | ------ | ------ | ------ |
| Session create / teardown | Yes | Consume | Consume |
| Narrative bundle / gate | Yes | Propose input (locked) | Read-only |
| Propose generation | Handoff only | Yes | — |
| Candidate payload schema | — | Yes | Review display only |
| Accept / Edit / Discard | — | — | Yes |
| Re-propose | — | Regen API (generation) | UX + feedback |
| Persist Candidates / Entities | Prohibited | Prohibited at propose | Accept handoff only (SPEC-D3-002) |

This matrix MUST remain consistent with SPEC-D3-001 §2.1.

---

## 3. Runtime Contracts

**D3-RC-PRO-01 — Locked narrative required**

Propose MUST NOT execute unless the Discovery session is in `narrative_locked` or `proposing` state with a server-verified locked narrative snapshot for `(workId, sessionId, operatorId)`. Client state alone is insufficient.

**D3-RC-PRO-02 — Separate from Enrichment**

Propose MUST NOT invoke `/api/admin/ai/suggest`, Enrichment retry routes, `useCopilotSession`, or SPEC-CORE-001 Copilot routing (`getSuggestableFields`, scope-field suggest model). DISC-INV-06 and DISC-INV-07 apply.

**D3-RC-PRO-03 — Candidates only; no persist**

Propose output MUST be ephemeral Candidate objects. Propose MUST NOT insert, update, or upsert rows in `characters`, `locations`, `scenes`, `works`, or catalog tables (DISC-INV-01, ADR-006 Decision 2–3).

**D3-RC-PRO-04 — Candidate identity**

Each returned Candidate MUST include `candidateId` (ephemeral correlation id), `candidateType`, and `workId`. `candidateId` MUST NOT be reused as a production entity tsid or uuid.

**D3-RC-PRO-05 — No canonical authority**

Candidates MUST NOT be presented as Approved Entities. Optional `confidence` is a display hint only and MUST NOT bypass Human Review (DISC-INV-02, DISC-INV-03).

**D3-RC-PRO-06 — Story Candidate semantics**

Story Candidates MUST align with ADR-005 Story unit semantics. Proposed `fields` MUST NOT imply ONE Rule adjudication has occurred. Operators adjudicate boundaries in downstream Review / ADR-005 flows.

**D3-RC-PRO-07 — Scene Candidate semantics**

Scene Candidates are editorial proposals only. They MUST NOT be treated as Runtime Scene records. Cross-domain mapping requires human-accepted governed projection per ADR-007.

**D3-RC-PRO-08 — Narrative-first input**

Propose generation MUST use the locked `NarrativeInputBundle` as primary LLM context. Runtime Scene exports or catalog spine MUST NOT replace narrative input (already gated by SPEC-D3-001; propose MUST NOT accept unlock bypass).

**D3-RC-PRO-09 — Regen uses Discovery session**

Re-propose regen MUST use Discovery session APIs defined in this SPEC. Enrichment Batch Retry or `/api/admin/ai/suggest/retry` for Discovery regen is prohibited (DISC-INV-07, Master §1.E).

**D3-RC-PRO-10 — Admin-only propose routes**

Propose endpoints MUST be available only on Admin Discovery paths behind Supabase Auth middleware. Runtime reading routes MUST NOT expose propose APIs (DISC-INV-05).

**D3-RC-PRO-11 — Asset fields excluded from generation targets**

Candidate `fields` MUST NOT include asset-classified registry fields (`portraitUrl`, `story_images_v2`, map coordinates). Scope fields MAY be proposed as **new** catalog scope values for operator Review.

---

## 4. Data Contracts

### 4.1 DiscoveryCandidateType

```typescript
type DiscoveryCandidateType =
  | "character"
  | "location"
  | "story"
  | "scene";
```

v1 propose MUST attempt all four types on each full propose call (OQ-D3-003-01).

### 4.2 Evidence reference (optional)

When present, evidence MUST use a subset of SPEC-D2-003 provenance shape:

```typescript
interface DiscoveryEvidenceRef {
  sourceLabel: string;
  excerpt?:     string;
  tier?:        1 | 2 | 3;
  url?:         string;
}
```

Evidence is optional in v1 (OQ-D3-003-03). Implementation MAY load work-scoped source context via SPEC-D2-003 orchestration; MUST NOT treat evidence as canonical authority.

### 4.3 Base Candidate envelope

```typescript
interface DiscoveryCandidate {
  candidateId:   string;
  candidateType: DiscoveryCandidateType;
  workId:        string;
  displayName:   string;
  summary:       string;
  confidence?:   "green" | "yellow" | "red";
  evidence?:     DiscoveryEvidenceRef[];
  fields:        CharacterCandidateFields
               | LocationCandidateFields
               | StoryCandidateFields
               | SceneCandidateFields;
}
```

### 4.4 Per-type field bundles (v1 minimum)

Field names MUST align with SPEC-CORE-001 §4.3 form field names. Asset fields and v1 reference routes are excluded from AI generation targets (§3 D3-RC-PRO-11).

#### 4.4.1 Character Candidate (`candidateType: "character"`)

| Field | Required | Notes |
| ----- | -------- | ----- |
| `name` | Yes | Proposed scope value; operator Review before Production duplicate check |
| `house` | No | Canonical fact field |
| `description` | No | Narrative prose |
| `signatureQuote` | No | Narrative prose |

Excluded: `portraitUrl` and all system fields.

#### 4.4.2 Location Candidate (`candidateType: "location"`)

| Field | Required | Notes |
| ----- | -------- | ----- |
| `name` | Yes | Proposed scope value |
| `region` | No | Canonical fact field |
| `description` | No | Narrative prose |

Excluded: `map_focus_x`, `map_focus_y` and all system fields.

#### 4.4.3 Story Candidate (`candidateType: "story"`)

Story Candidates propose **editorial Story units**, not Production Entities (ADR-006 Human Review outcome paths).

| Field | Required | Notes |
| ----- | -------- | ----- |
| `title` | Yes | Story unit display title |
| `summary` | Yes | Narrative summary prose |
| `boundaryHint` | No | Operator orientation only; NOT ONE Rule adjudication |

#### 4.4.4 Scene Candidate (`candidateType: "scene"`)

| Field | Required | Notes |
| ----- | -------- | ----- |
| `chapter_title` | No | Proposed scope; nullable per scene form |
| `chapter_number` | Yes | Canonical ordering hint |
| `title` | Yes | Scene display title |
| `summary` | No | Narrative prose |

Excluded: `tags`, `story_images_v2`, `locationId`, `characterIds` in v1 propose output.

### 4.5 Propose API (v1 minimum)

**Full propose**

```typescript
// POST /api/admin/discovery/propose
interface ProposeDiscoveryRequest {
  workId:      string;
  sessionId:   string;
  narrative:   NarrativeInputBundle;
  lockedAt:    string;
}

interface ProposeTypeError {
  candidateType: DiscoveryCandidateType;
  code:          string;
  message:       string;
}

interface ProposeDiscoveryResponse {
  sessionId:   string;
  state:       "review_pending";
  candidates:  DiscoveryCandidate[];
  errors?:     ProposeTypeError[];
}
```

**Invariants:**

- Request MUST be authenticated; `workId` MUST belong to operator's accessible works
- Server MUST verify active lock for `(workId, sessionId, operatorId)` and that `narrative` + `lockedAt` match the server-stored lock snapshot (OQ-D3-003-04)
- Implementation MUST extend the SPEC-D3-001 server lock registry to retain `lockedAt` and normalized `narrative` per active lock; propose verification MUST NOT rely on client state alone
- Server MUST re-run SPEC-D3-001 Narrative Gate on `narrative` (without gate-only import flags)
- Server MUST NOT persist Candidates to database
- Response `candidates` length per type MUST NOT exceed **10** (OQ-D3-003-05)
- Partial type failure: HTTP **200** with both `candidates` and `errors` (OQ-D3-003-02)
- Total failure (zero candidates, all types failed): HTTP **502** `PROPOSE_GENERATION_FAILED`

`NarrativeInputBundle` shape is defined in SPEC-D3-001 §4.2.

### 4.6 Regen API (Re-propose generation shape)

Operator feedback and **when** to regen are owned by SPEC-D3-002. This SPEC defines the generation endpoint shape only.

```typescript
// POST /api/admin/discovery/propose/regen
interface RegenDiscoveryRequest {
  workId:            string;
  sessionId:         string;
  narrative:         NarrativeInputBundle;
  lockedAt:          string;
  candidateType:     DiscoveryCandidateType;
  previousCandidate: DiscoveryCandidate;
  feedback?:         string | null;
}

interface RegenDiscoveryResponse {
  sessionId:   string;
  candidate:   DiscoveryCandidate;
}
```

Regen MUST NOT call Enrichment retry routes. Regen MUST reuse the same locked narrative snapshot as the active Discovery session.

### 4.7 LLM prompt contract (normative variables)

Implementation MUST supply at minimum:

| Variable | Source |
| -------- | ------ |
| `workTitle` | `works.title` for `workId` |
| `narrativeBundle` | locked `NarrativeInputBundle` serialized |
| `candidateType` | current generation target |
| `maxCandidates` | 10 |
| `registryFieldHints` | allowed field names from §4.4 for type |

LLM output MUST be JSON parseable into an array of objects matching §4.3–§4.4 for the requested type. Malformed model output MUST surface as type-level error in `errors`, not silent drop.

Provider selection, model id, and token limits are Implementation concerns.

### 4.8 Resolved Open Questions

| ID | Resolution |
| -- | ---------- |
| OQ-D3-003-01 | v1 full propose generates **all four** types every call; no per-type operator toggle in v1 |
| OQ-D3-003-02 | Partial failure: HTTP **200** with `candidates` + `errors[]` per failed type |
| OQ-D3-003-03 | `evidence` optional v1; prompt SHOULD encourage citations when source context available |
| OQ-D3-003-04 | Server **MUST** verify lock registry + stored `lockedAt`/`narrative` snapshot; MUST re-run SPEC-D3-001 Narrative Gate on propose body; lock registry extension is Implementation responsibility |
| OQ-D3-003-05 | Max **10** Candidates per type per propose response |
| OQ-D3-003-06 | **Split:** D3-003 defines regen API (§4.6); D3-002 defines operator feedback UX and invoke timing |

---

## 5. State Transitions

Propose integrates with SPEC-D3-001 session states:

```text
[narrative_locked] → [proposing]       trigger: operator starts propose (this SPEC)
[proposing] → [review_pending]         trigger: propose returns candidates (including partial success)
[proposing] → [draft]                  trigger: total propose failure + operator reset (D3-001 §5)
[review_pending] → [proposing]         trigger: full re-propose (D3-002 MAY invoke; same locked narrative)
```

While `proposing`, narrative MUST remain immutable (SPEC-D3-001 D3-RC-04).

Client-side ephemeral Candidate list MUST be cleared on session teardown (D3-001 D3-RC-08).

---

## 6. Error Handling

| Condition | HTTP | Code | Response |
| --------- | ---- | ---- | -------- |
| Unauthenticated | 401 | `UNAUTHORIZED` | Message |
| Propose without active lock | 400 | `NARRATIVE_NOT_LOCKED` | Message |
| Narrative snapshot mismatch / gate fail | 422 | `NARRATIVE_INVALID` | Field-level detail |
| Work not found / wrong work | 404 | `SESSION_NOT_FOUND` | Message |
| Session conflict | 409 | `SESSION_ALREADY_ACTIVE` | Align SPEC-D3-001 |
| All types failed generation | 502 | `PROPOSE_GENERATION_FAILED` | Message |
| Partial type failure | 200 | — | `candidates` + `errors` |
| Regen invalid previous Candidate | 422 | `REGEN_INVALID` | Message |
| Teardown mid-propose | — | — | Cancel in-flight; clear ephemeral candidates client-side |

---

## 7. Security Constraints

- Propose routes MUST require Supabase Auth (consistent with Admin middleware)
- All queries MUST be isolated by `workId`; cross-work access MUST return `SESSION_NOT_FOUND`
- Propose MUST NOT expose auto-accept or bypass paths to Production persist (DISC-INV-02)
- Propose MUST NOT write Candidates or Entities to durable catalog or Runtime tables (DISC-INV-01)
- Propose routes MUST NOT be mounted on Runtime reading paths (DISC-INV-05)

---

## 8. Acceptance Criteria

### 8.1 SPEC document criteria (verified at Approved)

- [x] D3-AC-PRO-01: Four Candidate types with normative field bundles in §4.4
- [x] D3-AC-PRO-02: Boundary matrix consistent with SPEC-D3-001 §2.1 and §9
- [x] D3-AC-PRO-03: DISC-INV-01/02/03/05/07 reflected in §3 contracts
- [x] D3-AC-PRO-04: OQ-D3-003-01 through OQ-D3-003-06 resolved in §4.8
- [x] D3-AC-PRO-05: Regen API shape defined; Re-propose UX deferred to D3-002
- [x] D3-AC-PRO-06: Partial success and cap semantics defined
- [x] D3-AC-PRO-07: No normative dependency on Enrichment `/suggest` routes

### 8.2 Implementation criteria (verified — Implemented)

- [x] D3-AC-IMP-PRO-01: `POST /api/admin/discovery/propose` separate from `/api/admin/ai/suggest`
- [x] D3-AC-IMP-PRO-02: Propose rejects without verified lock (`NARRATIVE_NOT_LOCKED`)
- [x] D3-AC-IMP-PRO-03: No DB persist of Candidates at propose or regen
- [x] D3-AC-IMP-PRO-04: `useDiscoverySession` wires `proposing` → `review_pending` on success
- [x] D3-AC-IMP-PRO-05: Unit tests for payload validation, per-type caps, lock gate
- [x] D3-AC-IMP-PRO-06: `DiscoveryComposer` Propose button invokes real propose flow
- [x] D3-AC-IMP-PRO-07: Regen route implemented per §4.6 (generation only; no D3-002 UI required)

**Implementation authority:** SPEC Approved → implement §8.2 → run §10 → mark SPEC **Implemented**. No separate Implementation plan required.

---

## 9. Non-Goals

- Discovery Session lifecycle, Narrative Gate (NG-*), lock/unlock composer semantics — SPEC-D3-001
- Review panel layout, Accept / Edit / Discard buttons, Re-propose dialog — SPEC-D3-002
- Durable Candidate database, review staging schema — deferred; SPEC-D3-002 may own
- Enrichment field suggestion, Accept All, Retry Queue — SPEC-D2-002
- Field registry Copilot routing rules — SPEC-CORE-001
- Story ONE Rule operator UI — ADR-005
- Runtime Scene CRUD or governed projection writes — SPEC-ROL-001 / ADR-007
- Work-level batch propose or Accept All Candidates — ADR-006 Decision 8
- Knowledge Graph extraction — ADR-005 deferred capability
- Modifying SPEC-D3-001 Narrative Gate thresholds or NG rules

---

## 10. Validation

### 10.1 Governance review (Approved)

```bash
npm run check:governance
```

Manual checks:

- SPEC_RULES §6 section order and required metadata
- Derived From references ADR-006 without version suffix in cross-references
- §2.1 boundary matrix consistent with SPEC-D3-001 §2.1 and §9 Non-Goals
- §4.5 / §4.6 traceable to locked narrative handoff from SPEC-D3-001
- No normative dependency on Enrichment `/api/admin/ai/suggest`
- SPEC body English-only (no mixed CJK in normative text)

### 10.2 Implementation validation (Implemented)

```bash
npm run test -- __tests__/discovery/ __tests__/api/discovery-propose-route.test.ts
```

| Check | Maps to |
| ----- | ------- |
| Propose route lock gate tests | D3-AC-IMP-PRO-02, D3-RC-PRO-01 |
| Candidate payload / cap tests | D3-AC-IMP-PRO-05, OQ-D3-003-05 |
| No persist tests | D3-AC-IMP-PRO-03, D3-RC-PRO-03 |
| Separate from suggest route | D3-AC-IMP-PRO-01, D3-RC-PRO-02 |
| Session state integration tests | D3-AC-IMP-PRO-04 |

Expected implementation anchors (read-only planning reference):

- `app/api/admin/discovery/propose/route.ts`
- `app/api/admin/discovery/propose/regen/route.ts`
- `lib/discovery/propose-service.ts`
- `hooks/useDiscoverySession.ts` (propose action extension)
- `components/discovery/DiscoveryComposer.tsx`
- `__tests__/discovery/propose-service.test.ts`
- `__tests__/api/discovery-propose-route.test.ts`

---

## 11. Refs

### Governance

- `governance/Constitution.md`
- `governance/FOUNDATION.md`
- `governance/ADR_RULES.md`
- `governance/SPEC_RULES.md`
- `governance/templates/SPEC_TEMPLATE.md`

### ADR

- `docs/adr/006-discovery-copilot-architecture.md` — ADR-006 (parent; Decision 2–3, 5–6; DISC-INV-*; capability classes)
- `docs/adr/005-narrative-information-model.md` — ADR-005 (Story semantics; narrative-first)
- `docs/adr/007-rollout-architecture.md` — ADR-007 (Scene Candidate vs Runtime Scene; reference only)

### Related SPECs

- `docs/specs/spec-d3-001-discovery-platform.md` — SPEC-D3-001 (Implemented; locked narrative + session states)
- `docs/specs/spec-d3-002-discovery-human-review.md` — SPEC-D3-002 (Review / Re-propose; Implemented)
- `docs/specs/spec-rol-001-governed-projection.md` — SPEC-ROL-001 (Approved; downstream Runtime projection)
- `docs/specs/spec-core-001-entity-schema-registry.md` — SPEC-CORE-001 (field names and classifications)
- `docs/specs/spec-d2-003-source-connector-v1.md` — SPEC-D2-003 (optional evidence orchestration)
- `docs/specs/spec-d2-002-enrichment-copilot.md` — SPEC-D2-002 (Enrichment boundary; partial success reference)

### Precedence

```text
ADR-006 > SPEC-D3-003 > SPEC-D3-002 (generation vs review)
ADR-005 > SPEC-D3-003 (Story Candidate semantics)
SPEC-D3-001 > SPEC-D3-003 (session + lock authority)
```

Propose MUST NOT modify Narrative Gate rules owned by SPEC-D3-001.

### Read-only implementation anchors (not modified by this SPEC document)

- `hooks/useDiscoverySession.ts` — session state; propose placeholder
- `lib/ai/suggest-service.ts` — partial success pattern reference only
- `lib/ai/copilot-text-llm.ts` — LLM adapter reuse per ADR-006 Decision 6
- `lib/ai/field-registry.ts` — field name alignment reference
- `app/api/admin/discovery/session/lock/route.ts` — lock verification reference
