# SPEC-D2-003 — Source Connector v1: Evidence Architecture

## Metadata

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Title        | Source Connector v1 — Evidence Architecture                           |
| Status       | Approved                                                              |
| Version      | v1.4                                                                  |
| Owner        | Architect                                                             |
| Last Updated | 2026-06-11                                                            |
| Implementation Authorization | **GRANTED** (Approved = authorized)                    |
| Derived From | ADR-004 v1.10 (`docs/adr/004-source-of-canonical-truth.md`); SPEC-D2-002 v0.1; ADR-D2-001 (`docs/adr/ADR-D2-001-canonical-metadata-authority.md`) |

---

## 1. Purpose

SPEC-D2-003 replaces the SC-03 stub architecture with a formal **Evidence Architecture**. It specifies how external and fallback evidence is retrieved, classified, bundled, and consumed by the Enrichment Copilot (SPEC-D2-002) — without bypassing the Human Acceptance Gate.

This specification defines **contracts, tier rules, authority boundaries, pipeline topology, and implementation phases**. Connector API selection, caching, rate-limit mechanics, and parser implementation choices remain implementation details unless normatively required herein.

**Normative ownership principle:**

```text
Schema in Governance.
Data in Runtime.
```

Governance defines binding schemas, tier rules, and invariants. Runtime (database + admin operations) owns Source Profile records, Source Binding records, and work→profile links. Adding a new work MUST NOT require a governance PR, submodule update, or deployment of governance artifacts.

On any conflict with SPEC-D2-002 within tier/confidence mapping, SPEC-D2-003 §3.5 governs. On any other conflict, ADR-004 v1.10 governs.

---

## 2. Scope

### In Scope

- Source Connector slot runtime behavior and evidence pipeline contracts
- Evidence Bundle, **SourceProfile**, and **SourceBinding** data shapes
- **Runtime Source Registry** — schema governed here; records owned by runtime
- **Three-entity Runtime Model:** Work → SourceProfile → SourceBinding → Connector Orchestrator (§4.7)
- Normative runtime persistence topology (§4.7); implementation MUST NOT choose alternate storage shapes
- **`works.source_profile_id` FK column** as the sole work-instance bridge to connector selection (§4.6)
- **Global Tier-2 connector registry** (`tier2Connectors` in orchestrator; Wikipedia not stored in `source_bindings`)
- Tier classification and normative Tier → Confidence mapping
- Source Binding **`status: "approved"`** gate for Tier-1/Tier-2 dispatch
- **AWOIAF Tier-1 Connector (Phase 1B)** — minimum Phase 1 Tier-1 implementation
- **Wikipedia Tier-2 Connector (Phase 1B)** — scoped entity lookup only
- SC-03 Original Work fallback participation in evidence and confidence semantics
- Runtime invariants SC-INV-01 and SC-INV-02
- Batch suggest topology **Option B** (Connector First)
- Normalization principle: Evidence Required, Inference Allowed, Origination Forbidden (§3.10)
- Public Work First optimization target and Original Work Known Constraint
- Phased implementation deliverables (§2.2) and exit conditions (§8)

### Out of Scope

See §9 Non-Goals.

### 2.1 Architect Decisions

The following decisions are **binding** for implementation under this spec:

| ID | Decision |
| -- | -------- |
| IA-01 | **Wikipedia Tier-2 Connector is INCLUDED in Phase 1** (Phase 1B). |
| IA-02 | **`works.source_profile_id` FK is the ONLY approved bridge** between `workId` and connector selection (§4.6). `works.metadata` jsonb MUST NOT be used for profile linking. |
| IA-03 | **Fuzzy title matching is PROHIBITED.** `works.title` MUST NOT be used to infer franchise, profile, or connector routing. |
| IA-04 | **Batch Strategy = Option B:** Connector First → `EvidenceBundle` → Normalization → `SuggestionItem`. |
| IA-05 | **Fact-route fields MUST consult the Connector orchestrator before normalization** on every suggest/retry path (including batch). |
| IA-06 | **Normalization principle:** Evidence Required, Inference Allowed, Origination Forbidden (§3.10). |
| IA-07 | **Original works without a source profile link MUST fall back to SC-03** for fact-route fields (no connector consultation). |
| IA-08 | **Operator-attested Tier-1 is explicitly OUT OF SCOPE for v1.** |
| — | **Tier-1 connector REQUIRED in Phase 1.** Minimum: **AWOIAF** (`connectorId: "awoiaf"`) for ASOIAF. Mock-only Tier-1 is insufficient for §8.2. |
| — | **Registry records are runtime-owned.** No governance-managed registry data files. |
| — | **Topology: Work → SourceProfile → SourceBinding.** Profiles are reusable across works. |
| — | **`workPattern` is runtime-managed metadata** on SourceProfile — internal identifier only. |
| — | **Persistence topology is normative** (§4.7). Implementation MUST NOT decide storage shape. |
| — | **SourceBinding is a separate entity** — MUST NOT be embedded in SourceProfile records. |
| — | **Connector dispatch gate = `status: "approved"`.** Approver identity MUST NOT appear on the Runtime Routing Contract; governance audit records hold approval accountability. |
| IA-09 | **Environment-based Tier-1 live validation (§8.2):** Tier-1 live MAY be demonstrated in **Staging or Production**. CI and local dev MAY use `SOURCE_CONNECTOR_MODE=mock` for Tier-1. Local live AWOIAF failure (e.g. Cloudflare 403) SHALL NOT be classified as an architectural defect. |
| IA-10 | **Cookie / Cloudflare bypass REJECTED:** `cf_clearance` persistence, browser session replay, manual cookie injection, and user-specific CF tokens are **non-conformant**. Connectors MUST NOT implement cookie-based egress bypass. |
| IA-11 | **Evidence Proxy NOT approved for Phase 1.** A connector egress proxy SHALL NOT be added until Staging demonstrates stable live Tier-1 access is impossible; then a separate EAR-D2-003-PROXY-JUSTIFICATION review MAY be initiated. |
| IA-12 | **API operator whitelisting** MAY proceed as a future operational option and SHALL NOT block Phase 1 completion. |

