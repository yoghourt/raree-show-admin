# SPEC-CORE-001 — Entity Schema & Field Classification Registry

## Metadata

| Field        | Value                                                              |
| ------------ | ------------------------------------------------------------------ |
| Title        | Entity Schema & Field Classification Registry                      |
| Status       | EffectiveInImplementation                                          |
| Version      | v1.1                                                               |
| Owner        | Architect                                                          |
| Last Updated | 2026-07-07                                                         |
| Derived From | ADR-004 (`docs/adr/004-source-of-canonical-truth.md`)              |
| Related      | SPEC-D2-002, SPEC-D2-003                                           |

---

## 1. Purpose

ADR-004 Decision 11–13 define the field classification taxonomy and Copilot routing model at the architecture layer. ADR-004 explicitly defers **individual field classifications** and the **authoritative per-field registry** to downstream specifications.

SPEC-CORE-001 closes that deferral for Runtime Truth v1. It becomes the **sole governance authority** for:

- Which fields exist on Character, Location, and Reading Route (implementation: Scene) entity forms
- Each field's `classification` and `copilot_route` metadata
- Scope field designation and mandatory-at-creation rules
- The metadata contract consumed by the Enrichment Copilot runtime

This specification defines **How** and **Validation**. It does not restate ADR-004 rationale. On any conflict, ADR-004 governs.

---

## 2. Scope

### In Scope

- Entity types: `character`, `location`, `scene` (Enrichment Copilot coverage per SPEC-D2-002)
- Per-field registry: form field name, DB column, classification, copilot_route, mandatory-at-creation, suggest eligibility (derived)
- System fields excluded from Copilot operations
- Normative `FieldMetadata` shape
- Default classification × route mapping (Decision 13)
- Classification change governance (ADR-004 Decision 12)
- Consumer contract: implementation MUST mirror §4.3 after this SPEC reaches Approved status

### Out of Scope

- Enrichment Copilot session lifecycle, suggest/retry payloads → SPEC-D2-002
- Evidence retrieval, Tier rules, Source Connector → SPEC-D2-003
- Discovery, Candidate lifecycle, Editorial Story → ADR-006 / downstream SPECs
- Governed Editorial↔Runtime projection → ADR-007 / SPEC-ROL-001
- Reference Suggestion v1 runtime behavior (RS-04); v1 registers reference-route fields with effective exclusion only
- Work entity Copilot registry
- ADR-004 illustrative-only field examples (`participants`, `scene_description`, `avatar_prompt`) — not registered
- Deprecated DB columns (`book`, `chapter`, `pov_character`) — not registered
- Implementation code (`lib/ai/field-registry.ts`, tests, UI)

---

## 3. Runtime Contracts

The following contracts govern Copilot routing behavior derived from this registry. Full Enrichment session semantics remain in SPEC-D2-002.

**CORE-RC-01 — Metadata-driven routing**

The Copilot runtime MUST derive all field routing decisions exclusively from registry metadata (ADR-004 MD-01, AC-26). Hard-coded field name literals in routing logic are prohibited.

**CORE-RC-02 — Asset permanent exclusion**

Fields with `classification: asset` MUST have effective Copilot route `excluded` regardless of any `copilot_route` value in registry metadata (FC-03, AC-29).

**CORE-RC-03 — Scope field exclusion**

Scope fields (§4.2) MUST NOT appear in suggest request or response payloads (AC-15).

**CORE-RC-04 — Reference route v1 exclusion**

Fields with `copilot_route: reference` MUST NOT appear in suggest request or response payloads in Runtime Truth v1 (RS-04, SPEC-D2-002 OQ-03). Effective route is `excluded` for v1 suggest eligibility.

**CORE-RC-05 — Unregistered fields**

Form fields not registered in §4.3 for the entity type MUST be treated as Copilot-excluded.

**CORE-RC-06 — Extensibility without routing code changes**

Adding a registered field or entity type to §4.3 MUST NOT require changes to Copilot routing logic, provided metadata is complete (MD-02, MD-03, AC-27).

**CORE-RC-07 — Suggest eligibility derivation**

A field is suggest-eligible when **all** of the following hold:

1. Registered in §4.3 for the entity type
2. Effective route is `fact` or `narrative`
3. Current form value is empty (RT-INV-08; enforced by SPEC-D2-002 client)

---

## 4. Data Contracts

### 4.1 FieldMetadata Shape

Each registered field MUST declare:

