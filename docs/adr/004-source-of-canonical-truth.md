# ADR-004 — Source of Canonical Truth

**Status:** Accepted
**Type:** Architecture ADR
**Version:** 1.11
**Last Updated:** 2026-06-28
**Owner:** Architect
**Supersedes:** ADR-001 (Assisted Work Bootstrap Pipeline — archived as Experimental Prototype)
**Amendment:** Clarification only — A1 (Runtime Truth Topology), A2 (chapter_title qualifier),
A3 (Known Constraint §15), Follow-up restructure (ADR-005 + ADR-006),
A4 (ADR-005 Accepted — Narrative Information Model; Follow-up Roadmap and §15 updated).
No Decisions, Acceptance Criteria, or routing logic changed.

**A4 Historical Note:** Prior Follow-up Roadmap text described ADR-005 as
investigation-phase "Content Topology Normalization." ADR-005 is now **Accepted**
as the **Narrative Information Model** (editorial domain). **Correction rationale:**
investigation is complete; editorial Story semantics are frozen. **Runtime
reconciliation:** Runtime Truth v1 topology is unchanged; editorial model is
orthogonal until a future Rollout ADR.

---

## What

This ADR establishes the authoritative ownership model for Canonical Truth in the
Raree Show system.

It defines:

* The foundational principle of Human-Owned Canonical Truth.
* The role of AI in the content authoring workflow.
* The boundary between Canonical and Narrative fields.
* The Copilot Workflow that replaces the Bootstrap Prototype.
* The Scope Definition Model establishing which fields constitute session scope and
  which fields are eligible for AI suggestion.
* The Suggestion Classification Model distinguishing Fact Suggestions (source-first,
  verifiable) from Narrative Suggestions (generative drafts) and the SC-04 Source
  First Principle governing retrieval precedence.
* The Copilot Runtime Invariants governing session scope and suggestion behavior.
* The Global Copilot Runtime Model including retry queue and session lifecycle.
* The Source Verification Model for authority-ordered source display.
* The entity creation and duplicate-prevention model.
* The AI capability boundary in force for Runtime Truth v1.
* The capability migration matrix from ADR-001 to ADR-004.
* The Metadata-Driven Field Classification model separating classification-type
  ownership (this ADR) from individual field classification ownership (schema
  specifications).
* The Field Classification Model (Decision 12) defining four field types —
  Scope, Canonical, Narrative, Asset — as semantic descriptors independent
  of Copilot routing behavior.
* The Copilot Routing Model (Decision 13) defining four Copilot routes —
  Excluded, Fact Suggestion, Narrative Suggestion, Reference Suggestion — as
  a runtime concept independent of field classification.
* The Discovery boundary deferring all entity-discovery capabilities to
  ADR-006 — Discovery Copilot Architecture.
* The Known Constraint §15 bounding ADR-004 to Runtime Truth v1 topology;
  the Editorial Domain Narrative Information Model is governed by ADR-005 —
  Narrative Information Model (Accepted v1.1); cross-domain mapping remains deferred.

### Runtime Truth v1 Topology

The current Runtime Truth v1 content topology is:

```text
Work
 └─ Scene           (routable runtime reading unit)
      └─ Story Images  (ordered visual frames inside a Scene)
```

Definitions (descriptive; no future topology implied):

* **Scene** — The routable runtime reading unit. Each Scene record belongs to
  one Work, carries chapter metadata as descriptive fields, and contains an
  ordered sequence of Story Images.
* **Story Image** — One ordered visual frame inside a Scene, stored as
  `{url, caption}` in the `story_images_v2` JSONB column. Story Images are
  not independent routable entities.
* **Chapter metadata** (`chapter_number`, `chapter_title`) — Descriptive
  organisational fields on Scene. They are not a separate navigation layer in
  Runtime Truth v1.

This section describes the current runtime state only. The Editorial Domain
Narrative Information Model is governed by ADR-005 v1.1 (see Known Constraint §15).
Cross-domain mapping of Story units remains outside ADR-004 scope.

---

## Why

### The Bootstrap Prototype Produced Unacceptable Canonical Quality

ADR-001 introduced a Bootstrap Prototype in which AI acted as a Canonical Truth
producer:

```text
Source Content
    ↓
AI Bootstrap
    ↓
Canonical Dataset (immediate persistence)
```

EAR-004 (Copilot Authoring Workflow Feasibility Audit) and the prior evidence chain
from ADR-D2-001 (EAR-D2-013 through EAR-D2-015) established that this model is
not viable for Runtime Truth v1:

**EAR-D2-013** — Scene-level recall is unreliable at production thresholds.

**EAR-D2-014** — Bootstrap prompt constraints structurally cap character and location
recall at 35–50%. Chapter catalog fails for complex long-form works.

**EAR-D2-015** — Removing prompt constraints improves recall but drops precision to
65–96%. Root causes are non-fixable via prompt engineering:

1. Training data fusion — LLM knowledge merges source text, adaptations, and fan
   content. These cannot be separated at inference time.
2. Book boundary instability — For series works, the model cannot reliably distinguish
   which characters appear in which volume.
3. Adaptation contamination — Film and TV adaptation characters are presented as
   canonical source text characters.

**Runtime Truth v1 requirements** are not satisfied by LLM-generated output:

```text
Characters:   Precision = 100%, Recall ≥ 95%
Locations:    Precision = 100%, Recall ≥ 95%
Chapter:      Count = 100%, Title = 100%, Order = 100%
```

Any error in these layers propagates silently through all downstream consumers
(Progress Graph, Scene Mapping, Narrative Navigation, Character Arc Graph).

### The Correct Role of AI is Assistance, Not Authority

AI systems in 2026 are capable of high-quality field suggestion and narrative
enrichment for known works. They are not capable of serving as the sole authority
for Canonical Truth without unacceptable error rates.

The correct model is:

```text
Human owns Canonical Truth.
AI provides suggestions.
Human decides.
```

This distinction resolves the architectural failure of the Bootstrap Prototype.

---

## Foundational Principle

**Humans own canonical truth.**

**AI may assist authoring but may not approve, persist, or define truth.**

This principle is the constitutional foundation of the Copilot Runtime Model.
It supersedes any implementation convenience that would allow AI to bypass
human acceptance.

Corollaries:

* AI output is always a candidate, never a fact.
* A suggestion that has not been accepted by a human has no standing in the system.
* No architectural pattern, optimisation, or convenience feature may weaken
  the human acceptance gate.

This principle applies at all layers — API, UI, and persistence — without exception.

---

## Decision

### Decision 1 — Canonical Truth Ownership

**Human owns Canonical Truth.**

AI is never a Canonical Truth authority in the Raree Show system.

This applies to:

```text
Character names and affiliations
Location names and regions
Scene canon and chapter structure
Entity identity and deduplication
```

---

### Decision 2 — Copilot Workflow

The system SHALL implement the following authoring workflow:

```text
Human Input
    ↓
AI Suggestion
    ↓
Human Acceptance
    ↓
Database
```

Rules:

* AI suggestions SHALL NOT be persisted without explicit human acceptance.
* Human acceptance is a discrete, per-entity or per-field action.
* No automatic or bulk persistence of AI-generated content is permitted.

---

### Decision 3 — Canonical vs Narrative Field Separation

Fields are classified into two categories.

#### Canonical Fields

Canonical fields are identity-bearing. They define what an entity is.

Examples:

```text
Character:  name, house
Location:   name, region
Work:       title
Chapter:    title, number, order
```

Rules:

* Canonical fields require human ownership at creation.
* AI may suggest a value for a Canonical field during initial entity creation.
* AI SHALL NOT overwrite an existing Canonical field value without human action.
* Canonical field values are not regenerable without human review.

#### Narrative Fields

Narrative fields carry descriptive or generative content. They describe what an
entity is like.

Examples:

```text
Character:  description, signatureQuote
Location:   description
Scene:      summary, imageCaption
Avatar:     avatar prompt
```

Rules:

* Narrative fields may be regenerated by AI at human request.
* Regeneration of a Narrative field does not affect entity identity.
* After regeneration, the new value requires human acceptance before persistence.
* Regeneration does not elevate AI to Canonical Truth status.

---

### Decision 4 — Entity Creation Model

Entity creation requires a human-provided Canonical Name.

```text
Character creation requires: Canonical Name (human-provided or human-accepted)
Location creation requires:  Canonical Name (human-provided or human-accepted)
```

AI may suggest a Canonical Name as a candidate. The human must accept or edit
the suggestion before the entity is created.

Current Runtime Truth v1 does not support alias-driven entity creation.
An entity is identified by its canonical name as stored in the database.
Aliases, alternate names, and cross-reference resolution are explicitly
deferred to a future architecture revision.

---

### Decision 5 — Duplicate Prevention

Before creating any canonical entity, a duplicate check MUST occur.

Working uniqueness rule:

```text
UNIQUE(work_id, canonical_name) per entity type
```

Enforcement:

* The duplicate check SHALL occur at the point of Scope Field entry, immediately
  after the operator provides the canonical_name (or chapter_title for Scene),
  before the Copilot session is activated.
* If a duplicate is detected, the system SHALL surface the conflict to the human
  operator for resolution. The Copilot icon SHALL remain disabled until the
  conflict is resolved.