### 2.2 Implementation Phases

#### Phase 1A — Infrastructure

| Deliverable | Description |
| ----------- | ----------- |
| EvidenceBundle runtime types | `EvidenceBundle`, `EvidenceItem`, `EvidenceDiagnostic` (§4.2) |
| Three-entity persistence (§4.7) | `source_profiles` + `source_bindings` (Tier-1 only) + `works.source_profile_id` FK |
| `validateBindingFields` write-path gate | Seed / admin save MUST validate `applicable_fields` ⊆ registered fact keys (§4.4) |
| Global `tier2Connectors` | Wikipedia (`wikipedia-en`) registered in orchestrator code — NOT in `source_bindings` |
| Runtime Source Registry types | `SourceProfile`, `SourceBinding` contracts (§4.4–§4.5) |
| Connector orchestrator | Work → profile → bindings (by `profileId`) → connector query → bundle assembly (§3.1, §3.11) |
| Seed data (minimum) | ASOIAF **SourceProfile** + **SourceBinding** row (`awoiaf`, `status: "approved"`) for exit demo |

#### Phase 1B — Connectors & Pipeline

| Deliverable | Description |
| ----------- | ----------- |
| **AWOIAF Tier-1 connector** | `connectorId: "awoiaf"`; hardcoded `tier: 1`; official ASOIAF wiki source |
| Wikipedia Tier-2 connector | `connectorId: "wikipedia-en"`; hardcoded `tier: 2` (§3.4, INV-REG-01) |
| `processFact` implementation | Tier-1 green / Tier-2 yellow / SC-03 demotion (§3.5–§3.6) |
| Batch suggest refactor | Option B per §3.11 |

#### Phase 1C — UX & Verification

| Deliverable | Description |
| ----------- | ----------- |
| Source Profile admin UX | Operators MAY assign/create profiles and bindings without governance repo access |
| Provenance UI completion | Panel surfaces `sources[]` for Tier-1/Tier-2 fact suggestions (§3.3) |
| SC-INV-02 enforcement tests | Provenance preserved end-to-end |
| Tier-state coverage tests | All three evidence states demonstrable (§8 Exit Condition) |

---

## 3. Runtime Contracts

### 3.1 Evidence Pipeline Topology (Binding)

```text
Human Scope (pre-known entity + scope field)
        ↓
Work (workId)
        ↓
Resolve works.source_profile_id
        (if absent → SC-03 for fact fields — IA-07)
        ↓
SourceProfile (table: source_profiles)
        ↓
SourceBinding (table: source_bindings, Tier-1 only, FK profileId)
        ↓
Connector Orchestrator (approved Tier-1 bindings + global tier2Connectors — §3.8, §4.4)
        ↓
Evidence Bundle (tier + provenance)
        ↓
Suggestion Normalization (§3.10 — evidence ONLY on Tier-1/2 path)
        ↓
SuggestionItem (form state — NOT canonical)
        ↓
Human Review + Accept
        ↓
Form field value
        ↓
Human Save → CRUD → Database (Canonical Truth)
```

**Forbidden topology:**

```text
Source Connector → Database (Canonical Truth)     // FORBIDDEN
Source Connector → Auto-Accept                    // FORBIDDEN
Evidence Bundle  → Canonical Record type          // FORBIDDEN
works.title → connector routing (fuzzy match)   // FORBIDDEN (IA-03)
Work → Sources (flat, no profile)               // FORBIDDEN
SourceBinding embedded in SourceProfile JSON      // FORBIDDEN
Implementation-chosen persistence topology        // FORBIDDEN
Governance artifact → live connector routing      // FORBIDDEN
```

### 3.2 SC-INV-01 — Human Owns Canonical Truth

Evidence and suggestions MUST NOT enter the database without explicit human Accept + CRUD Save. Source Connector output types MUST NOT be assignable to canonical entity record types.

### 3.3 SC-INV-02 — Evidence Provenance Preservation

Every `EvidenceItem` MUST preserve provenance from connector retrieval through Evidence Bundle assembly, suggestion normalization, and `SuggestionItem` emission. At minimum, `connectorId`, `sourceRef`, and `retrievedAt` MUST remain attached and MUST NOT be stripped, replaced, or synthesized by the normalization layer.

**Enforcement:**

- Normalization functions MUST accept `EvidenceItem[]`, not plain strings.
- Response validator MUST reject `classification: "fact"` when emitted `SourceRef` tier ≠ bundle tier.
- suggest-service MUST NOT construct `SourceRef` without `EvidenceItem` input (SC-03 empty sources excepted).
- Suggestion Panel MUST surface `sources[]` with tier, label, and URL when present (Phase 1C).

See ADR-004 and ADR-D2-001 for authority-tier rationale.

### 3.4 Tier Classification Rules

