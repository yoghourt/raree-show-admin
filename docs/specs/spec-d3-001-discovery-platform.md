# SPEC-D3-001 — Discovery Platform: Session & Narrative Input

## Metadata

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Title        | Discovery Platform — Session & Narrative Input                        |
| Status       | Implemented                                                           |
| Version      | v1.0                                                                  |
| Owner        | Architect                                                             |
| Last Updated | 2026-06-30                                                            |
| Derived From | ADR-006 (`docs/adr/006-discovery-copilot-architecture.md`)            |
| Related      | ADR-005, SPEC-D3-002, SPEC-D3-003, SPEC-D2-002, SPEC-CORE-001        |

**ADR-005 note:** Listed under Related for narrative-first semantics only. Narrative input rules in this SPEC MUST align with ADR-005 Decision 6 (Narrative Precedes Knowledge). Story boundary adjudication remains ADR-005 authority.

---

## 1. Purpose

ADR-006 closes Discovery architecture at the **What/Why** layer and defers **Discovery session implementation** to downstream specifications.

SPEC-D3-001 closes that deferral for the **Discovery Platform** layer (EAR-S1 topology). It becomes the **sole governance authority** for:

- Work-scoped Discovery Session lifecycle (through narrative lock and propose handoff)
- Narrative Input Bundle shape and Narrative Gate validation
- Operator UI input guidance before any AI proposal (Master frozen intent §1.D)
- Platform-layer enforcement of DISC-INV-01, DISC-INV-04, DISC-INV-05, DISC-INV-06, DISC-INV-07 subsets applicable before Human Review

This specification defines **How** and **Validation** for the platform layer. It does not restate ADR-006 Authority Emergence rationale. Human Review, Re-propose, and Candidate proposal generation belong to SPEC-D3-002 and SPEC-D3-003 respectively.

On narrative semantics conflicts, ADR-005 governs. On Discovery boundary conflicts, ADR-006 governs.

---

## 2. Scope

### In Scope

- Discovery Session: **work-scoped** (`workId` required); independent from Enrichment session (DISC-INV-07)
- Session state machine from `draft` through `review_pending` handoff
- Narrative Input Bundle data contract and Narrative Gate validation
- Permitted input modes: cross-chapter **excerpt bundle**; operator **approved summary** with attestation
- Forbidden sole inputs: keywords alone; Runtime Scene structure alone; Chapter Catalog spine alone
- UI input guidance contract: session gate, persistent hints, good/bad examples (normative copy; not pixel-level UI Spec)
- Consumer contract: SPEC-D3-002 and SPEC-D3-003 MUST consume **locked** narrative from session handoff
- Open questions OQ-D3-001-01 through OQ-D3-001-04 resolved in §4.5
- Implementation acceptance criteria (§8.2) and validation commands (§10) — **after Approved, Implementation executes directly from this SPEC; no separate Implementation plan**

### Out of Scope

| Topic | Owner |
| ----- | ----- |
| Candidate generation, proposal payloads, LLM prompts | SPEC-D3-003 |
| Human Review (Accept / Edit / Discard / Re-propose) | SPEC-D3-002 |
| Candidate persistence, staging DB, durable session store | Deferred (ADR-006); SPEC-D3-002 may define review staging |
| Enrichment Copilot, field registry, `/suggest` / retry | SPEC-D2-002, SPEC-CORE-001 |
| Story boundary definition (ONE Rule adjudication) | ADR-005 |
| Governed Editorial↔Runtime projection | SPEC-ROL-001 |
| Work-level batch Discovery, catalog Accept All | ADR-006 Decision 8 — prohibited |
| Runtime Domain reading routes hosting Discovery | DISC-INV-05 |

### 2.1 Boundary Matrix (D3-001 / D3-002 / D3-003)