* Only after the duplicate check passes is the entity marked Copilot Eligible
  and the Copilot icon activated.
* The system SHALL NOT automatically merge or alias two entities.
* Alias Merge is explicitly deferred. No Alias Merge system is required for
  Runtime Truth v1.

---

### Decision 6 — AI Capability Boundary

AI MAY perform the following in the Copilot workflow:

```text
Suggest field values (name, house, region, description, signatureQuote)
Generate narrative descriptions for entities
Generate avatar prompts for characters
Provide candidate entity references for a given work
Generate scene summaries and image captions
```

AI MAY NOT perform the following:

```text
Approve Canonical Truth for any entity or field
Auto-merge entities or resolve duplicate identity
Auto-persist catalogs, entities, or fields without human acceptance
Discover a canonical catalog and present it as production-ready
Act as the sole authority for any persisted data
```

---

### Decision 7 — Bootstrap Prototype Rejection

ADR-001 (Assisted Work Bootstrap Pipeline) is NOT accepted as production architecture.

**Reason:** In ADR-001, AI acted as a Canonical Truth producer. The pipeline
generated and immediately persisted a full entity catalog without human review
of individual entities. This violates Decision 1 (Human owns Canonical Truth)
and Decision 2 (database mutations require human acceptance).

ADR-001 is archived as an Experimental Prototype. Its evidence chain
(EAR-D2-001 through EAR-D2-009b) and learnings are retained for historical
reference.

**Components from ADR-001 that remain valid:**

```text
BootstrapProvider interface     — reusable for suggestion generation
OpenRouterBootstrapProvider     — reusable as a text generation backend
GeminiBootstrapProvider         — reusable as a text generation backend
bootstrap-parser utilities      — reusable for JSON extraction and validation
Phase 1 schema (signatureQuote) — valid schema extension, retained
```

**Components from ADR-001 that are rejected:**

```text
Batch persistence route logic       — violates Decision 2
clearExisting bulk deletion         — violates Decision 8
Catalog-level generation → persist  — violates Decision 8
BootstrapPanel trigger model        — violates Decision 2 (no human acceptance step)
```

---

### Decision 8 — Suggestion Scope Boundary

The following operations are within the allowed scope of the Copilot workflow:

```text
Field-Level Suggestion:
  AI suggests a value for a single field.
  Human reviews and accepts or edits.

Entity-Level Review:
  AI suggests all fields for a single entity.
  Human reviews each field.

Accept All Fields within a Reviewed Entity:
  After reviewing all fields of a single entity,
  human may accept all fields in one action.
  This is scoped to the entity, not to the catalog.
```

The following operations are explicitly NOT allowed under the Copilot workflow:

```text
Catalog-Level Acceptance:
  Accept all AI-generated entities for a Work in one action.

Work-Level Acceptance:
  Accept all AI suggestions for a Work without individual entity review.

Generate Entire Catalog → Accept All → Persist:
  This is the Bootstrap pattern and is rejected by this ADR.
```

This boundary is the formal distinction between:

```text
Copilot  — field and entity scope, human acceptance per entity
Bootstrap — catalog scope, no human acceptance gate
```

---

### Decision 9 — Scope Definition Model

> **Terminology Note (A2):** Throughout this ADR, "Scene" refers to the current
> Runtime Scene entity (Work → Scene → Story Images topology). `chapter_title`
> refers to the Scope Field of the current Runtime Scene. This qualifier prevents
> ambiguity with any future Story entity. See Known Constraint §15.

Every Copilot session MUST have a human-defined scope before AI suggestions are
generated.

Scope is constituted by a single, human-provided Scope Field per entity type:

```text
Character:  canonical_name  (human-provided)
Location:   canonical_name  (human-provided)
Scene:      chapter_title   (human-provided; current Runtime Scene)
```

Rules:

* Scope Fields are never generated, suggested, or influenced by AI.
* A Copilot session may not begin without a Scope Field value.
* AI suggestions are enrichment operations scoped to non-Scope Fields only.
* AI may not use its suggestion capability to introduce new entities into the
  catalog. Suggestions that would implicitly discover a new entity name are
  prohibited.

This decision closes the architectural gap identified in the v1.2 freeze review:
without an explicit Scope Definition Model, RT-INV-04 (Entity Discovery
Prohibited) could be bypassed by an AI that generates canonical names as
"enrichment" suggestions.

---

### Decision 10 — Suggestion Classification Model

All Copilot suggestions are classified into two mutually exclusive categories.
The classification determines the authority pipeline and the confidence contract
for each suggestion.

#### Fact Suggestion

A Fact Suggestion provides a candidate value for a field that has an objectively
verifiable or externally authoritative answer.

```text
Applicable fields:  house, region, faction, affiliation, parent, occupation
Goal:               Finding Facts
Authority pipeline: Human Scope → Source Retrieval → Evidence → Structured Fact Suggestion
```

Source First is mandatory for Fact Suggestions. When authoritative sources exist,
source retrieval MUST precede generation. Model knowledge alone is not a sufficient
authority for a Fact Suggestion when a Tier-1 or Tier-2 source is available.

#### Narrative Suggestion

A Narrative Suggestion provides a draft value for a field that does not have a
single objectively correct answer. It is a cost-reduction tool, not a truth-finding
tool.

```text
Applicable fields:  description, summary, signature_quote, avatar_prompt, scene_description
Goal:               Reducing Typing Cost
Authority pipeline: Human Scope → Evidence + Existing Accepted Data → LLM Draft → Narrative Suggestion
```

LLM generation is permitted for Narrative Suggestions. Human review remains mandatory.

#### Original Work Fallback

When authoritative sources do not exist for a work (original, unpublished, or
source-sparse works), the SC-03 fallback applies:

```text
Human Scope → LLM Suggestion → Yellow Confidence
```

The fallback is legal only under these conditions. Human approval remains mandatory.
Yellow confidence MUST be displayed to the operator. This fallback does not apply
to Scope Fields, which remain human-owned unconditionally.

#### SC-04 — Source First Principle

```text
When authoritative sources exist,
retrieval precedes normalization.

Normalization should enrich evidence.
Normalization should not replace evidence.
```

This principle applies at the provider layer. A provider that produces Candidate
Fact values from model knowledge alone, when Tier-1 or Tier-2 sources are
available via a Source Connector, violates SC-04 and is non-conformant.

---

### Decision 11 — Metadata-Driven Field Classification

ADR-004 owns the field classification system.
ADR-004 does not own individual field classifications.

#### Ownership Split

```text
ADR-004 owns — Classification Types:
    Scope Field       — identity anchor; never AI-generated (SD-02)
    Fact Field        — verifiable; routes to SC-01 pipeline
    Narrative Field   — generative; routes to SC-02 pipeline

Schema Specifications own — Individual Field Classifications:
    Which field on which entity type belongs to which classification type.
    This is a schema-layer concern, not an architecture-layer concern.
```

The field examples used throughout ADR-004 (house, region, description, etc.)
are illustrative. They demonstrate how classification types work in principle.
They are not a classification registry and carry no binding classification
authority.

#### Rules

```text
MD-01   Copilot MUST NOT hard-code field names for pipeline routing.
        Classification routing (SC-01 / SC-02 / excluded) is determined
        solely by field classification metadata provided at the schema layer.

MD-02   New fields do not require Copilot runtime changes.
        Adding a new field to an existing entity type does not require any
        modification to Copilot runtime code, provided classification metadata
        for that field is supplied by the schema specification.

MD-03   New entity types do not require Copilot runtime changes.
        Adding a new entity type does not require any modification to Copilot
        runtime code, provided the new entity type's complete field metadata
        (including classification per field) is supplied by the schema
        specification.

MD-04   Classification metadata is the contract between layers.
        The schema layer publishes classification metadata.
        The Copilot runtime consumes it.
        Neither layer may bypass this contract.
```

#### Classification Authority Boundary

```text
Architecture Layer (ADR-004)        — defines WHAT the classification types are
Schema Layer (schema specifications) — defines WHICH fields belong to each type
Copilot Runtime                     — executes routing from metadata; no hard-coding
```

The complete and authoritative field classification taxonomy is defined in
Decision 12. Decision 11 defines the metadata-driven architecture that applies
to that taxonomy; it does not enumerate the types.

---

### Decision 12 — Field Classification Model

ADR-004 defines four field classification types. These types describe what a
field semantically represents.

**Field classification does not determine Copilot behavior.**

Field classification and Copilot routing are independent architectural
concerns. A field's classification type does not imply which Copilot route,
if any, applies to it. Copilot routing is defined separately in Decision 13.

#### Scope

Identity-bearing fields that define what entity is being authored. Scope
fields are the session anchor. They are never AI-generated or AI-suggested.

```text
Examples:
  Character:  canonical_name
  Location:   canonical_name
  Scene:      chapter_title
```

#### Canonical

Structured fact fields that carry objectively verifiable or externally
authoritative values. Canonical field values are intended to become Runtime
Truth once human-accepted.

```text
Examples:
  Character:  house, affiliation, occupation
  Location:   region, parent_location
```

#### Narrative

Generated or descriptive text fields that describe what an entity is like.
There is no single objectively correct value for a Narrative field.