**Prerequisite:** For fact-route fields, the orchestrator MUST resolve `works.source_profile_id` → **SourceProfile** → **SourceBinding** rows (Tier-1 only; by `profileId`; `status: "approved"` only — §4.4). If `source_profile_id` is **absent or invalid**, skip connector consultation and apply **SC-03** (IA-07). When `SourceProfile.tier2Enabled` is true, orchestrator MUST also consult **global Tier-2 connectors** (`tier2Connectors`, minimum: `wikipedia-en`) — these are NOT stored in `source_bindings`.

| Condition | `tier` | `matched` |
| --------- | ------ | --------- |
| Profile linked; ≥1 `EvidenceItem` from Tier-1 binding for `(entityType, field)` | `1` | `true` |
| Profile linked; no Tier-1 evidence; ≥1 verifiable Tier-2 evidence (Wikipedia — IA-01) | `2` | `true` |
| Profile linked; connectors consulted; no Tier-1 or Tier-2 evidence | `3` | `false` → SC-03 |
| Profile link absent | — | SC-03 directly (IA-07) |
| Tier-1/2 bindings applicable but connectors not consulted | — | **non-conformant** (SC-04 violation) |

**Aggregation:** `bundle.tier = min(evidenceItems[].tier)` — highest authority present wins.

| Tier | Meaning | Phase 1 connector (minimum) |
| ---- | ------- | ----------------------------- |
| Tier-1 | Official Canonical Source | **AWOIAF** (`awoiaf`) |
| Tier-2 | Structured community reference | **Wikipedia** (`wikipedia-en`) — IA-01 |
| Tier-3 | LLM fallback / no external match | SC-03 path |

**Public Work First (v1):** Runtime Source Profiles SHOULD exist for architect-approved public franchises (e.g. ASOIAF, LOTR, Harry Potter, Naruto, One Piece, Three Body). Works MUST link to a **SourceProfile** to consume external evidence. Phase 1 MUST seed at least ASOIAF/AWOIAF.

**Original Work Known Constraint (IA-07):** Works without `sourceProfileId` MUST receive SC-03 for all fact-route fields. No Wikipedia or Tier-1 consultation occurs.

**Fandom wikis (v1):** excluded from Tier-1 and Tier-2. Fandom MUST NOT appear as a Tier-1 binding or Phase 1 connector.

**Operator-attested Tier-1 (IA-08):** OUT OF SCOPE for v1. No operator-uploaded or operator-declared Tier-1 sources in Phase 1.

### 3.5 Tier → Confidence Mapping (Normative)

A reviewer MUST determine `SuggestionItem.confidence` solely from this table and the pipeline path. No additional inference is permitted.

| Evidence condition | Pipeline path | `classification` | `confidence` | `sources` |
| ------------------ | ------------- | ---------------- | ------------ | --------- |
| `matched=true`, `tier=1`, ≥1 Tier-1 `EvidenceItem` with intact provenance (SC-INV-02) | SC-01 Fact | `"fact"` | **`"green"`** | ≥1 `SourceRef` with `tier: 1` |
| `matched=true`, `tier=2`, ≥1 Tier-2 `EvidenceItem` with intact provenance | SC-01 Fact | `"fact"` | **`"yellow"`** | ≥1 `SourceRef` with `tier: 2` |
| `matched=false`, `tier=3`, or profile link absent (SC-03) | SC-03 Fallback | `"narrative"` | **`"yellow"`** | **`[]`** (empty) |
| SC-02 Narrative pipeline (default) | SC-02 | `"narrative"` | **`"yellow"`** | per SPEC-D2-002 grounding rules |

**INV-TC-01:** `confidence: "green"` is assignable **if and only if** `EvidenceBundle.tier === 1` AND at least one `EvidenceItem.tier === 1` with complete provenance (SC-INV-02) is present. Tier-2 evidence MUST NOT emit `"green"`.

**Mapping extensibility (v1 frozen):**

| Aspect | v1 Status |
| ------ | --------- |
| Tier enum `{1,2,3}` | Frozen |
| Confidence enum `{green,yellow}` | Frozen (SPEC-D2-002 §8.1) |
| Tier → Confidence table above | Frozen — Tier-2 MUST NOT map to green |
| Third confidence level | Forbidden without new ADR + SPEC |

### 3.6 SC-03 Fallback Participation

SC-03 activates when **any** of:

- `works.source_profile_id` is absent (IA-07)
- `EvidenceBundle.matched === false`
- `bundle.tier === 3` with no Tier-1/2 items

**SC-03 output rules:**

1. SC-03 activates **before** any fact classification is emitted.
2. Output MUST be `classification: "narrative"`, `confidence: "yellow"`, `sources: []`.
3. LLM MAY draft a value from scope + work context only (**origination permitted only on SC-03 path** — §3.10).
4. SC-03 MUST NOT produce `"green"` (AC-20, SPEC-D2-002 §8.5).
5. SC-03 MUST NOT fabricate `SourceRef` entries.

Partial connector failure: diagnostics MUST be populated; if no evidence items remain, SC-03 applies with `confidence: "yellow"` — never `"green"`.

### 3.7 Discovery Boundary (RT-INV-04 / RT-INV-05)

Source Connector input MUST include `scopeFieldValue`. Connectors MUST NOT accept work-only discovery queries. Output MUST NOT include candidate entity lists, related-entity proposals, or catalog expansion payloads.

**Wikipedia connector constraints (IA-01):**