| Topic | D3-001 | D3-002 | D3-003 |
| ----- | ------ | ------ | ------ |
| Session create / teardown | Yes | Consume | Consume |
| Narrative bundle / gate | Yes | Read-only | Propose input |
| Propose generation | Handoff only | — | Yes |
| Candidate payload schema | — | Review display | Yes |
| Accept / Edit / Discard | — | Yes | — |
| Re-propose | — | Yes | Triggers regen |
| Persist Candidates / Entities | Prohibited | Accept handoff only (SPEC-D3-002) | Prohibited at propose |

---

## 3. Runtime Contracts

**D3-RC-01 — Work-scoped session**

Discovery Session MUST be scoped to a single `workId`. MUST NOT be entity-scoped like Enrichment (SPEC-D2-002 scope-field model).

**D3-RC-02 — Separate from Enrichment**

Discovery Session MUST NOT share state machine, hooks, or API routes with Enrichment Copilot. Extending `useCopilotSession` or `/api/admin/ai/suggest` for Discovery is prohibited (DISC-INV-06, DISC-INV-07).

**D3-RC-03 — Narrative Gate before propose**

SPEC-D3-003 propose MUST NOT be invoked until narrative input passes Narrative Gate (§4.3) and operator locks the bundle (§4.4).

**D3-RC-04 — Locked narrative immutability**

While session state is `narrative_locked`, `proposing`, or `review_pending`, the locked Narrative Input Bundle MUST NOT be edited. Unlock returns session to `draft` and invalidates propose readiness.

**D3-RC-05 — Forbidden sole inputs**

Narrative input MUST NOT consist solely of: keyword lists; Runtime Scene identifiers or Scene table exports; Chapter Catalog spine metadata alone.

**D3-RC-06 — Provenance is not boundary authority**

Excerpt `sourceLabel` or optional provenance refs MAY cite chapter or scene labels for operator orientation only. MUST NOT use chapter or catalog metadata to **define** Story boundaries (DISC-INV-04, ADR-005 NIM-INV-02).

**D3-RC-07 — No Discovery persist**

Platform operations MUST NOT persist Candidates, Approved Entities, or catalog records (DISC-INV-01).

**D3-RC-08 — Session teardown**

Navigating away from the work context or explicit session end MUST destroy ephemeral session state including in-flight propose results not yet in review (aligns with Enrichment RT-INV-07 teardown spirit).

**D3-RC-09 — Admin-only Discovery entry**

Discovery Session creation MUST occur only in Admin Editorial/Discovery UI paths. Runtime reading routes MUST NOT expose Discovery session APIs (DISC-INV-05).

**D3-RC-10 — Single active session (v1)**

At most one active Discovery Session per `(workId, operatorUserId)` in v1 (OQ-D3-001-04).

---

## 4. Data Contracts

### 4.1 DiscoverySession

```typescript
interface DiscoverySession {
  sessionId:   string;   // correlation id; logging/tracing only in v1 (OQ-D3-001-02)
  workId:      string;
  operatorId:  string;   // authenticated user id
  state:       DiscoverySessionState;
  narrative:   NarrativeInputBundle | null;
  lockedAt:    string | null;  // ISO-8601 when narrative locked
  createdAt:   string;
}

type DiscoverySessionState =
  | "draft"              // narrative editable
  | "narrative_locked"   // gate passed; ready for D3-003 propose
  | "proposing"          // transient; D3-003 in flight
  | "review_pending"     // candidates available; D3-002 handoff
  | "closed";
```

v1 persistence: **ephemeral client state** with optional `sessionId` for correlation. Server MUST NOT require durable session storage for correctness (OQ-D3-001-02).

### 4.2 NarrativeInputBundle

```typescript
interface NarrativeExcerpt {
  text:         string;   // required prose excerpt (trimmed non-empty)
  orderIndex:   number;   // operator-defined reading order (Story order permitted)
  sourceLabel?: string;   // e.g. "Chapter 47 — Catelyn POV"; citation only
}

interface NarrativeInputBundle {
  excerpts:           NarrativeExcerpt[];
  operatorSummary?:   string | null;
  inputMode:          "excerpt_bundle" | "approved_summary";
  summaryAttested?:   boolean;  // required true when inputMode === "approved_summary"
}
```