```text
Examples:
  Character:  description, signature_quote
  Location:   description
  Scene:      summary, scene_description
```

#### Asset

References to external media assets. Asset fields store URLs or identifiers
pointing to binary media resources (images, audio, video). Asset field values
are not text content and are not candidates for Copilot text suggestion.

```text
Examples:
  Character:  portraitUrl
  Location:   imageUrl (if present)
```

**Asset classification does not imply AI generation.**

Asset fields may be populated by any of the following means:

```text
- Manual file upload      (operator selects a local file)
- URL paste               (operator enters an external URL)
- External reference      (system-managed CDN or storage reference)
- Dedicated generation tooling  (e.g., AI image generation Server Action)
```

The presence of dedicated generation tooling for an Asset field is an
independent capability. It does not make the field a Narrative field, and
it does not bring the generation workflow into the Copilot suggestion pipeline.

The current runtime example is AI Generate Avatar (Character): an independent
media-generation Server Action that produces a Cloudinary URL and writes it
directly into the `portraitUrl` form field. This workflow is not a Copilot
Suggestion and is not governed by this ADR.

#### Classification Rules

```text
FC-01   Field classification is semantic.
        Classification describes what a field represents.
        It does not describe how any runtime system processes it.

FC-02   Classification does not imply routing.
        A field's classification type does not determine its Copilot route.
        Routing is a separate decision (Decision 13).

FC-03   Asset fields are excluded from Copilot suggestion pipelines.
        Asset fields MUST NOT appear in any Copilot suggestion request,
        response, or panel display. This exclusion is non-overridable.

FC-04   All four types are valid schema metadata values.
        Schema specifications MUST classify every field as one of:
        scope | canonical | narrative | asset
```

#### Classification Governance

Field classification authority is distributed across two layers, but approval
authority remains with the Architecture layer:

```text
Architecture Authority
    Defines the taxonomy.
    Defines what each classification type means.
    Approves changes to the taxonomy itself.

Schema Specifications
    Apply the taxonomy to specific fields.
    Classify each field as scope | canonical | narrative | asset.

Approval requirement:
    Schema changes that introduce or modify field classifications
    require Architecture review and approval before taking effect.
    Self-classification by the specification author is not sufficient.
```

This approval requirement applies unconditionally when:

* A new entity type is introduced (all fields require initial classification)
* An existing field's classification is changed
* A new field is added to an existing entity type

The approval requirement ensures that classification drift cannot occur
silently at the schema layer. Without it, a new entity type author could
misclassify fields in ways that violate the taxonomy semantics defined here,
causing Copilot routing errors at runtime.

#### Relation to Prior Decisions

Decision 3 introduced an informal two-type distinction (Canonical Fields /
Narrative Fields) for governance purposes. Decision 12 is the authoritative
complete taxonomy. The "Canonical Fields" in Decision 3 correspond to Scope
and Canonical types in this taxonomy combined; the "Narrative Fields" in
Decision 3 correspond to the Narrative type here.

---

### Decision 13 — Copilot Routing Model

Copilot routing defines how the Copilot Panel handles a field during a
suggestion session. Routing is determined by schema layer metadata (Decision 11)
and is independent of field classification (Decision 12).

**Copilot routing and field classification are separate concerns.**

ADR-004 defines four Copilot routes.

#### Excluded

No Copilot participation. The field is absent from all suggestion requests,
responses, and panel displays.

```text
Always excluded:
  Scope fields    (e.g., canonical_name, chapter_title)
  Asset fields    (e.g., portraitUrl)              — FC-03, non-overridable

Also excluded at runtime:
  Fields that already have human-authored values    — RT-INV-08
  Fields explicitly marked excluded in schema metadata
```

#### Fact Suggestion

Retrieval-assisted fact enrichment. Source First applies (SC-04).
The field receives a candidate value derived from authoritative source
evidence. Corresponds to the SC-01 pipeline (How §8).

```text
Typical field type:  Canonical
```

#### Narrative Suggestion

LLM-generated draft content. The field receives a drafted text value.
Corresponds to the SC-02 pipeline (How §8).

```text
Typical field type:  Narrative
```

#### Reference Suggestion

Suggestion of existing entity references. The Copilot proposes which
already-existing entities are relevant to the current entity being authored.

```text
Typical field type:  relational reference fields
Accept behavior:     resolve entity → write entity reference (e.g., TSID)
Example:             Scene → suggested character references → accepted character TSIDs
```

Rules:

```text
RS-01   Reference Suggestion resolves existing entities only.
        The Copilot may only suggest entities that already exist in the system.

RS-02   Reference Suggestion is non-discovery.
        Reference Suggestion does not propose canonical names for entities
        that do not yet exist. This would violate RT-INV-04.

RS-03   Reference Suggestion does not create entities.
        Accepting a Reference Suggestion writes an entity reference.
        It does not trigger entity creation.

RS-04   Reference Suggestion is out of scope for Runtime Truth v1.
        It is defined here for architectural completeness and to prevent
        non-conformant implementations from appearing under other route names.

RS-05   Entities not found in the system are omitted from suggestions.
        If a candidate entity does not exist in the current work's entity
        set, it MUST be silently excluded from the suggestion result.
        It must not be presented to the operator in any form —
        not as a greyed-out option, not as a "create new" prompt,
        not as a Discovery trigger.

RS-06   Reference Suggestion searches within the current work only.
        The search scope is limited to entities that already exist under
        the same work_id. It does not access external knowledge sources,
        does not propose canonical names from model knowledge, and does not
        surface entities from other works.
```

The boundary between Reference Suggestion and Discovery is a single rule:

```text
If the entity exists in the system   →  may be suggested  (RS-01)
If the entity does not exist         →  must be omitted   (RS-05)
                                        must not be discovered (RS-02)
                                        must not be created   (RS-03)
```

Any implementation that presents a non-existing entity — regardless of how
it is labelled — crosses into Discovery territory and requires ADR-006
governance.

#### Default Route × Classification Mapping

Schema metadata may override routing for specific fields (Decision 11, MD-04),
subject to FC-03 (Asset exclusion, which is non-overridable).

```text
Field Classification    Default Copilot Route
────────────────────────────────────────────────────────
Scope                   Excluded
Canonical               Fact Suggestion
Narrative               Narrative Suggestion
Asset                   Excluded  (non-overridable — FC-03)
```

---

## How

### 1. Copilot Workflow Architecture

Copilot is a Global Copilot Panel embedded in the Admin UI. It is not a set of
per-field buttons. Operators work on one entity at a time; the Panel aggregates
all field suggestions for that entity in a single, structured surface.

```text
Admin UI
    │
    ├── Canonical Entity Form
    │       │
    │       ├── Scope Field Input  (e.g., canonical_name = "Arya Stark")
    │       │           │
    │       │           ↓  (immediately after entry)
    │       │       Duplicate Check
    │       │           │
    │       │    ┌──────┴──────────────┐
    │       │    ↓                     ↓
    │       │  Conflict              No Conflict
    │       │  Detected              (Copilot Eligible)
    │       │    │                     │
    │       │  Human               Copilot Icon
    │       │  Decision            (becomes active)
    │       │    │                     │
    │       │  (resolve)     (operator clicks icon)
    │       │                          │
    │       └── ──────────────────── Global Copilot Panel (opens)
    │                                  │
    │              (operator clicks Copilot icon → Panel opens + triggers suggestion check)
    │                                  │
    │                                  ↓
    │                       POST /api/admin/ai/suggest
    │                       ─ scoped to: current entity + empty fields only
    │                                  │
    │                       SuggestionProvider.suggest(context)
    │                                  │
    │                         ┌────────┴────────────────┐
    │                         ↓                         ↓
    │                  SC-01 Fact Pipeline       SC-02 Narrative Pipeline
    │                         │                         │
    │                         └─────────┬───────────────┘
    │                                   ↓
    │                    ┌──────────────────────────────────────────┐
    │                    │ Fact Suggestions                          │
    │                    │  Suggested Value                         │
    │                    │  Source list                             │
    │                    │  Confidence (green / yellow)             │
    │                    │  [Accept] → back-fills form field        │
    │                    │  [Skip]   → no action                    │
    │                    │  Feedback input + [Add to Retry Queue]   │
    │                    ├──────────────────────────────────────────┤
    │                    │ Narrative Suggestions                     │
    │                    │  (same controls as above)                │
    │                    └──────────────────────────────────────────┘
    │                                   │
    │                    [Batch Retry]  ─ executes all queued retry items
    │                                    in a single batched generation call
    │                    [Accept All]  ─ back-fills all visible suggestions
    │                                    to entity form fields
    │                                    (scoped to current entity only)
    │
    └── Entity Form (accumulates back-filled values from Accept / Accept All)
            │
            └── [Save] → Existing CRUD runtime → Database (Runtime Truth)
```

Copilot does not write to the database.
Copilot does not create entities.
Copilot does not discover entities.
Copilot assists operators in completing data entry for the current entity only.

---

### 2. Suggestion Endpoint Contract

The existing Bootstrap route SHALL be refactored or replaced with a Suggestion
endpoint.

Suggested endpoint:

```text
POST /api/admin/ai/suggest
```

Request:

```typescript
{
  workId: string;
  entityType: "character" | "location" | "scene";
  fieldContext?: {
    currentValues: Partial<Entity>;
  };
}
```

Response:

```typescript
{
  suggestions: {
    field: string;
    value: string | null;
    confidence: "green" | "yellow";
  }[];
  candidates?: {
    name: string;
    fields: Record<string, string | null>;
  }[];
}
```

Rules:

* The endpoint returns suggestions only. It does not persist.
* The response contains no TSIDs. The server generates TSIDs at acceptance time.
* Confidence `"green"` indicates a known-work field with high reliability.
* Confidence `"yellow"` indicates an original-work or uncertain field requiring
  careful human review.
* `RED`-rated capabilities (source attribution, canonical approval) are not exposed
  via this endpoint.

---

### 3. Duplicate Check Integration

The duplicate check SHALL occur at Scope Field entry time — immediately after
the operator enters a canonical_name (or chapter_title for Scene) — before the
Copilot session is activated.

Sequence:

```text
1. Operator enters Scope Field value  (e.g., canonical_name = "Arya Stark")
2. System queries existing entities for the same work_id and entity type.
   ┌────────────────────┬─────────────────────────────────────────────────────┐
   │ Duplicate found    │ Copilot icon remains disabled.                       │
   │                    │ UI surfaces the conflict for Human Decision.          │
   │                    │ Operator must resolve before proceeding.             │
   ├────────────────────┼─────────────────────────────────────────────────────┤
   │ No duplicate       │ Scope established. Entity is Copilot Eligible.       │
   │                    │ Copilot icon becomes active.                         │
   └────────────────────┴─────────────────────────────────────────────────────┘
```

The check is the responsibility of the scope definition step.
It is NOT the responsibility of the suggestion endpoint or the CRUD persist path.

The Copilot icon SHALL NOT be enabled unless the Scope Field value has been
provided and has passed the duplicate check.

---

### 4. Provider Layer Reuse

The following components from the ADR-001 prototype are reused without modification:

```text
lib/ai/bootstrap-provider.ts       BootstrapProvider interface
lib/ai/openrouter-bootstrap-provider.ts
lib/ai/gemini-bootstrap-provider.ts
lib/ai/bootstrap-parser.ts
lib/prompts/bootstrap.ts           (prompt scope adjustment required — see §5)
```

The `generate()` method on the provider interface may be retained or renamed to
`suggest()`. The semantic distinction is:

```text
generate() → produces a full catalog for immediate persistence (Bootstrap — rejected)
suggest()  → produces a candidate set for human review (Copilot — this ADR)
```

---

### 5. Prompt Scope Adjustment

The Bootstrap prompt currently instructs the model to produce:

```text
5–8 characters, 3–5 locations, 8–12 scenes
```

as a complete catalog. This is the catalog-scope pattern rejected by Decision 8.

Under the Copilot workflow, the prompt scope SHALL be:

```text
For field-level suggestion:
  Given an entity type and optional existing field values,
  suggest values for the requested fields.

For entity candidate preview:
  Given a work title and description,
  produce a candidate list with suggestions for each entity.
  This list is for human review only. It is not persisted directly.
```

The candidate preview is permitted for display purposes only. It becomes the
catalog-scope-only violation when connected to a bulk accept path. That connection
is prohibited by Decision 8.

---

### 6. ADR-001 Archive Update

`docs/adr/001-assisted-work-bootstrap-pipeline.md` SHALL be updated:

```text
Status: Superseded
Superseded by: ADR-004 (Source of Canonical Truth)
Archive classification: Experimental Prototype
```

The content of ADR-001 is retained in full for historical reference. Only the
status header is updated.

---

### 7. Scope Definition Model

The Scope Definition Model specifies which fields establish the identity boundary
for a Copilot session and which fields are eligible for AI suggestion.

#### Scope Fields

A Scope Field is the single human-provided identifier that anchors a Copilot
session. No session may begin without a Scope Field value. The Copilot does not
generate, suggest, or modify Scope Fields under any circumstances.

```text
Entity Type   Scope Field      Examples
──────────────────────────────────────────────────────────────
Character     canonical_name   Jon Snow, Daenerys Targaryen
Location      canonical_name   King's Landing, The Wall
Scene         chapter_title    Chapter 1: The Prologue   [current Runtime Scene scope field]
```

#### Suggestible Fields

Suggestible Fields are non-Scope Fields that the Copilot may enrich once scope
is established. They are enrichment targets, not identity targets.

```text
Entity Type   Suggestible Fields
──────────────────────────────────────────────────────────────
Character     house, description, signature_quote, avatar_prompt
Location      region, description, image_prompt
Scene         summary, participants, scene_description
```

#### SD Rules

```text
SD-01   Human-Defined Scope.
        Every Copilot session requires a human-defined Scope Field value.
        A session may not generate suggestions until the Scope Field is present.

SD-02   Scope Fields Are Not Suggestible.
        Scope-defining fields are never generated by AI.
        They must always originate from human input.
        This applies regardless of entity type, work type, or confidence level.

SD-03   Suggestible Fields Are Enrichment Only.
        Copilot may only generate suggestions for non-Scope Fields.
        Suggestions are enrichment operations, not discovery operations.
        An enrichment suggestion that implicitly introduces a new entity name
        violates RT-INV-04 and is prohibited.
```

#### Explicit Prohibition

The following AI actions are prohibited under the Scope Definition Model and
may not be introduced by any future implementation:

```text
Generate Character canonical_name values
Generate Location canonical_name values
Generate Scene chapter_title values
Discover missing entities from AI knowledge
Expand the entity catalog beyond human-initiated additions
```

This prohibition is a corollary of the Foundational Principle (Human owns
Canonical Truth) and Decision 9. It applies at all layers — API, client state,
UI prompt construction, and provider configuration.

---

### 8. Suggestion Classification Model

#### Missing Fields Only

Classification and suggestion generation apply exclusively to fields that are
currently empty. A field that already contains a human-authored value is not a
candidate for suggestion, regardless of suggestion type.

```text
Example — Character entity with partial values:

  canonical_name = "Jon Snow"    ← human-authored — not a candidate
  house          = "Stark"       ← human-authored — not a candidate
  description    = (empty)       ← candidate — SC-02 pipeline
  signature_quote = (empty)      ← candidate — SC-02 pipeline

  Copilot generates suggestions for:  description, signature_quote
  Copilot does not touch:             canonical_name, house
```

This rule applies before classification. Fields are first filtered by emptiness,
then routed to SC-01 or SC-02. This reduces noise, review burden, and model cost.

---

All Copilot suggestions are produced by one of two pipelines. The pipeline
determines how the suggestion is retrieved and produced, what confidence label is
applied, and how the UI presents it to the operator.

#### SC-01 — Fact Suggestion Pipeline

```text
Human Scope (canonical_name established)
    ↓
Source Connector
─ selects the appropriate connector for the work type
─ connector examples: AWOIAF, Tolkien Gateway, Wikipedia, Local KB
    ↓
Source Search
─ queries Tier-1 / Tier-2 sources via the selected connector
─ Source First: retrieval MUST precede normalization when sources exist
    ↓
Retrieve Evidence
─ raw evidence extracted from source search results
─ may include unstructured text, infobox fields, or structured records
    ↓
Normalize Evidence
─ LLM may assist in normalizing unstructured evidence into structured form
─ LLM role: evidence normalizer, not fact generator
─ LLM knowledge alone does not constitute evidence
    ↓
Produce Candidate Fact
─ candidate value derived from normalized evidence only
─ confidence: "green" (Tier-1 source) or "yellow" (Tier-2 source)
    ↓
Displayed in UI with source reference (SV-01)
```

Applicable fields:

```text
house, region, faction, affiliation, parent, occupation
```

Source First requirement: If a Tier-1 or Tier-2 source is available and has not
been consulted via a Source Connector, the suggestion is non-conformant under SC-04.

#### SC-02 — Narrative Suggestion Pipeline

```text
Human Scope (canonical_name established)
    ↓
Evidence + Existing Accepted Data
─ accepted Canonical field values already in the form
─ optional: retrieved source context
    ↓
LLM Draft Generation
─ model produces a narrative draft grounded in the evidence
    ↓
Narrative Suggestion
─ presented as a draft, not a fact
─ confidence: always "yellow" unless source-grounded
    ↓
Human review mandatory before acceptance
```

Applicable fields:

```text
description, summary, signature_quote, avatar_prompt, scene_description
```

LLM generation is permitted. The suggestion is a typing-cost reduction tool,
not an authoritative answer. Human review and acceptance are always required.

#### SC-03 — Original Work Fallback

When no Tier-1 or Tier-2 source exists for the work (original, unpublished, or
source-sparse works), Fact Suggestion fields fall back to model knowledge:

```text
Human Scope
    ↓
LLM Suggestion (model knowledge only)
    ↓
Yellow Confidence (mandatory; not upgradeable to green)
```

This fallback is legal. The operator MUST see a Yellow confidence indicator.
The fallback does not apply to Scope Fields, which remain human-owned
unconditionally (SD-02).

#### SC-04 — Source First Principle

```text
When authoritative sources exist,
retrieval precedes normalization.
```

Normalization should enrich evidence. Normalization should not replace evidence.