- Lookup MUST be scoped to `scopeFieldValue` + `SourceProfile.wikipediaSearchContext` (if set).
- Return 0 or 1 resolved page per request — never a candidate entity list.
- Disambiguation pages MUST be rejected (`NO_MATCH` diagnostic).

**AWOIAF connector constraints:**

- Lookup MUST be scoped to `scopeFieldValue` within the ASOIAF franchise context of the linked profile.
- Return 0 or 1 resolved article per request — never a candidate entity list.
- MUST emit `tier: 1` evidence only; MUST NOT downgrade to Tier-2 semantics.

### 3.8 Runtime Source Registry — Authority & Governance

**Normative principle:**

```text
Schema in Governance.   ← this SPEC (§4.4–§4.7)
Data in Runtime.        ← SourceProfile + SourceBinding records
```

**Ownership:**

| Layer | Owns | Does NOT own |
| ----- | ---- | ------------ |
| **Governance (this SPEC + ADR-004)** | `SourceProfile` / `SourceBinding` schemas; tier rules; INV-REG-01; INV-TC-01; SC-INV-*; Tier-1 promotion approval **requirements** | Individual profile records; binding records; work links |
| **Runtime (database + admin)** | SourceProfile records; SourceBinding records (Tier-1 only); `works.source_profile_id` assignments | Tier rule changes; schema changes without SPEC/ADR update |
| **Architect** | Tier-1 binding promotion approval (governance audit record — **not** on routing contract) | Day-to-day profile CRUD |

**Adding a new work MUST NOT require:**

- governance PR
- submodule update
- governance deployment

Operators (or Source Curators) MAY create or assign Source Profiles and bindings through runtime admin surfaces (Phase 1C minimum: seed + assign; full curator UX MAY follow).

**Tier-1 binding promotion:**

1. Source Curator or System Administrator creates a **SourceBinding** with `tier: 1` and `status: "draft"`.
2. Binding MUST include: `profileId`, `officialSourceId`, `sourceLabel`, `baseUrl`, `applicableFields`, `effectiveFrom`.
3. Orchestrator MUST dispatch Tier-1 connectors **only** when `status === "approved"`.
4. Transition `draft` → `approved` MUST be authorized by Architect; accountability MUST be recorded in **governance audit records** (outside §4.4 routing fields).
5. Approver identity fields MUST NOT appear on `SourceBinding` or any field consulted by connector dispatch logic.
6. Implementation engineers MUST NOT hardcode new Tier-1 sources in application code without a corresponding `SourceBinding` row with `status: "approved"`.

**INV-REG-01:** Wikipedia, Wikidata, Fandom, and generic web search results MUST NEVER appear as Tier-1 in runtime bindings or connector classification.

**Non-conformant:**

- Hardcoding `tier: 1` for Wikipedia, Wikidata, Fandom, or LLM-attributed URLs
- Promoting a connector to Tier-1 via environment variable or feature flag
- Merging application PR that adds Tier-1 routing without a `SourceBinding` with `status: "approved"`
- Using approver identity as the connector dispatch gate
- Storing registry data in governance submodule files

### 3.9 Work → SourceProfile Binding (IA-02, IA-03)

`works.source_profile_id` is the **only** approved mechanism to bridge `workId` → **SourceProfile** → connector selection.

**Rules:**

- Orchestrator MUST load `source_profile_id` from `works` by `workId`, then load **SourceProfile**, then load **SourceBinding** rows (Tier-1 only) where `profileId` matches and `status === "approved"`.
- Tier-2 Wikipedia (`wikipedia-en`) MUST be dispatched from the orchestrator's **global `tier2Connectors` registry** when `SourceProfile.tier2Enabled` is true — NOT from `source_bindings` rows.
- **`works.title` MUST NOT be used** for connector routing, franchise inference, or profile resolution (IA-03).
- Fuzzy string matching against work titles is **prohibited**.
- `SourceProfile.workPattern` is an **internal runtime identifier** for profile reuse and reporting.

**Profile reuse:** Multiple works MAY reference the same SourceProfile (e.g. shared ASOIAF franchise profile). Profile kinds (Public Franchise, Original Work, Encyclopedia) MUST remain composable under Work → SourceProfile → SourceBinding.

### 3.10 Normalization Principle (IA-06)

For fact-route fields when `EvidenceBundle.matched === true`:

| Rule | Meaning |
| ---- | ------- |
| **Evidence Required** | Normalization MUST NOT run until connector produces ≥1 `EvidenceItem`. |
| **Inference Allowed** | Value MAY be derived from retrieved evidence using infobox parsing, structured extraction, or LLM extraction from evidence excerpts. |
| **Origination Forbidden** | Normalization MUST NOT invent fact claims outside retrieved evidence. LLM MUST NOT originate fact claims from training knowledge when Tier-1/2 evidence exists. |

**Multi-item aggregation:**

- All contributing `EvidenceItem` provenance MUST be preserved in the emitted `SuggestionItem.sources[]` (SC-INV-02).
- Field `value` MUST be derived from retrieved evidence only — not from model training knowledge.
- When multiple `EvidenceItem` entries conflict, implementation MAY apply deterministic merge rules; spec does not mandate parser choice.

On the SC-03 path only, LLM MAY originate a narrative draft (no evidence required).

### 3.11 Batch Suggest Strategy — Option B (IA-04, IA-05)

When `/suggest` receives multiple `emptyFields`, the service MUST follow **Option B**:

```text
For each field in emptyFields:
  if copilot_route === "fact":
    1. Resolve sourceProfileId (absent → SC-03 for this field)
    2. Load SourceProfile → SourceBinding rows (approved only)
    3. Orchestrator → EvidenceBundle
    4. If matched → normalize from evidence → SuggestionItem (fact/green or fact/yellow)
    5. Else → SC-03 → SuggestionItem (narrative/yellow/[])
  else (narrative):
    defer to narrative batch group

Narrative-route fields MAY be processed in a single batch LLM call
AFTER all fact-route fields complete connector consultation.
```

**Prohibited:** Batch LLM call for fact-route fields **before** connector consultation. **Prohibited:** Discarding connector results and emitting narrative classification for matched Tier-1/2 bundles.

Retry (`/suggest/retry`) MUST apply the same per-field connector-first rules for fact-route fields.

---

## 4. Data Contracts

### 4.1 Source Connector Input (extends SPEC-D2-002 §5.6)

```typescript
interface SourceConnectorInput {
  entityType:      "character" | "location" | "scene";
  scopeFieldValue: string;   // REQUIRED — pre-known scope; no discovery input
  field:           string;   // single requested field only
  workId:          string;
  sourceProfile:   SourceProfile | null;  // resolved via works.source_profile_id; null → SC-03
  // Orchestrator MUST load Tier-1 SourceBinding[] by profileId + global tier2Connectors (§4.7)
}
```

### 4.2 Evidence Bundle

```typescript
interface EvidenceBundle {
  requestId:         string;
  workId:            string;
  entityType:        "character" | "location" | "scene";
  scopeFieldValue:   string;
  field:             string;
  matched:           boolean;
  tier:              1 | 2 | 3;
  evidenceItems:     EvidenceItem[];
  diagnostics:       EvidenceDiagnostic[];
}

interface EvidenceItem {
  tier:              1 | 2 | 3;
  connectorId:       string;
  sourceRef:         SourceRef;   // SPEC-D2-002 §7.3 shape
  excerpt:           string;
  retrievedAt:       string;      // ISO-8601
  matchConfidence:   "high" | "medium" | "low";
}

interface EvidenceDiagnostic {
  connectorId:       string;
  code:              "TIMEOUT" | "UNAVAILABLE" | "NO_MATCH" | "RATE_LIMITED" | "PARSE_ERROR";
  message:           string;
}
```

### 4.3 SourceConnectorOutput (SPEC-D2-002 compatibility)

```typescript
interface SourceConnectorOutput {
  tier:    1 | 2 | 3;
  results: SourceRef[];
  matched: boolean;
}
```

Implementations MUST derive `SourceConnectorOutput` from `EvidenceBundle` without loss of tier or match semantics:

```typescript
{
  tier:    bundle.tier,
  matched: bundle.matched,
  results: bundle.evidenceItems.map(i => i.sourceRef),
}
```

### 4.4 SourceBinding (Runtime Entity)

Governance defines this shape. Runtime stores records in **`source_bindings`**.

```typescript
type SourceBindingStatus =
  | "draft"       // not dispatched
  | "approved"    // eligible for connector dispatch
  | "inactive";   // retired; not dispatched

interface SourceBinding {
  bindingId:        string;
  profileId:        string;              // FK → SourceProfile.profileId
  tier:             1;                   // Tier-1 ONLY in source_bindings; Tier-2 = global tier2Connectors
  connectorId:      string;              // e.g. "awoiaf" (Tier-1 franchise connectors)
  officialSourceId: string;              // e.g. "awoiaf" — required when tier=1
  sourceLabel:      string;
  baseUrl:          string;
  applicableFields: string[];            // field keys from SPEC-D2-002 Appendix A
  effectiveFrom:    string;              // ISO-8601 date
  status:           SourceBindingStatus; // routing gate
  createdAt:        string;              // ISO-8601
  updatedAt:        string;              // ISO-8601
}
```

**Runtime Routing Contract:** Orchestrator MUST dispatch connectors only for bindings where `status === "approved"`. Approver identity MUST NOT exist on this contract.

**Tier-1 bindings:** MUST have `status: "approved"` before Tier-1 connector dispatch. **`applicable_fields` write-path validation:** each field MUST exist in field-registry with `copilot_route === "fact"`; validation runs on seed/admin save only — NOT at orchestrator runtime.

**Tier-2 (Wikipedia):** MUST NOT appear as `source_bindings` rows. Wikipedia is registered in orchestrator `tier2Connectors` and gated by `SourceProfile.tier2Enabled`.

**Governance audit (out of routing contract):** Architect authorization for `draft` → `approved` MUST be recorded in governance audit records (admin audit log, change ticket, or architect-designated audit store). Audit records MUST NOT be required fields on `SourceBinding` for dispatch logic.

### 4.5 SourceProfile (Runtime Entity)

Reusable across many works. Stored in **`source_profiles`**. Bindings are **separate rows** in `source_bindings`.

```typescript
type SourceProfileKind =
  | "public_franchise"
  | "original_work"
  | "encyclopedia";

interface SourceProfile {
  profileId:                 string;
  kind:                      SourceProfileKind;
  displayName:               string;

  /** Internal runtime identifier for profile reuse and reporting */
  workPattern:               string;

  /** Optional disambiguation for Tier-2 Wikipedia lookup */
  wikipediaSearchContext?:   string;

  /** When false, Tier-2 Wikipedia connector is skipped; default true */
  tier2Enabled?:             boolean;

  createdAt:                 string;     // ISO-8601
  updatedAt:                 string;     // ISO-8601
}
```