**Form field aliases (React):** Implementation MAY split excerpts across a composer UI; the locked handoff object MUST normalize to this shape for D3-002 / D3-003 consumers.

### 4.3 Narrative Gate Validation Rules

Let `totalProse` = sum of trimmed `excerpt.text` lengths plus trimmed `operatorSummary` length (if present).

| Rule ID | Condition | Result |
| ------- | --------- | ------ |
| NG-01 | No excerpts and no `operatorSummary` | FAIL |
| NG-02 | `inputMode: excerpt_bundle` and `totalProse` < **512** | FAIL |
| NG-03 | `inputMode: approved_summary` without `summaryAttested === true` | FAIL |
| NG-04 | `inputMode: approved_summary` and `totalProse` < **768** | FAIL |
| NG-05 | Any single excerpt matches keyword-list heuristic (§4.3.1) | FAIL |
| NG-06 | Bundle flagged `catalogOnly` or `runtimeExportOnly` (§4.3.1) | FAIL |
| NG-07 | `excerpt_bundle` mode with zero excerpts but non-empty summary only | FAIL |

Gate PASS required before transition to `narrative_locked`.

#### 4.3.1 Heuristic Definitions

**Keyword-list heuristic (NG-05):** An excerpt FAILS if, after trim, it contains no sentence terminators (e.g. `.`, `!`, `?`; implementation MAY treat full-width equivalents as terminators) AND (a) comma-separated tokens only, OR (b) length < 40 AND token count ≤ 5 without verbs (implementation MAY use simple token/length check).

**Catalog/runtime-only flags (NG-06):** Client MUST set `catalogOnly: true` when input is auto-imported solely from Chapter Catalog export with no added prose. MUST set `runtimeExportOnly: true` when input is auto-imported solely from Runtime Scene list/metadata with no added prose. These flags are not persisted in the locked bundle; they gate lock attempts.

### 4.4 UI Input Guidance Contract

Normative requirements (not pixel spec):

1. **Session gate:** Propose control MUST remain disabled until Narrative Gate PASS and explicit lock.
2. **Persistent hint:** Discovery composer MUST display that Discovery is narrative-first and list forbidden sole-input types (§3 D3-RC-05).
3. **Examples block:** MUST include at least one good and one bad example (§4.4.1).
4. **Lock action:** Operator MUST explicitly confirm lock; auto-lock on blur or timer is prohibited.
5. **Unlock action:** Operator MAY unlock from `narrative_locked` only; unlock clears propose readiness.

#### 4.4.1 Good / Bad Examples (normative copy)

| Label | Example | Verdict |
| ----- | ------- | ------- |
| **Good** | Three excerpts from different chapters describing the Red Wedding (Catelyn POV arrival, betrayal beat, aftermath), reordered for Story reading order; total prose ≥ 512 chars | PASS |
| **Bad** | Single line `"Red Wedding, Robb, Walder Frey, Catelyn"` | FAIL (NG-05) |
| **Bad** | Exported Scene table titles/chapter numbers only, no prose excerpts | FAIL (NG-06) |
| **Bad** | Chapter Catalog spine (chapter_number + title list) pasted without narrative prose | FAIL (NG-06) |
| **Good** | Operator-written approved summary ≥ 768 chars with attestation checkbox; optional zero excerpts | PASS (`approved_summary`) |

### 4.5 Resolved Open Questions

| ID | Resolution |
| -- | ---------- |
| OQ-D3-001-01 | **N = 512** chars total prose for `excerpt_bundle`; **768** for `approved_summary` only |
| OQ-D3-001-02 | v1 **ephemeral client** session + optional `sessionId` for correlation; no server session store required |
| OQ-D3-001-03 | `approved_summary` without excerpts **allowed** when attested and meets 768-char minimum |
| OQ-D3-001-04 | v1 **one active session** per `(workId, operatorId)` |

### 4.6 Platform API Shapes (v1 minimum)