This principle is binding at the provider layer. A `suggest()` implementation
that invokes LLM normalization before source retrieval for a Fact field is
non-conformant when Tier-1 or Tier-2 sources are available.

#### LLM Role in Fact Suggestions

```text
LLM is not a fact generator.

LLM may assist evidence normalization.
```

The LLM's function in the SC-01 pipeline is limited to normalizing evidence
retrieved from authoritative sources into a structured candidate value. It is
not authorized to originate facts from its training knowledge when sources exist.

This distinction is architecturally enforced by the Source Connector layer:
source retrieval happens first; LLM normalization happens after evidence is in
hand. Any provider implementation that inverts this order violates SC-04.

#### Source Connector Architecture

The Source Connector is an architectural slot that mediates between the Copilot
pipeline and external authoritative sources.

ADR-004 defines the slot. ADR-004 does not choose a connector implementation.
Connector selection and implementation are deferred to a future specification.

```text
Slot Definition:

  Source Connector
  ─ Input:  canonical_name + entity type + work context
  ─ Output: Evidence Bundle (structured or unstructured source content)
  ─ Contract: Source First — connector MUST be called before normalization

Connector Examples (illustrative, not exhaustive):
  AWOIAF Connector          — A Wiki of Ice and Fire
  Tolkien Gateway Connector — Tolkien Gateway
  Wikipedia Connector       — Wikipedia / Wikidata
  Local Knowledge Base      — operator-maintained reference files
```

Multiple connectors may be active for a single suggestion request. The Evidence
Bundle is the union of results from all consulted connectors, ordered by source
authority (Tier-1 before Tier-2, per ADR-D2-001).

ADR-004 imposes no requirements on connector transport, caching, or rate-limiting.
Those are implementation concerns scoped to the future connector specification.

#### Classification Summary

```text
Field Type          Pipeline     Source First   Confidence    LLM Permitted
──────────────────────────────────────────────────────────────────────────
house, region,      SC-01        Mandatory      green/yellow  Enrichment only
faction, etc.

description,        SC-02        Optional       yellow        Yes
summary, etc.

Any field,          SC-03        N/A (no        yellow        Yes (fallback)
original work       (fallback)   source)
```

---

### 9. Copilot Runtime Invariants

The following invariants govern all Copilot runtime behavior. They are binding
at all layers — API, client state, and UI. No implementation detail may
contradict them.

```text
RT-INV-01   Human defines scope.
            The operator selects the entity to work on. The Copilot does not
            propose which entity to create or edit next.

RT-INV-02   AI operates only within the defined scope.
            Once scope is set (current entity type + work context), the AI
            generates suggestions only for fields within that scope.

RT-INV-03   AI may not expand scope.
            The AI may not suggest creating additional entities, discovering
            related entities, or extending the session to adjacent records.

RT-INV-04   Entity discovery is prohibited.
            The Copilot does not propose which entities should exist. It assists
            with filling fields on an entity that a human has already decided to create.

RT-INV-05   Entity creation is human-owned.
            A new entity comes into existence only when a human initiates the
            create action. AI suggestions do not trigger entity creation.

RT-INV-06   Suggestions are entity-scoped.
            All suggestions generated in a session are associated with the
            current entity only. They are not transferable to another entity.

RT-INV-07   Switching entities clears all pending suggestion state.
            When the operator navigates away from the current entity, all
            unaccepted suggestions are discarded. They are not preserved or
            migrated.

RT-INV-08   Suggestions are generated only for currently empty fields.
            The Copilot targets fields that have no human-authored value.
            It does not propose values for fields that the human has already
            filled in.

RT-INV-09   Copilot never replaces existing human-authored values.
            If a field already contains a human-entered value, the Copilot
            does not overwrite it, shadow it, or suggest a replacement.
            The only exception is a human-initiated Regenerate action on a
            Narrative field (see Decision 3).

RT-INV-10   Accept applies immediately to the current form.
            When the operator accepts a suggestion, the value is written into
            the active form field immediately. The entity is persisted via the
            normal form-submit path; Accept does not itself trigger a DB write.

RT-INV-11   Retry requests are queued and executed in batch.
            When the operator requests a retry on one or more fields, the retry
            requests are collected into a queue. The queue is executed as a
            single batched generation call to minimise provider round-trips.

RT-INV-12   Accept All applies only to the current entity.
            The "Accept All" action accepts all pending suggestions for the
            current entity in one action. It does not apply across entities,
            across entity types, or across a Work.

RT-INV-13   Suggestion generation is triggered by the Copilot icon click.
            Clicking the Copilot icon simultaneously opens the Global Copilot
            Panel and initiates the suggestion check. Suggestion generation
            does NOT occur automatically upon entity selection, Scope Field
            entry, or any other implicit event. The Copilot icon click is the
            sole trigger. Automatic or background suggestion generation is
            prohibited.
```

---

### 10. Global Copilot Runtime Model

The following diagram describes the complete Copilot session lifecycle for a
single entity authoring session. The lifecycle has eight phases that correspond
directly to the canonical data flow (see Phase 1–Phase 8 below).

```text
═══════════════════════════════════════════════════════════════════════════════
Phase 1 — Scope Creation
═══════════════════════════════════════════════════════════════════════════════

    Operator enters Scope Field value in entity form
    (e.g., canonical_name = "Arya Stark")
            │
            ▼

═══════════════════════════════════════════════════════════════════════════════
Phase 2 — Identity Validation
═══════════════════════════════════════════════════════════════════════════════

    Duplicate Check
    ─ UNIQUE(work_id, canonical_name) per entity type
            │
            ├──────────────────────────┐
            ▼                          ▼
    Duplicate found              No duplicate
    ─ surface conflict           ─ Scope established
    ─ Copilot icon disabled      ─ Entity is Copilot Eligible
    ─ Human Decision required    ─ Copilot icon becomes active
            │
         (resolve)
            │
            ▼  (continues to Phase 3 after conflict resolved)

    NOTE: "Current Entity" at this point is an in-memory editing object only.
    It is NOT yet a database record.

═══════════════════════════════════════════════════════════════════════════════
Phase 3 — Suggestion Request (explicit manual trigger)
═══════════════════════════════════════════════════════════════════════════════

    Operator clicks Copilot icon
    ─ Panel opens AND suggestion check is initiated simultaneously
            │
            ▼
    Identify Empty Fields
    ─ fields that have no human-authored value are candidates for suggestion
    ─ fields with existing values are excluded before the request is sent
            │
            ▼
    POST /api/admin/ai/suggest
    ─ scoped to current entity + empty fields only

═══════════════════════════════════════════════════════════════════════════════
Phase 4 — Fact Pipeline (SC-01)
═══════════════════════════════════════════════════════════════════════════════

    canonical_name
            │
            ▼
    Source Connector
    ─ selects appropriate connector for work type
            │
            ▼
    Source Search
    ─ retrieval MUST precede normalization when Tier-1/Tier-2 sources exist
            │
            ▼
    Evidence Bundle
    ─ raw evidence from source results
            │
            ▼
    Evidence Normalization
    ─ LLM assists in structuring evidence; LLM is not a fact generator
            │
            ▼
    Candidate Facts → Fact Suggestions
    (e.g., house = Stark, region = The North)

═══════════════════════════════════════════════════════════════════════════════
Phase 5 — Narrative Pipeline (SC-02)
═══════════════════════════════════════════════════════════════════════════════

    Accepted Facts (from Phase 4) + Evidence Bundle
            │
            ▼
    LLM Draft Generation
            │
            ▼
    Narrative Suggestions
    (e.g., description, avatar_prompt, summary)

═══════════════════════════════════════════════════════════════════════════════
Phase 6 — Human Gate
═══════════════════════════════════════════════════════════════════════════════

    Global Copilot Panel displays:
    ┌─────────────────────────────────────────────────────────┐
    │ Fact Suggestions                                         │
    │  Suggested Value / Source list / Confidence             │
    │  [Accept] → back-fills form field                       │
    │  [Skip]   → no action                                   │
    │  Feedback input + [Add to Retry Queue]                  │
    ├─────────────────────────────────────────────────────────┤
    │ Narrative Suggestions  (same controls)                   │
    └─────────────────────────────────────────────────────────┘
            │
            ├──────────────────┬──────────────────┐
            ▼                  ▼                  ▼
          Accept             Skip               Retry Request
    ─ value written       ─ field remains     ─ added to
      to form field          empty               Retry Queue
            │                  │                  │
            ▼                  ▼                  ▼
    (form accumulates    (no change)         Retry Queue
     accepted values)                           │
                                                ▼
                                    [Batch Retry]
                                    ─ all queued fields sent
                                      in one generation call
                                            │
                                            ▼
                                    New suggestions displayed
                                    ─ same Accept/Skip/Retry cycle

    [Accept All] back-fills all visible suggestions to form fields.
    Accept All is scoped to the current entity only.

    ─────────────────────────────────────────────────────────
    When operator switches entity → ALL pending state is cleared (RT-INV-07)
    ─────────────────────────────────────────────────────────

═══════════════════════════════════════════════════════════════════════════════
Phase 7 — Persistence
═══════════════════════════════════════════════════════════════════════════════

    Operator submits form
            │
            ▼
    Existing CRUD runtime
    Immediate Persist (Runtime Truth v1)

═══════════════════════════════════════════════════════════════════════════════
Phase 8 — Runtime Truth
═══════════════════════════════════════════════════════════════════════════════

    Database Record
            │
            ▼
    Runtime Truth

    Source ≠ Runtime Truth
    ─ Source provides evidence for operator judgment.
    ─ Runtime Truth is the result of human acceptance and persistence.
    ─ No source, regardless of authority tier, constitutes Runtime Truth
      until the human has accepted and saved the value.
```