**MUST NOT:** embed `SourceBinding[]` on this entity in persistence.

### 4.6 Work → SourceProfile Link

Stored as a dedicated FK column on `works`. This is the **only** approved work-instance bridge (IA-02). `works.metadata` jsonb MUST NOT be used for profile linking.

```sql
ALTER TABLE works
  ADD COLUMN source_profile_id text
  REFERENCES source_profiles(profile_id);
```

**Application mapping:** `Work.sourceProfileId` ↔ `works.source_profile_id` (nullable).

**Validation:**

- When set, `source_profile_id` MUST reference an existing SourceProfile.
- `source_profile_id` MUST NOT be inferred from `works.title` at runtime (IA-03).
- Absent `source_profile_id` → SC-03 for all fact-route fields (IA-07).
- WorkForm (Phase 1C) MUST allow operators to assign or clear Source Profile without Source Curator UI.

### 4.7 Runtime Persistence Topology (Normative)

Persistence shape is defined by this specification. Implementation MUST NOT choose alternate storage topologies.

**Three-entity model:**

```text
Work                    (table: works — existing)
  └─ source_profile_id   →  FK → source_profiles.profile_id

SourceProfile           (table: source_profiles)
  └─ profile_id          PK

SourceBinding           (table: source_bindings — Tier-1 ONLY)
  └─ profile_id          FK → source_profiles.profile_id
  └─ status              routing gate ("approved" only for Tier-1 dispatch)

tier2Connectors         (orchestrator code registry — NOT in source_bindings)
  └─ wikipedia-en        global Tier-2; gated by SourceProfile.tier2Enabled
```

| Entity | Persistence | Relationship |
| ------ | ----------- | ------------ |
| **Work** | `works.source_profile_id` FK column | 0..1 → SourceProfile |
| **SourceProfile** | `source_profiles` | 1 → many SourceBinding (Tier-1) |
| **SourceBinding** | `source_bindings` (tier = 1 only) | many → 1 SourceProfile |
| **Tier-2 Connector** | orchestrator `tier2Connectors` | global; not per-profile binding rows |

**MUST:**

- Use **three separate persistence targets** as above.
- Load bindings via `profileId` query — not from embedded JSON on profile rows.
- Apply `status === "approved"` filter before connector dispatch.

**MUST NOT:**

- Embed `SourceBinding[]` as JSONB on `source_profiles`.
- Collapse profile + binding into a single denormalized registry table.
- Merge Work profile link and SourceProfile into one entity without `sourceProfileId` indirection.
- Introduce alternate persistence without SPEC amendment.

**Orchestrator load sequence:**

```text
1. works.source_profile_id  (by workId)
2. source_profiles WHERE profile_id = ?
3. source_bindings WHERE profile_id = ? AND status = 'approved' AND tier = 1
4. for field ∈ applicable_fields: dispatch Tier-1 connector (evidence only — no field parsing in connector)
5. if profile.tier2Enabled: dispatch tier2Connectors (wikipedia-en)
6. merge EvidenceItem[] → EvidenceBundle; field extraction in normalize-evidence
```

**Phase 1 seed (minimum):** `asoiaf-profile` + one Tier-1 binding `awoiaf` with `applicable_fields = {house}` only; no Wikipedia binding row.

Database migrations for `source_profiles`, `source_bindings`, and `works.source_profile_id` are implementation responsibility. Governance defines contracts only.

---

## 5. State Transitions

### 5.1 Single Fact-Route Field

```text
[Idle]
  → [LoadProfileLink]     trigger: fact-route field
  → [SC03NoProfile]       trigger: sourceProfileId absent → narrative/yellow/[]
  → [LoadSourceProfile]   trigger: sourceProfileId present
  → [ResolveBindings]     trigger: source_bindings loaded (status=approved)
  → [ConnectorQuery]      trigger: Tier-1 + Tier-2 (if enabled) connectors invoked
  → [BundleAssembly]      trigger: results merged; tier aggregated; SC-INV-02 applied
  → [TierResolved]

[TierResolved]
  → [SC01FactGreen]       trigger: tier=1, matched=true → fact / green / sources
  → [SC01FactYellow]      trigger: tier=2, matched=true → fact / yellow / sources
  → [SC03Fallback]        trigger: tier=3 or matched=false → narrative / yellow / []

[SC01FactGreen | SC01FactYellow | SC03Fallback]
  → [Normalize]           trigger: evidence-based (§3.10) or SC-03 LLM draft
  → [SuggestionEmitted]   trigger: SuggestionItem to client (form state only)

[SuggestionEmitted]
  → [HumanAccept]         trigger: operator Accept → form field (NOT database)
  → [HumanSkip]           trigger: field unchanged

[HumanAccept]
  → [CRUDSave]            trigger: operator form submit → database
```

### 5.2 Batch Suggest (Option B — §3.11)

```text
[BatchRequest]
  → [PartitionFields]     fact-route vs narrative-route
  → [FactFieldsLoop]      each fact field: §5.1 connector-first (sequential or parallel orchestrator)
  → [NarrativeBatch]      remaining narrative fields: single LLM batch (optional)
  → [MergeSuggestions]    all SuggestionItems returned in one response
```

Invalid transitions (MUST NOT occur):