```typescript
interface FieldMetadata {
  classification: "scope" | "canonical" | "narrative" | "asset";
  copilot_route:  "excluded" | "fact" | "narrative" | "reference";
}
```

`classification` and `copilot_route` are independent (FC-02, AC-28). Classification type does not imply route.

### 4.2 Scope Fields

| EntityType | Scope field (form) | Scope field (DB) | Duplicate check constraint        |
| ---------- | ------------------ | ---------------- | --------------------------------- |
| `character` | `name`            | `name`           | UNIQUE(`work_id`, `name`)         |
| `location`  | `name`            | `name`           | UNIQUE(`work_id`, `name`)         |
| `scene`     | `title`           | `title`          | UNIQUE(`work_id`, `title`)         |

**Note:** ADR-004 examples use `canonical_name` for Character/Location scope fields. That naming is illustrative only (ADR-004 Decision 11). Runtime Truth v1 uses `name` per existing Admin forms and database schema.

**Reading Route scope anchor (Architect Decision 13):** `title` is the session anchor for Reading Route entities (implementation: Scene). It gates Copilot eligibility and duplicate detection (`useCopilotSession`, `SceneForm`). `chapter_title` is a canonical fact field (§4.3.4), not the primary scope anchor.

§4.2 lists the **session anchor** scope field per entity (duplicate-check target and Copilot `scopeField`). Other fields MAY use `scope` classification when operator-defined and never AI-suggested; see §4.3.4 (`tags`).

### 4.3 Authoritative Field Registry

Column definitions:

- **Form field** — camelCase in React form state and TypeScript types
- **DB column** — snake_case in Supabase tables
- **Classification** — `scope` | `canonical` | `narrative` | `asset` (FC-04)
- **Copilot route** — `excluded` | `fact` | `narrative` | `reference`
- **Suggest?** — whether field may appear in `/suggest` requests when empty and effective route is fact/narrative
- **Mandatory** — required at entity creation per Admin form validation

#### 4.3.1 Migration from SPEC-D2-002 Appendix A

This registry supersedes SPEC-D2-002 Appendix A as the authoritative source. The following governance corrections apply relative to Appendix A:

| Field           | Appendix A (superseded)     | SPEC-CORE-001 (authoritative)      |
| --------------- | --------------------------- | ---------------------------------- |
| `tags`          | classification=`excluded` ❌ | `scope` + route `excluded`         |
| `locationId`    | classification=`reference` ❌ | `canonical` + route `reference`    |
| `characterIds`  | classification=`reference` ❌ | `canonical` + route `reference`    |
| Reading Route scope anchor | `chapter_title` = scope ❌ | `title` = scope (Decision 13) |
| `chapter_title` | scope / excluded            | `canonical` / `fact`               |
| `title`         | narrative / narrative       | `scope` / `excluded`               |

#### 4.3.2 Character (`characters` table)

| Form field       | DB column         | Classification | Copilot route | Suggest? | Mandatory | Notes                                      |
| ---------------- | ----------------- | -------------- | ------------- | -------- | --------- | ------------------------------------------ |
| `name`           | `name`            | `scope`        | `excluded`    | No       | Yes       | Duplicate check target; operator-defined |
| `house`          | `house`           | `canonical`    | `fact`        | Yes      | No        | House/faction; Source First (SC-04)        |
| `description`    | `description`     | `narrative`    | `narrative`   | Yes      | No        | Character description prose                |
| `signatureQuote` | `signature_quote` | `narrative`    | `narrative`   | Yes      | No        | Memorable quote                            |
| `portraitUrl`    | `portrait_url`    | `asset`        | `excluded`    | No       | No        | Portrait URL; FC-03 permanent exclusion    |

**System fields excluded from Copilot:** `id`, `tsid`, `workId`, `createdAt`

#### 4.3.3 Location (`locations` table)

| Form field    | DB column     | Classification | Copilot route | Suggest? | Mandatory | Notes                                      |
| ------------- | ------------- | -------------- | ------------- | -------- | --------- | ------------------------------------------ |
| `name`        | `name`        | `scope`        | `excluded`    | No       | Yes       | Duplicate check target; operator-defined |
| `region`      | `region`      | `canonical`    | `fact`        | Yes      | No        | Geographic region; Source First            |
| `description` | `description` | `narrative`    | `narrative`   | Yes      | No        | Location description prose                 |
| `map_focus_x` | `map_focus_x` | `asset`        | `excluded`    | No       | No        | Map coordinate (0–1 float)                 |
| `map_focus_y` | `map_focus_y` | `asset`        | `excluded`    | No       | No        | Map coordinate (0–1 float)                 |