#### Session Scope Rules

* Copilot session scope = the currently active entity form.
* Switching entities destroys session state unconditionally (RT-INV-07).
* No cross-entity suggestion persistence exists or is planned for Runtime Truth v1.
* Session state is held entirely in client memory. No session data is written
  to the database prior to form submission.

---

### 11. Source Verification Model

When the Copilot presents a suggestion, it may optionally include one or more
sources that informed the suggestion value. The following principles govern how
sources are treated.

#### Source Definition

```text
Source  ≠  Truth

Source  =  Verification Evidence
```

A source is a reference that gives the operator a point of comparison for their
own judgment. It is not an endorsement of the suggestion, a pre-approval, or a
claim of correctness.

Source Authority does not override Human Acceptance. The authority tier of a
source describes the reliability of the reference, not the validity of the
suggestion it accompanies.

Consequently:

* An operator MAY reject a suggestion that is backed by a Tier-1 source.
* An operator MAY accept a suggestion that is backed only by a Tier-3 source.
* Human Acceptance is always the final authority, regardless of source tier.

This is not an edge case. It is the expected operating model.

#### Principles

```text
SV-01   Sources must be visible to operators.
        If a source informed a suggestion, it must be surfaced in the UI so
        the operator can evaluate it. Invisible sources are not permitted.

SV-02   Sources must be ordered by authority.
        When multiple sources exist, they are presented in descending authority
        order. Higher-authority sources appear first. Authority ordering follows
        ADR-D2-001 Tier classification where applicable.

SV-03   Sources exist to accelerate verification, not to replace it.
        The purpose of displaying a source is to allow the operator to verify
        the suggestion against a known reference. The presence of a source
        does not make the suggestion pre-approved.

SV-04   Sources do not replace human judgment.
        An operator may reject a suggestion even when a source is present.
        Source authority does not override operator discretion.

SV-05   Human approval remains the only persistence gate.
        Regardless of how many sources support a suggestion, or how high their
        authority, the suggestion is not persisted until the operator explicitly
        accepts it.
```

#### Out of Scope for This ADR

* UI layout for source display is not specified here. That is a Spec-level concern.
* Trust-score algorithms and automated source ranking are not specified here.
* Source attribution from AI model output is rated RED (EAR-007) and is not
  a supported source type. Sources in this model are external references
  surfaced by the system, not citations invented by the AI.

---

### 12. ADR-001 → ADR-004 Capability Migration Matrix

The following matrix documents the disposition of each capability introduced or
implied by ADR-001, under the ADR-004 Copilot architecture.

| ADR-001 Capability       | ADR-004 Status | Rationale                                                         |
|--------------------------|----------------|-------------------------------------------------------------------|
| Catalog Discovery        | **Rejected**   | Violates RT-INV-04 (entity discovery prohibited) and Decision 8   |
| Entity Discovery         | **Rejected**   | Violates RT-INV-04 and the Human-Owned Truth Principle            |
| Bulk Persistence         | **Rejected**   | Violates Decision 2 (human acceptance required per entity)        |
| clearExisting Deletion   | **Rejected**   | Catalog-level destructive operation with no acceptance gate        |
| Catalog-Level Acceptance | **Rejected**   | Violates Decision 8 (scope boundary)                              |
| Description Generation   | **Retained**   | Narrative field — AI generation is permitted (Decision 3)         |
| Quote Generation         | **Retained**   | Narrative field — AI generation is permitted (Decision 3)         |
| Avatar Suggestion        | **Retained**   | Narrative field — AI suggestion is permitted (Decision 6)         |
| Scene Summary Generation | **Retained**   | Narrative field — AI generation is permitted (Decision 3)         |
| Image Caption Generation | **Retained**   | Narrative field — AI generation is permitted (Decision 3)         |
| Provider Layer           | **Retained**   | Text generation backends are reusable; see How §4                 |
| Streaming Infrastructure | **Retained**   | SSE pattern is reusable for suggestion delivery                   |
| bootstrap-parser utils   | **Retained**   | JSON extraction and validation utilities have no semantic conflict |
| signatureQuote Schema    | **Retained**   | Valid schema extension independent of Bootstrap architecture       |
| Human Review             | **Mandatory**  | Was optional in ADR-001; is non-negotiable in ADR-004             |

---

### 13. Metadata-Driven Classification Runtime Model

This section formalises the separation of concerns established by Decision 11.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Architecture Layer  (ADR-004)                                         │
│                                                                        │
│  Defines classification types only:                                   │
│                                                                        │
│    Scope Field     — identity anchor; never AI-generated (SD-02)      │
│    Fact Field      — verifiable; SC-01 pipeline                       │
│    Narrative Field — generative draft; SC-02 pipeline                 │
│                                                                        │
│  Does NOT define which specific fields belong to each type.           │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ classification types only
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Schema Layer  (entity schema specifications)                          │
│                                                                        │
│  Defines per entity type:                                             │
│    ─ Field name                                                        │
│    ─ Classification:  scope | fact | narrative                        │
│    ─ Whether mandatory at entity creation time                        │
│                                                                        │
│  Example — Character:                                                 │
│    { canonical_name   scope      mandatory }                          │
│    { house            fact       optional  }                          │
│    { description      narrative  optional  }                          │
│    { avatar_prompt    narrative  optional  }                          │
│                                                                        │
│  This is the authoritative classification registry.                   │
│  ADR-004 field examples are illustrative, not registry entries.       │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ field metadata
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Copilot Runtime                                                        │
│                                                                        │
│  Reads classification metadata from schema layer.                     │
│  Routes each field:                                                   │
│    scope     → excluded from suggestions (SD-02)                     │
│    fact      → SC-01 pipeline                                         │
│    narrative → SC-02 pipeline                                         │
│                                                                        │
│  MUST NOT hard-code field names (MD-01).                              │
│  MUST NOT require code changes when new fields are added (MD-02).     │
│  MUST NOT require code changes when new entity types are added (MD-03)│
│    — provided classification metadata is supplied in both cases.      │
└──────────────────────────────────────────────────────────────────────┘
```

#### Extensibility Contract

Adding a new field or a new entity type is a schema-layer operation.
When classification metadata is provided, the Copilot runtime routes the
new field to the correct pipeline without any code change.

This contract is binding. Any Copilot implementation that hard-codes field
names or entity type names for pipeline routing violates MD-01 and is
non-conformant.

---

### 14. Current Entity Field Classification × Copilot Route

The following table applies Decision 12 (Field Classification) and Decision 13
(Copilot Routing) to the current known entity fields. This is illustrative only;
the schema specification is the authoritative registry.

```text
Entity      Field               Classification   Copilot Route
─────────────────────────────────────────────────────────────────────────
Character   canonical_name      Scope            Excluded
Character   house               Canonical        Fact Suggestion
Character   description         Narrative        Narrative Suggestion
Character   signature_quote     Narrative        Narrative Suggestion
Character   portraitUrl         Asset            Excluded (FC-03, non-overridable)

Location    canonical_name      Scope            Excluded
Location    region              Canonical        Fact Suggestion
Location    description         Narrative        Narrative Suggestion
Location    map_focus_x/y       Asset*           Excluded
             * coordinate pair — not text content; dedicated MapPicker tooling

Scene       chapter_title       Scope            Excluded    [current Runtime Scene scope field]
Scene       summary             Narrative        Narrative Suggestion
Scene       scene_description   Narrative        Narrative Suggestion
```

Fields omitted from this table (e.g., relational references such as
characterIds on Scene) are candidates for Reference Suggestion routing in a
future schema specification, subject to RS-01 through RS-04.

---

## Alternatives Considered

### Alternative A — Accept Bootstrap Prototype with Human Review Step

Add a review screen after the Bootstrap generation, allowing humans to approve
or reject each generated entity before persistence.

**Rejected.**

Reason: A catalog-scope approval step is structurally equivalent to "Accept All"
under a different label. It does not change the fundamental problem: the operator
cannot meaningfully review 5–8 characters, 3–5 locations, and 8–12 scenes at
production quality in a single review pass. The review step becomes a
rubber-stamp, not a genuine quality gate. Decision 8 draws the boundary at
entity scope, not catalog scope.

---

### Alternative B — Keep Bootstrap, Add Source Attribution

Use external sources (ADR-D2-001 Tier 1 / Tier 2) to validate Bootstrap output,
rejecting low-confidence entities.

**Rejected for this ADR's scope.**

Reason: Source attribution is rated RED in the EAR-007 capability classification.
AI models fabricate citation sources at non-trivial rates. Building a validation
pipeline on top of an unreliable attribution layer compounds the quality problem.
Source extraction (ADR-D2-001) is an independent, parallel effort and does not
serve as a validation mechanism for Bootstrap-style generation.

---

### Alternative C — No AI Assistance, Manual Entry Only

Remove all AI involvement. Rely entirely on manual admin data entry.

**Rejected.**

Reason: AI is capable and reliable for Narrative field generation (EAR-007 GREEN
and YELLOW capabilities). Removing AI assistance entirely discards genuine
productivity value that does not pose Runtime Truth risk. The Copilot workflow
preserves AI assistance while enforcing the Human Owns Truth boundary.

---

## Trade-offs

### Benefits

* Runtime Truth v1 pollution risk is structurally eliminated at the architecture
  level, not merely mitigated by process.
* AI productivity value is preserved for Narrative fields and entity candidate
  preview.
* No new DB schema is required to implement the Copilot workflow.
* No draft-state infrastructure is required. Client-side state holds unaccepted
  suggestions. The database only receives human-accepted data via the existing
  CRUD runtime.
* Provider layer from ADR-001 prototype is fully reusable, preserving prior
  engineering investment.
* `signatureQuote` schema extension from ADR-001 Phase 1 is retained.

### Costs

* Initial entity population is slower than the Bootstrap model. Human review
  per entity is a required step.
* Duplicate detection requires a pre-acceptance check that does not currently
  exist in the Admin UI.
* `BootstrapPanel` and the Bootstrap route require refactoring before the
  Copilot workflow is production-ready.
* Prompt adjustments are required to scope generation to field- or entity-level
  rather than catalog-level.

---

## Validation

### Invariants

```text
A.
AI-generated content that has not received explicit human acceptance
SHALL NOT exist in the database.