```text
[ConnectorQuery] → [CRUDSave]                       // bypasses Human Accept
[TierResolved]   → [SC01FactGreen]                  when tier=2
[BatchRequest]   → [NarrativeBatch]                 before fact fields complete connector step (IA-05)
[LoadProfileLink] → [ConnectorQuery]                when sourceProfileId absent (IA-07)
[ResolveBindings] → [DiscoveryCandidateList]        // RT-INV-04
works.title → [LoadSourceProfile]                   // IA-03
Work → Sources (skip SourceProfile)
SourceBinding embedded in SourceProfile
Implementation-chosen persistence topology
Approver identity as connector dispatch gate
[ResolveBindings] → dispatch when status≠approved
```

---

## 6. Error Handling

### 6.1 Connector Diagnostic Codes

| Code | Condition | Required Response | Recovery Path |
| ---- | --------- | ----------------- | ------------- |
| `TIMEOUT` | Connector exceeded allowed latency | Record in `EvidenceDiagnostic[]`; continue other connectors | Partial bundle; SC-03 if no evidence remains |
| `UNAVAILABLE` | Connector service unreachable | Same as TIMEOUT | Same |
| `NO_MATCH` | Connector ran; no evidence for scope+field | Record diagnostic; tier may remain unset for that connector | Tier aggregation proceeds |
| `RATE_LIMITED` | External API rate limit | Record diagnostic; MUST NOT blind-retry in same request | Operator retry via Copilot icon / Batch Retry |
| `PARSE_ERROR` | Retrieved payload unparseable | Record diagnostic; discard that connector result | Other connectors may still produce evidence |

### 6.2 Integration with SPEC-D2-002 Error Surface

| SPEC-D2-002 Code | Condition | Response under this Spec |
| ---------------- | --------- | ------------------------ |
| `SOURCE_UNAVAILABLE` | Tier-1/2 connectors fail in aggregate | SC-03 fallback: `narrative` / `yellow` / `sources: []`; HTTP 200 |
| `PROVIDER_ERROR` | LLM normalization failure after valid bundle | Per SPEC-D2-002 §13.1 partial failure rules |

When some connectors succeed and others fail, the server MUST assemble a partial `EvidenceBundle` from successful results. Tier MUST be computed from available `evidenceItems` only. Empty aggregate → SC-03 (§3.6).

---

## 7. Security Constraints

- Source Connector queries MUST be scoped to the current `workId` (RS-06, SPEC-D2-002 §14). Cross-work evidence retrieval is forbidden.
- Source Connector endpoints MUST require authenticated admin session (same auth boundary as `/api/admin/ai/suggest`).
- Connectors MUST NOT exfiltrate entity data outside the work context passed in `SourceConnectorInput`.
- **SourceProfile and SourceBinding records MUST be loaded from runtime persistence** — not from governance submodule files or unauthenticated remote config.
- Tier-1 connector dispatch MUST require `SourceBinding.status === "approved"` (§3.8, §4.4).
- Orchestrator MUST NOT read approver identity or governance audit fields for routing decisions.
- Evidence excerpts returned to the client MUST NOT contain credentials, API keys, or raw connector auth tokens.
- `sourceProfileId` MUST be set by authorized operators; runtime MUST NOT auto-derive profile assignment from title (IA-03).
- Future role separation (Content Operator, Source Curator, System Administrator) SHOULD enforce binding mutation vs work assignment boundaries; Phase 1 MAY use single admin role with schema ready for split.

---

## 8. Acceptance Criteria

### 8.1 Specification Compliance

- [ ] §3.5 mapping is deterministic; confidence derivable from tier without inference
- [ ] INV-TC-01: Tier-2 never emits green
- [ ] SC-03 always: narrative / yellow / empty sources (§3.6)
- [ ] IA-07: absent `sourceProfileId` → SC-03 for fact fields
- [ ] IA-03: no fuzzy title → connector routing
- [ ] §3.8: schema in governance; registry data in runtime
- [ ] §4.7: three-entity persistence topology — no implementation-chosen shape
- [ ] SourceBinding is a separate entity; not embedded in SourceProfile
- [ ] Connector dispatch gated by `status: "approved"` only
- [ ] Work → SourceProfile → SourceBinding topology enforced
- [ ] SC-INV-02: `connectorId`, `sourceRef`, `retrievedAt` preserved end-to-end
- [ ] SC-INV-01: no connector → database write path
- [ ] IA-05: fact fields consult connector before normalization (including batch)
- [ ] IA-06: no fact origination when Tier-1/2 evidence present
- [ ] INV-REG-01: no Wikipedia/Wikidata/Fandom as Tier-1
- [ ] Fandom excluded from Tier-1/2 in v1 (§3.4)
- [ ] RT-INV-04/05: no discovery input or output (§3.7)
- [ ] `SourceConnectorOutput` projection matches §4.3 for SPEC-D2-002 compatibility
- [ ] Real AWOIAF Tier-1 connector in Phase 1B

### 8.2 Exit Condition — Three Evidence States (Phase 1C)

Runtime MUST demonstrate all three states **without Discovery** and **without bypassing Human Acceptance Gate**:

| State | Required `SuggestionItem` | Minimum fixture | Validation environment (IA-09) |
| ----- | ------------------------- | --------------- | ------------------------------ |
| **Tier-1** | `classification: "fact"`, `confidence: "green"`, `sources` populated (tier 1) | ASOIAF character + SourceProfile + SourceBinding (`awoiaf`, `status: "approved"`) | **Live** in Staging or Production; **mock** permitted in CI and local dev |
| **Tier-2** | `classification: "fact"`, `confidence: "yellow"`, `sources` populated (tier 2) | Profile-linked work; Wikipedia evidence | Live (any environment with egress) |
| **SC-03** | `classification: "narrative"`, `confidence: "yellow"`, `sources: []` | Work without `source_profile_id` | Any |