Implementation MAY defer server routes until Approved; shapes are normative for Implementation phase.

**Lock narrative**

```typescript
// POST /api/admin/discovery/session/lock  (illustrative path)
interface LockNarrativeRequest {
  workId:    string;
  sessionId: string;
  narrative: NarrativeInputBundle;
}
```

**Invariants:**

- Request MUST be authenticated; `workId` MUST belong to operator's accessible works
- Server MUST re-run Narrative Gate (NG-01–NG-07) — client validation alone is insufficient
- Successful lock sets session state to `narrative_locked`

---

## 5. State Transitions

```text
[draft] → [narrative_locked]     trigger: Narrative Gate PASS + operator lock
[narrative_locked] → [draft]     trigger: operator unlock
[narrative_locked] → [proposing] trigger: operator starts propose (SPEC-D3-003)
[proposing] → [review_pending]   trigger: D3-003 returns candidate set (no persist)
[proposing] → [draft]            trigger: propose failure + operator reset
[review_pending] → [closed]      trigger: operator ends session OR navigates away (D3-RC-08)
[review_pending] → [draft]       trigger: operator starts new discovery pass
```

Re-propose semantics (SPEC-D3-002) MUST remain independent from Enrichment retry session (DISC-INV-07). `review_pending` reuses locked narrative without unlock per SPEC-D3-002 OQ-D3-002-06 / D3-RC-REV-15; D3-001 guarantees locked narrative remains addressable by reference until unlock or teardown.

---

## 6. Error Handling

| Condition | HTTP | Code | Response |
| --------- | ---- | ---- | -------- |
| Narrative gate fail on lock | 422 | `NARRATIVE_GATE_FAILED` | Field-level validation detail |
| Propose without lock | 400 | `NARRATIVE_NOT_LOCKED` | Message; propose disabled |
| Session not found / wrong work | 404 | `SESSION_NOT_FOUND` | Message |
| Second active session same work+operator | 409 | `SESSION_ALREADY_ACTIVE` | Message |
| Unauthenticated | 401 | `UNAUTHORIZED` | Message |
| Teardown mid-propose | — | — | Cancel in-flight; clear ephemeral candidates client-side |

Partial gate failures MUST NOT transition state to `narrative_locked`.

---

## 7. Security Constraints

- Discovery Platform routes MUST require Supabase Auth (consistent with Admin middleware)
- Session data MUST be isolated by `workId`; cross-work access MUST return `SESSION_NOT_FOUND`
- Platform MUST NOT expose auto-accept or bypass paths to Production persist (DISC-INV-02)
- Locked narrative MUST NOT be written to catalog or Runtime tables at platform layer (DISC-INV-01)

---

## 8. Acceptance Criteria

### 8.1 SPEC document criteria (verified at Approved)

- [x] D3-AC-01: Session model is work-scoped and distinct from Enrichment session
- [x] D3-AC-02: NarrativeInputBundle supports `excerpt_bundle` and `approved_summary` modes
- [x] D3-AC-03: Narrative Gate forbids keywords-only, runtime-only, catalog-only inputs
- [x] D3-AC-04: UI guidance contract includes gate, hints, and good/bad examples
- [x] D3-AC-05: State machine covers draft → locked → propose handoff → review_pending
- [x] D3-AC-06: DISC-INV-01/04/07 reflected in platform contracts
- [x] D3-AC-07: §2 Out of Scope excludes D3-002 Review and D3-003 Proposals without overlap
- [x] D3-AC-08: Min length N resolved (512 / 768) in §4.5

### 8.2 Implementation criteria (verified — Implemented)

- [x] D3-AC-IMP-01: Discovery session hook/route separate from `useCopilotSession`
- [x] D3-AC-IMP-02: Unit tests cover NG-05, NG-06, and min-length rules
- [x] D3-AC-IMP-03: No persist of Candidates or Entities at platform layer
- [x] D3-AC-IMP-04: UI implements §4.4 lock gate, hints, and examples block
- [x] D3-AC-IMP-05: Server re-validates Narrative Gate on lock (not client-only)