B.
No API endpoint SHALL accept a request that persists
a full AI-generated catalog without per-entity human acceptance.

C.
The clearExisting bulk deletion parameter SHALL NOT exist
in any production API endpoint.

D.
Canonical fields (name, house, region) SHALL only be set
via human-initiated write operations.

E.
Narrative fields (description, signatureQuote, summary, imageCaption)
may be AI-suggested and human-accepted via the Copilot workflow.

F.
UNIQUE(work_id, canonical_name) per entity type SHALL be enforced
before any entity is persisted.

G.
ADR-001 SHALL be archived as Experimental Prototype
and its Status SHALL be updated to Superseded.

H.
Copilot session state SHALL be scoped to the current entity only.
Switching entities SHALL destroy all pending suggestion state (RT-INV-07).

I.
Copilot suggestions SHALL only target empty fields (RT-INV-08).
Existing human-authored field values are not candidates for AI overwrite.

J.
The Copilot SHALL NOT initiate entity discovery or propose new entity creation
(RT-INV-03, RT-INV-04).

K.
A Copilot session SHALL NOT generate suggestions until a human-provided Scope
Field value is present (SD-01).

L.
Scope Fields (canonical_name for Character/Location; chapter_title for current
Runtime Scene) SHALL NEVER be generated, suggested, or modified by AI (SD-02).

M.
AI suggestions SHALL be confined to Suggestible Fields only.
No suggestion may target a Scope Field, regardless of field emptiness (SD-03).

N.
Fact Suggestion fields (house, region, faction, affiliation, parent, occupation)
SHALL use the SC-01 pipeline. Source retrieval MUST precede generation when
Tier-1 or Tier-2 sources are available (SC-01, SC-04).

O.
Narrative Suggestion fields (description, summary, signature_quote, avatar_prompt,
scene_description) SHALL use the SC-02 pipeline. LLM generation is permitted.
Human review remains mandatory (SC-02).

P.
When no authoritative source exists for a work, Fact Suggestion fields SHALL
fall back to SC-03 (LLM + Yellow confidence). Yellow confidence is mandatory
and non-upgradeable under SC-03 (SC-03).

Q.
A Fact Suggestion produced solely from model knowledge when Tier-1 or Tier-2
sources are available is non-conformant and SHALL NOT be delivered (SC-04).

R.
Fact Suggestions and Narrative Suggestions SHALL be visually distinguishable
in the Admin UI. An operator must be able to determine the suggestion type
from the UI presentation without reading metadata (SC-01, SC-02).

S.
The Copilot icon SHALL remain disabled until the Scope Field value has been
entered AND has passed the duplicate check. Both conditions are required
before the Copilot session may be activated (Decision 5, How §3).

T.
The duplicate check SHALL occur at Scope Field entry time, before Copilot
session activation. It is NOT the responsibility of the CRUD persist path
(Decision 5, How §3).

U.
Suggestion generation SHALL NOT occur automatically upon entity selection,
Scope Field entry, or any other implicit event. The Copilot icon click is
the sole trigger: it opens the Panel and initiates the suggestion check
simultaneously. No separate trigger action exists (RT-INV-13).

V.
The Copilot runtime SHALL NOT contain hard-coded field name lists for
classification routing. Field classification MUST be supplied by schema
layer metadata. Any implementation that hard-codes field names for pipeline
routing is non-conformant (MD-01, Decision 11).

W.
Adding a new field to an existing entity type, or adding a new entity type,
SHALL NOT require changes to Copilot runtime code when classification metadata
is provided. Schema-layer changes are sufficient (MD-02, MD-03, Decision 11).

X.
Field classification and Copilot routing are independent architectural concerns.
A field's classification type SHALL NOT implicitly determine its Copilot route.
Routing MUST be defined explicitly via schema layer metadata and governed by
Decision 13 (FC-02, Decision 12, Decision 13).

Y.
Asset fields SHALL be excluded from all Copilot suggestion pipelines.
Asset fields MUST NOT appear in any suggestion request, response, or panel
display. This exclusion is non-overridable and cannot be overridden by schema
metadata (FC-03, Decision 12).

Z.
Reference Suggestion SHALL only resolve existing entities. It MUST NOT propose
entity creation, discover new canonical names, or introduce any entity that
does not already exist in the system (RS-01, RS-02, RS-03, Decision 13).

AA.
Discovery workflows (Catalog Discovery, Character Discovery, Location Discovery,
Scene Candidate Generation) are outside ADR-004 authority. Any implementation
that introduces Discovery capabilities under ADR-004 framing is non-conformant.
Discovery requires ADR-006 governance (RS-04, Decision 13, Follow-up §ADR-006).
```

### Acceptance Criteria

```text
AC-01:  Suggestion endpoint returns candidates. It does not persist.
AC-02:  Human acceptance triggers existing CRUD runtime.
AC-03:  No bulk accept / catalog accept path exists in the Admin UI.
AC-04:  clearExisting is removed from all API endpoints and UI components.
AC-05:  ADR-001 status is updated to Superseded.
AC-06:  Duplicate check occurs before entity creation.
AC-07:  Confidence rating is surfaced to the human operator for YELLOW fields.
AC-08:  Navigating away from an entity clears all pending suggestion state (RT-INV-07).
AC-09:  AI does not suggest values for fields that already contain human-authored content (RT-INV-08, RT-INV-09).
AC-10:  Retry requests are batched into a single generation call (RT-INV-11).
AC-11:  Accept All is scoped to the current entity only; no cross-entity acceptance path exists (RT-INV-12).
AC-12:  Sources displayed to the operator are drawn from external references, not from AI-invented citations.
AC-13:  The Copilot suggestion UI does not activate until the operator has entered a Scope Field value (SD-01).
AC-14:  The suggestion endpoint rejects requests that do not include a Scope Field value (SD-01).
AC-15:  Scope Fields (canonical_name for Character/Location; chapter_title for current Runtime Scene) do not appear in the suggestion response payload (SD-02).
AC-16:  No provider prompt construction includes an instruction to generate a Scope Field value (SD-02, SD-03).
AC-17:  Fact Suggestion fields and Narrative Suggestion fields are classified in the suggestion response payload (SC-01, SC-02).
AC-18:  Fact Suggestion pipeline performs source retrieval before LLM generation when Tier-1 or Tier-2 sources exist (SC-01, SC-04).
AC-19:  A Fact Suggestion derived solely from model knowledge when authoritative sources exist is rejected at the provider layer (SC-04, Q).
AC-20:  Original Work fallback suggestions carry Yellow confidence; Green confidence is not assignable under SC-03 (SC-03, P).
AC-21:  The Admin UI presents Fact Suggestions and Narrative Suggestions with distinct visual treatment (SC-01, SC-02, R).
AC-22:  The suggestion request payload contains only empty fields. Fields with existing human-authored values are excluded before the request is sent (RT-INV-08, Missing Fields Only).
AC-23:  The Copilot icon is disabled until the Scope Field value has been entered AND has passed the duplicate check. Neither condition alone is sufficient to enable the icon (S, Decision 5).
AC-24:  The duplicate check is performed at Scope Field entry time. It is not deferred to CRUD persist time. The Copilot icon does not activate if the duplicate check has not been completed (T, How §3).
AC-25:  Suggestion generation does not begin automatically. The Copilot icon click is the sole trigger: clicking it opens the Panel and initiates the suggestion check in a single action. No separate trigger button exists. No implicit event (entity selection, Scope Field entry) initiates suggestion generation (U, RT-INV-13).
AC-26:  The Copilot suggestion endpoint determines pipeline routing from schema layer classification metadata. No field name is hard-coded in the Copilot runtime for routing purposes (V, MD-01, Decision 11).
AC-27:  A new field added to an entity type schema with valid classification metadata is routed to the correct pipeline without any Copilot runtime code change. A new entity type with complete field metadata is handled by the Copilot runtime without any code change (W, MD-02, MD-03, Decision 11).
AC-28:  Field classification type and Copilot route are stored as separate, independent metadata values in the schema layer. No classification type automatically implies a Copilot route (X, FC-02, Decision 12, Decision 13).
AC-29:  Asset fields are absent from all Copilot suggestion requests, suggestion responses, and Copilot Panel displays. No schema metadata override can make an Asset field appear in a Copilot suggestion (Y, FC-03, Decision 12).
AC-30:  Reference Suggestion, when implemented, accepts result in writing an existing entity reference only. No entity creation is triggered. No canonical name for a non-existing entity is proposed (Z, RS-01 through RS-03, Decision 13).
AC-31:  No Discovery-scope capability (Catalog Discovery, Character Discovery, Location Discovery, Scene Candidate Generation) is implemented, exposed, or reachable under the ADR-004 Copilot architecture. Discovery requires ADR-006 governance before implementation (AA, RS-04, Decision 13).
```

---

## Dependencies

ADR-004 does not define entity schemas.

This ADR defines how suggestions are produced, classified, and accepted. It does
not specify which fields exist on any entity type. Field definitions are an
implementation concern deferred to future specifications.

The following schemas are required by the Copilot workflow but are not defined here:

```text
Character schema    — canonical_name, house, description, signature_quote,
                      avatar_prompt, and any additional fields