**Environment matrix (normative):**

| Environment | `SOURCE_CONNECTOR_MODE` | Tier-1 green | Tier-2 yellow |
| ----------- | ----------------------- | ------------ | ------------- |
| CI | `mock` | mock connector | mock or live Wikipedia per test |
| Local dev | `mock` (recommended) or `live` | mock proves topology; live AWOIAF 403 is **not** an architectural defect | live Wikipedia typical |
| Staging / Production | `live` | live AWOIAF required for Tier-1 exit sign-off | live Wikipedia |

Local or CI failure to reach AWOIAF due to external source policy (e.g. Cloudflare 403) SHALL NOT block Phase 1 completion when Staging live Tier-1 is demonstrated or mock Tier-1 passes in CI (IA-09).

**Forbidden (IA-10):** Cookie injection, `cf_clearance` env vars, browser session replay, or any user-specific Cloudflare bypass in connector code or deployment config.

---

## 9. Non-Goals

This specification explicitly does NOT govern:

- Entity Discovery (RT-INV-04)
- Reference Suggestion / RS-04 (Reference fields remain `excluded` in Copilot v1)
- Bootstrap Generation / ADR-001 runtime
- Catalog Expansion
- LLM provider selection (OpenAI, Gemini, OpenRouter, Claude, etc.)
- **Wikidata connector** (Phase 1 — Wikipedia Tier-2 only per IA-01)
- **Fandom connector** (excluded v1)
- **Open Library connector** (deferred)
- **Operator-attested Tier-1** (IA-08 — out of scope v1)
- Fuzzy title matching for connector routing (IA-03 — prohibited)
- Caching, rate limiting, authentication mechanics for external APIs (implementation detail)
- Database persistence of Evidence Bundles or suggestions
- Auto-promotion of community sources to Tier-1 via implementation PRs or env vars
- Governance-managed registry data files
- Implementation-chosen persistence topology (§4.7 is normative)
- Parser implementation choice for normalization (implementation detail)
- **Evidence egress proxy** (IA-11 — deferred until Staging proves live Tier-1 impossible)
- **Cookie / Cloudflare bypass** for Tier-1 connectors (IA-10 — non-conformant)

**In scope for Phase 1:** AWOIAF Tier-1 and Wikipedia Tier-2 connector implementations per §2.2 Phase 1B.

---

## 10. Validation

### Specification conformance

```bash
npm run check:governance
```

- [ ] Document contains all 11 required sections per `governance/SPEC_RULES.md` §6
- [ ] Metadata fields populated per `governance/SPEC_RULES.md` §5
- [ ] Architect decisions recorded in §2.1

### Implementation validation (Implementation Authorization: GRANTED)

```bash
npm test
```

- [ ] Unit tests: tier aggregation → confidence mapping (INV-TC-01)
- [ ] Unit tests: SC-03 path — narrative / yellow / empty sources
- [ ] Unit tests: absent `sourceProfileId` → SC-03 without connector call
- [ ] Unit tests: SC-INV-02 — `SourceRef` not emitted without `EvidenceItem`
- [ ] Unit tests: batch Option B — fact fields connector-first
- [ ] Unit tests: Work → SourceProfile → SourceBinding resolution (§4.7)
- [ ] Unit tests: draft/inactive bindings not dispatched; approved bindings dispatched
- [ ] grep audit: no approver identity on SourceBinding routing path
- [ ] grep audit: no `tier: 1` for wikipedia/wikidata/fandom in connector code
- [ ] grep audit: no `works.title` used for connector routing
- [ ] grep audit: no registry data loaded from governance submodule
- [ ] CI: three-state exit via mock Tier-1 + unit tests (`SOURCE_CONNECTOR_MODE=mock`)
- [ ] Staging: Tier-1 green with **live** AWOIAF + Tier-2 live Wikipedia (§8.2, IA-09)
- [ ] grep audit: no `AWOIAF_FETCH_COOKIE`, `cf_clearance`, or cookie injection in connector code (IA-10)

---

## 11. Refs

| Category | Reference |
| -------- | --------- |
| **Governing ADR** | `docs/adr/004-source-of-canonical-truth.md` — ADR-004 v1.10 |
| **Supporting ADR** | `docs/adr/ADR-D2-001-canonical-metadata-authority.md` |
| **Superseded ADR** | `docs/adr/001-assisted-work-bootstrap-pipeline.md` — ADR-001 (archive only) |
| **Parent SPEC** | `docs/specs/spec-d2-002-enrichment-copilot.md` — SPEC-D2-002 v0.1 |
| **Governance: SPEC rules** | `governance/SPEC_RULES.md` |
| **Governance: Template** | `governance/templates/SPEC_TEMPLATE.md` |
| **Governance: Naming** | `governance/DOCUMENT_NAMING_CONVENTION.md` |

**Relationship to SPEC-D2-002:** SPEC-D2-002 §4.4 Fact Pipeline steps 2–4 MUST be interpreted through §3.5 of this document. `SourceConnectorOutput` remains the compatibility projection in §4.3. On tier/confidence conflict, SPEC-D2-003 §3.5 governs over SPEC-D2-002 §8. Batch suggest in SPEC-D2-002 MUST comply with §3.11 Option B when this spec is implemented.