**Implementation authority:** SPEC Approved → implement §8.2 → run §10 → mark SPEC **Implemented**. No separate Implementation plan required.

---

## 9. Non-Goals

- Candidate type payloads (Character / Location / Story / Scene Candidate Generation) — SPEC-D3-003
- Review panel, Accept / Edit / Discard / Re-propose — SPEC-D3-002
- LLM provider selection and prompt templates
- Editorial Story boundary adjudication UI (ONE Rule)
- Knowledge Graph extraction
- Bootstrap-style batch catalog generation
- Durable Discovery session database schema (v1)
- Enrichment field suggestion or Reference Suggestion

---

## 10. Validation

### 10.1 Governance review (Approved)

```bash
npm run check:governance
```

Manual checks:

- SPEC_RULES §6 section order and required metadata
- Derived From references ADR-006 (and ADR-005 narrative note) without version suffix in cross-references
- §4.3 / §4.4 traceable to Master §1.D narrative input intents
- §2.1 boundary matrix consistent with §9 Non-Goals
- No normative dependency on Enrichment `/api/admin/ai/suggest`

### 10.2 Implementation validation (Implemented)

```bash
npm run test -- __tests__/discovery/
```

| Check | Maps to |
| ----- | ------- |
| Narrative gate unit tests | D3-AC-IMP-02, NG-01–NG-07 |
| Session isolation / no persist tests | D3-AC-IMP-03, D3-RC-07 |
| Separate from Enrichment session | D3-AC-IMP-01, D3-RC-02 |

Expected implementation anchors (read-only planning reference):

- `hooks/useDiscoverySession.ts` (or equivalent)
- `lib/discovery/narrative-gate.ts`
- `__tests__/discovery/narrative-gate.test.ts`

---

## 11. Refs

### Governance

- `governance/Constitution.md`
- `governance/FOUNDATION.md`
- `governance/ADR_RULES.md`
- `governance/SPEC_RULES.md`
- `governance/templates/SPEC_TEMPLATE.md`

### ADR

- `docs/adr/006-discovery-copilot-architecture.md` — ADR-006 (parent; DISC-INV-*, Decision 5, Deferred session)
- `docs/adr/005-narrative-information-model.md` — ADR-005 (narrative-first; Story semantics)
- `docs/adr/004-source-of-canonical-truth.md` — ADR-004 (Human Acceptance Gate — reference only)

### Related SPECs

- `docs/specs/spec-d3-002-discovery-human-review.md` — SPEC-D3-002 (Review / Re-propose; Implemented)
- `docs/specs/spec-d3-003-discovery-proposals.md` — SPEC-D3-003 (Proposals; Implemented)
- `docs/specs/spec-d2-002-enrichment-copilot.md` — SPEC-D2-002 (Enrichment boundary)
- `docs/specs/spec-core-001-entity-schema-registry.md` — SPEC-CORE-001 (Enrichment registry)

### Precedence

```text
ADR-006 > SPEC-D3-001 > SPEC-D3-002 / SPEC-D3-003
ADR-005 > SPEC-D3-001 (narrative semantics)
```

Enrichment and Discovery MUST remain separate authority paths (DISC-INV-06, DISC-INV-07).

### Read-only implementation anchors (this SPEC — Implemented)

- `hooks/useDiscoverySession.ts` — Discovery session hook
- `lib/discovery/narrative-gate.ts` — Narrative Gate (NG-01–NG-07)
- `app/api/admin/discovery/session/lock/route.ts` — server gate re-validation
- `components/discovery/DiscoveryComposer.tsx` — §4.4 UI contract
- `__tests__/discovery/` — §10.2 validation

### Read-only anti-pattern anchors (not modified by this SPEC)

- `hooks/useCopilotSession.ts` — Enrichment session; anti-pattern for Discovery extension
- `docs/specs/spec-d2-002-enrichment-copilot.md` §2, §15.5 — Discovery prohibition