Location schema     — canonical_name, region, description, image_prompt,
                      and any additional fields
Scene schema        — chapter_title, summary, participants, scene_description,
                      and any additional fields
```

Future specifications MUST:

* Define the complete field list for each entity type.
* Classify each field using the four-type taxonomy defined in Decision 12:
  scope | canonical | narrative | asset. This classification is the
  authoritative registry required by Decision 11 (MD-01 through MD-04)
  and Decision 13 (route mapping).
* Identify which fields are mandatory at entity creation time.
* Publish classification metadata in a form consumable by the Copilot runtime,
  so that pipeline routing is driven by metadata, not hard-coded field names.

Until those specifications exist, the field examples used in ADR-004 are
illustrative only. They do not constitute a schema contract or a classification
registry. The Copilot runtime MUST treat them as illustrative only (MD-01).

---

## §15. Known Constraint — Runtime Truth v1 Scope Boundary

ADR-004 intentionally targets current Runtime Truth v1.

The Copilot workflow, field classification model, suggestion pipelines
(SC-01, SC-02, SC-03, SC-04), and runtime invariants (RT-INV-01 through
RT-INV-13) defined in this ADR are scoped to the Work → Scene → Story Images
topology described in the Runtime Truth v1 Topology section of **What** above.

The following are explicitly outside ADR-004 scope:

```text
Editorial Narrative Information Model (Story definition and boundaries)
Runtime mapping of editorial Story units to runtime representation
Migration strategy for existing runtime schemas
Redesign of the reading flow or routing layer
Discovery Copilot runtime implementation
```

The editorial Narrative Information Model is governed by **ADR-005 — Narrative
Information Model** (Status: Accepted; v1.1). ADR-005 publishes the **Canonical
Definition** and **Glossary** of Story, governs the **Editorial Domain**
(independent of the **Runtime Domain**), and defines boundary principles and
information-emergence **dependency order**. It does not modify Runtime Truth v1.

Mapping Editorial Domain Story units into Runtime Domain representation is
**deferred** to a future Rollout ADR. Until that Rollout ADR is Accepted and
implemented, the Runtime Truth v1 topology in **What** above remains authoritative.

Discovery architecture requires a dedicated ADR (ADR-006 — Discovery Copilot
Architecture). ADR-006 depends on the **Editorial Domain** entity topology frozen
by ADR-005. ADR-005 is Accepted; the ADR-006 gate is satisfied at the editorial
layer. Cross-domain mapping remains a separate deferred concern.

---

## Follow-up Roadmap

The ADR dependency chain is:

```text
ADR-004 — Metadata-Driven Copilot (this ADR)
    ↓
ADR-005 — Narrative Information Model (Accepted)
    ↓
ADR-006 — Discovery Copilot Architecture
    ↓
[Future Rollout ADR — Editorial Domain Story ↔ Runtime Domain mapping]
```

Discovery architecture (ADR-006) depends on the **Editorial Domain** topology
 frozen by ADR-005. ADR-005 is **Accepted** (v1.1); the editorial-layer gate for
 ADR-006 is satisfied. Cross-domain mapping of Story units into Runtime Truth v1
 remains **deferred** to a future Rollout ADR and is not a prerequisite for ADR-006
 specification at the Discovery layer.

---

### ADR-005 — Narrative Information Model (Accepted)

**Status:** Accepted (v1.1) — see [`docs/adr/005-narrative-information-model.md`](005-narrative-information-model.md)

**Summary:** Canonical Story definition and shared Glossary; **Editorial Domain**
 / **Runtime Domain** separation; Story boundary principles (ONE Rule); information
 emergence **dependency order** (not strict workflow); runtime mapping deferred.

**Frozen by ADR-005:**

```text
Canonical Definition of Story (system-wide reference)
Glossary (Story, Story Arc, Chapter, Mental Model Transition, Narrative Closure,
  Knowledge Artifact, Editorial Domain, Runtime Domain, ONE Rule)
Story ≠ Chapter; Story Arc ≠ Story
Story boundaries by Narrative Closure and the ONE Rule
Narrative precedes Knowledge (Information Emergence dependency order)
Multi-pass Editorial Domain philosophy
Editorial Domain independent of Runtime Domain (NIM-INV-01…05)
```

**Deferred by ADR-005 (not in ADR-005 scope):**

```text
Editorial Domain Story ↔ Runtime Domain Scene mapping
Relationship delta persistence
Story Arc visibility in the Runtime Domain
Knowledge Graph integration
Schema, API, UI, migration, AI implementation
```

ADR-005 does not modify Runtime Truth v1 (Runtime Domain). ADR-004 remains
 authoritative for Copilot routing and Human Acceptance regardless of ADR-005.

**Constraints inherited from ADR-004 (unchanged):**

ADR-005 MUST maintain the Human Acceptance Gate (Decision 2).
ADR-005 MUST NOT weaken the Human Owns Canonical Truth principle (Decision 1).

---

### ADR-006 — Discovery Copilot Architecture

ADR-006 inherits the Discovery intent originally referenced by ADR-004.

**Discovery capabilities outside ADR-004 authority:**

```text
Character Discovery
Location Discovery
Story Discovery
Scene Candidate Generation
Candidate Review workflows
Human Acceptance workflows for discovered entities
```

These capabilities differ architecturally from the ADR-004 Copilot suggestion
model. Discovery involves proposing which entities should exist. The ADR-004
Copilot model assists with enriching an entity the operator has already decided
to create. This is the boundary drawn by RT-INV-04 (Entity Discovery Prohibited).

**ADR-006 depends on ADR-005 (editorial topology).**

ADR-005 is Accepted. ADR-006 **may proceed** at the architectural specification
 layer. ADR-006 operates against the **Editorial Domain Story model** (Canonical
 Definition and Glossary in ADR-005). Cross-domain mapping remains deferred to a
 future Rollout ADR.

**ADR-006 MUST preserve:**

```text
Human Acceptance Gate            (ADR-004 Decision 2)
Human Owns Canonical Truth       (ADR-004 Decision 1)
RT-INV-04 Discovery Boundary
NIM-INV-05                       (ADR-005 — human acceptance final for Stories)
```

```text
Discovery Workflow (intent; ADR-006 will formalise):

  Human-provided content (chapter or story)
       ↓
  AI-generated entity candidates
  (characters, locations, or scenes derived from content)
       ↓
  Human Review
  (operator accepts, edits, or discards each candidate)
       ↓
  Candidate Acceptance → Entity Creation → CRUD → Runtime Truth
```

Any implementation that introduces Discovery capabilities under ADR-004 framing
 alone is non-conformant and requires ADR-006 governance first. Discovery MUST
 NOT bypass ADR-005 editorial boundary principles when proposing Story candidates.

---

## Refs

### Evidence Chain

```text
EAR-004     Copilot Authoring Workflow Feasibility Audit
EAR-D2-013  Scene-level recall evaluation
EAR-D2-014  Bootstrap prompt constraint analysis
EAR-D2-015  LLM knowledge ceiling audit
EAR-D2-001 → EAR-D2-009b  ADR-001 prototype evidence chain (retained)
```

### Governance

```text
Constitution.md                     Reader principles; capability roadmap
governance/FOUNDATION.md            Runtime Supremacy Law
governance/ADR_RULES.md             ADR lifecycle law
governance/specs/AUTHORITY_BOUNDARY_AND_PRECEDENCE_SPEC.md
```

### Related ADRs

```text
ADR-001     Assisted Work Bootstrap Pipeline (Superseded — Experimental Prototype)
ADR-D2-001  Canonical Metadata Authority (Tier 1 / Tier 2 / Tier 3 architecture)
ADR-005     Narrative Information Model (Accepted v1.1 — Canonical Definition, Glossary, Editorial Domain)
```