**System fields excluded from Copilot:** `id`, `tsid`, `workId`, `createdAt`

#### 4.3.4 Reading Route (implementation: `scenes` table)

| Form field        | DB column         | Classification | Copilot route | Suggest? | Mandatory | Notes                                           |
| ----------------- | ----------------- | -------------- | ------------- | -------- | --------- | ----------------------------------------------- |
| `title`           | `title`           | `scope`        | `excluded`    | No       | Yes       | Session anchor (§4.2); duplicate check target; operator-defined |
| `chapter_title`   | `chapter_title`   | `canonical`    | `fact`        | Yes      | No        | Chapter heading; Source First; nullable in form |
| `chapter_number`  | `chapter_number`  | `canonical`    | `fact`        | Yes      | Yes       | Chapter sequence number; Source First           |
| `summary`         | `summary`         | `narrative`    | `narrative`   | Yes      | No        | Route Synopsis — container-level narrative prose for this Reading Route |
| `tags`            | `tags`            | `scope`        | `excluded`    | No       | No        | Curator-defined; hidden in UI; not AI-suggested. Not a session anchor (§4.2). Classified `scope` (not invalid Appendix A `excluded`) because operator-only metadata; ensures server rejects `tags` in `emptyFields` per D2-002 §7.6 |
| `story_images_v2` | `story_images_v2` | `asset`        | `excluded`    | No       | No        | Reading Frames JSONB — ordered array of `{url, caption}` (Reading Frame + Frame Narrative) |
| `locationId`      | `location_id`     | `canonical`    | `reference`   | No       | No        | Location FK; v1 effective excluded (RS-04)      |
| `characterIds`    | `character_ids`   | `canonical`    | `reference`   | No       | No        | Character FK array; v1 effective excluded (RS-04). React form field: `characterIdsTsids` / `characterIdsFallback`; client maps to `characterIds` for Copilot enumeration |

**Form field aliases (Reading Route, implementation: Scene):** `SceneForm` registers `characterIdsTsids` and `characterIdsFallback` in React state. The Copilot registry key is `characterIds`; the client MUST map picker/fallback values to that key before calling `getSuggestableFields`.

**System fields excluded from Copilot:** `tsid`, `workId`, `order_index`

Note: Reading Route (`scenes`) table may have internal `id`; it is not used in Admin Copilot forms and is excluded.

### 4.4 Default Classification × Route Mapping

Per ADR-004 Decision 13. Per-field assignments in §4.3 MAY override defaults where justified.

| Classification | Default Copilot route |
| -------------- | --------------------- |
| `scope`        | `excluded`            |
| `canonical`    | `fact`                |
| `narrative`    | `narrative`           |
| `asset`        | `excluded`            |

Asset classification MUST NOT be assigned a non-`excluded` effective route (FC-03).

### 4.5 Effective Route Resolution

Implementation MUST resolve effective Copilot route in this order:

1. If field is not registered in §4.3 → `excluded`
2. If `classification === "asset"` → `excluded` (FC-03)
3. If `copilot_route === "reference"` → effective `excluded` for v1 suggest paths (CORE-RC-04)
4. Otherwise → registered `copilot_route`

### 4.6 Extensibility and Registry Changes

New fields added to any entity type MUST be registered in §4.3 with valid `classification` and `copilot_route` before the Copilot runtime may route them (MD-02).

New entity types MUST include a complete §4.3 registry section before Copilot support is authorized (MD-03).

Registry changes that introduce or modify field classifications require Architecture review and approval before taking effect (ADR-004 Decision 12 Classification Governance).

---

## 5. State Transitions

This SPEC governs registry metadata, not Enrichment session state. The registry itself follows a governance lifecycle:

```text
Proposed → ArchitectureReview → Approved → EffectiveInImplementation
```

| Transition | Trigger |
| ---------- | ------- |
| Proposed → ArchitectureReview | SPEC amendment or new field registration submitted |
| ArchitectureReview → Approved | Governance review complete; SPEC status updated |
| Approved → EffectiveInImplementation | Implementation registry mirror verified against §4.3 |

Enrichment Copilot session state transitions remain governed by SPEC-D2-002.

---

## 6. Error Handling

| Error condition | Required response |
| --------------- | ----------------- |
| Registry entry missing `classification` or `copilot_route` | Governance non-conformance; field MUST be treated as Copilot-excluded at runtime |
| Invalid classification value (not FC-04) | Change MUST NOT merge; governance violation |
| Asset field with non-`excluded` `copilot_route` in registry | Spec non-conformance; runtime MUST still enforce FC-03 effective exclusion |
| Unregistered form field submitted to suggest pipeline | Field MUST be filtered out before suggest request (CORE-RC-05) |

---

## 7. Security Constraints

- Registry changes MUST go through Architecture review (ADR-004 Decision 12)
- Registry metadata MUST NOT encode Discovery, auto-persist, or bypass Human Acceptance semantics
- Registry publication MUST NOT introduce new constitutional invariants without escalation per governance law

---

## 8. Acceptance Criteria

### 8.1 SPEC document criteria (verified at Draft / review)

- [x] CORE-AC-01: All three entity types register every Copilot-relevant form field with valid `classification` and `copilot_route`
- [x] CORE-AC-02: Scope fields match §4.2 exactly
- [x] CORE-AC-03: No field uses a classification outside FC-04 (`scope`, `canonical`, `narrative`, `asset`)
- [x] CORE-AC-04: All asset-classified fields have `copilot_route: excluded`
- [x] CORE-AC-05: Reference-intent fields (`locationId`, `characterIds`) use `copilot_route: reference` with canonical classification
- [x] CORE-AC-06: Appendix A content is fully represented in §4.3 including documented governance corrections (§4.3.1)
- [x] CORE-AC-07: SPEC-D2-002 references SPEC-CORE-001 §4.3 as sole registry authority

### 8.2 Implementation criteria (verified at EffectiveInImplementation)

- [x] CORE-AC-IMP-01: `lib/ai/field-registry.ts` mirrors §4.3 tables
- [x] CORE-AC-IMP-02: Unit tests verify FC-03 asset exclusion, reference v1 exclusion, and scope exclusion

---

## 9. Non-Goals

- Discovery Candidate fields or Editorial Story registry entries
- Governed projection link schema
- Work-level or catalog-level field registry
- Reference Suggestion v1 implementation
- Database migration SQL or API endpoint design
- Modifying Enrichment session, retry, or Human Acceptance semantics in SPEC-D2-002
- Registering deprecated or illustrative-only ADR fields

---

## 10. Validation

### 10.1 Draft / governance review

```bash
npm run check:governance
```

Manual checks:

- SPEC_RULES §6 section order and required metadata
- Derived From references ADR-004 without version suffix in cross-references
- §4.3 diff against superseded Appendix A limited to documented corrections in §4.3.1 (including Scene scope anchor, Decision 13)

### 10.2 Implementation validation (EffectiveInImplementation)

```bash
npm run test -- __tests__/ai/field-registry.test.ts
```

Invariant checks: FC-03, MD-01, CORE-RC-01 through CORE-RC-06, AC-26–AC-29 mapping.

---

## 11. Refs

### Governance

- `governance/Constitution.md`
- `governance/FOUNDATION.md`
- `governance/ADR_RULES.md`
- `governance/SPEC_RULES.md`
- `governance/templates/SPEC_TEMPLATE.md`

### ADR

- `docs/adr/004-source-of-canonical-truth.md` — ADR-004 (parent; Decision 11–13, MD-01–MD-04, FC-01–FC-04)

### Related SPECs

- `docs/specs/spec-d2-002-enrichment-copilot.md` — SPEC-D2-002 (consumer; Enrichment session)
- `docs/specs/spec-d2-003-source-connector-v1.md` — SPEC-D2-003 (Fact pipeline evidence)

### Precedence

```text
ADR-004 > SPEC-CORE-001 > SPEC-D2-002
```

Tier and confidence conflicts between SPEC-D2-002 and SPEC-D2-003 remain governed by SPEC-D2-003 where specified.

### Read-only implementation anchors (not modified by this SPEC)

- `lib/ai/field-registry.ts`
- `lib/ai/copilot-types.ts`

These files are expected to mirror §4.3 after Implementation authorization.

---

## Legacy Alias Reference

*Runtime vocabulary aligned with `docs/runtime-lexicon-v2.md` (ADR-BP-RT-001).*

| Normative Term | Legacy Term | Classification | Status |
| -------------- | ----------- | -------------- | ------ |
| Reading Route | Scene | Implementation Alias | Active — implementation symbol `scenes` |
| Reading Frame | Story Image | Implementation Alias | Active — implementation symbol `story_images_v2[]` element |
| Frame Narrative | caption | Documentation Alias | Active — implementation field name |
| Route Synopsis | summary | Documentation Alias | Active — implementation column name |
