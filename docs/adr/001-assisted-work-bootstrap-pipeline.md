# ADR-001 — Assisted Work Bootstrap Pipeline

**Status:** Superseded
**Superseded by:** ADR-004 — Source of Canonical Truth
**Archive Classification:** Experimental Prototype
**Type:** Architecture ADR
**Version:** 1.1
**Last Updated:** 2026-06-01
**Archived:** 2026-06-06
**Owner:** Architect

---

## What

This ADR establishes the architecture for the D2 Assisted Work Bootstrap Pipeline.

The pipeline enables administrators to create an initial narrative foundation for a Work using AI-generated content derived solely from existing Work metadata.

The bootstrap process creates:

* Characters
* Locations
* Scenes
* Scene image captions (`story_images_v2[].caption`)

The bootstrap process does **not** generate:

* Character portraits
* Scene images
* Draft entities
* Review queues
* Pending states

Generated entities are persisted immediately using the existing CRUD runtime.

---

## Why

The current admin workflow requires manual creation of:

* Character entities
* Location entities
* Scene entities
* Initial scene image descriptions

This creates a content-production bottleneck and slows D2 pipeline adoption.

EAR-D2-001 through EAR-D2-009b established the following runtime truths:

1. Existing CRUD infrastructure already supports direct entity creation.
2. Existing runtime philosophy is Immediate Persist.
3. No draft-state architecture exists.
4. No review-queue architecture exists.
5. Existing entity contracts are sufficient for bootstrap creation.
6. Bootstrap can be introduced without modifying retrieval, evaluation, or assistant runtimes.

The objective is:

```text
Reduce initial content-authoring cost
without introducing new lifecycle states.
```

---

## Decision

The system SHALL implement Bootstrap as:

```text
Work Metadata
        ↓
Bootstrap Provider
        ↓
Characters
Locations
Scenes
Story Image Captions
        ↓
Immediate Persistence
        ↓
Human Review via Existing Admin Screens
```

The bootstrap pipeline SHALL:

* Create production entities immediately.
* Reuse existing entity schemas.
* Avoid introduction of draft states.
* Avoid introduction of approval workflows.
* Avoid introduction of review queues.

---

## How

### 1. Input Boundary

Bootstrap SHALL use only existing Work metadata.

Current Work contract:

```typescript
type Work = {
  title: string;
  description: string;
}
```

No external source material is introduced.

No manuscript upload is introduced.

No document ingestion workflow is introduced.

---

### 2. Entity Contracts

#### Characters

Bootstrap creates:

```typescript
{
  name: string;
  house: string;
  description: string;
  signatureQuote: string | null;
  portraitUrl: "";
}
```

Runtime verification:

```text
lib/characters.create()
accepts portraitUrl = ""
```

Portrait generation is out of scope.

---

#### Locations

Bootstrap creates:

```typescript
{
  name: string;
  region: string;
  description: string;
}
```

Map coordinates remain unset.

---

#### Scenes

Bootstrap creates:

```typescript
{
  title: string;
  chapter_number: number;
  chapter_title: string | null;
  summary: string;
  locationId: string;
  characterIds: string[];
}
```

All fields conform to existing runtime contracts.

---

#### Story Images

Bootstrap creates:

```typescript
story_images_v2: [
  {
    caption: string;
    url: "";
  }
]
```

Runtime verification:

```text
createScene()
accepts url = ""

parseStoryImagesV2()
accepts url = ""

buildRagText()
reads caption regardless of url
```

No additional schema is introduced.

No draft image structure is introduced.

---

### 3. StoryImage Lifecycle

Bootstrap lifecycle:

```text
Bootstrap
    ↓
caption generated
url = ""
    ↓
Persist Scene
    ↓
Human Review
    ↓
Future Image Generation
    ↓
updateScene()
    ↓
Runtime Visible
```

#### Known Runtime Constraint

EAR-D2-005 and EAR-D2-006 confirmed:

```text
SceneForm zod:

story_images_v2[N].url
  = z.string().min(1)
```

Consequences:

```text
Scene opens normally
Caption is visible
Caption is editable

BUT

Scene cannot be saved
while url remains ""
```

Therefore:

```text
Human Review is currently view/edit capable,
but not save-capable,
until a valid image URL exists.
```

This is a known runtime limitation and not a Bootstrap-specific behavior.

No workaround is introduced by this ADR.

---

### 4. Provider Architecture

Bootstrap generation SHALL use a dedicated text-generation provider.

Provider selection:

```text
Bootstrap Text Generation
    ↓
OpenRouter Free Model Tier
```

Rationale:

```text
Avoid coupling bootstrap completion
to Gemini quota availability.
```

The following are explicitly separated:

```text
Bootstrap Text Generation
≠ Character Portrait Generation

Bootstrap Text Generation
≠ Scene Image Generation

Bootstrap Text Generation
≠ RAG Embedding
```

Existing Gemini-based systems remain unchanged.

---

### 5. Failure Model

Bootstrap execution is non-transactional.

Current runtime provides:

```text
No DB transaction
No rollback
No resume
No retry queue
```

Failure example:

```text
Characters created
Locations created
Scenes partially created
Provider failure occurs
```

Result:

```text
Partial data remains persisted.
```

Recovery path:

```text
Manual Cleanup
        ↓
Delete generated entities
        ↓
Re-run Bootstrap
```

This matches current runtime behavior.

---

### 6. Execution Topology

Execution order:

```text
Characters
      ╲
       ╲
        → Scenes
       ╱
      ╱
Locations
```

Rules:

```text
Characters and Locations
may execute in parallel.

Scenes execute only after both complete.
```

This preserves scene relationship integrity.

---

### 7. Signature Quote Introduction

Bootstrap introduces:

```typescript
signatureQuote: string | null
```

Required modifications:

#### Admin Repository

* Character type
* Character row mapping
* Insert mapping
* Update mapping
* Character form
* Database schema

#### Web Repository

* Character type
* Data mapping
* Character presentation layer

Cross-repository implementation is required.

---

### 8. Explicit Non-Goals

#### Character Portrait Generation

```text
Out of Scope
```

#### Scene Image Generation

```text
Out of Scope
```

#### Draft States

```text
Out of Scope
```

#### Review Queues

```text
Out of Scope
```

#### Approval Workflow

```text
Out of Scope
```

#### Transactional Rollback

```text
Out of Scope
```

#### Resume / Retry Framework

```text
Out of Scope
```

---

## Alternatives Considered

### Alternative A — Draft Pipeline

```text
Generate
    ↓
Draft
    ↓
Review
    ↓
Persist
```

Rejected.

Reason:

Current runtime contains:

* No draft schema
* No draft UI
* No draft APIs
* No review queues

Large architectural expansion with no runtime foundation.

---

### Alternative B — Gemini Bootstrap

```text
Bootstrap
    ↓
Gemini
```

Rejected.

Reason:

Quota exhaustion can terminate bootstrap execution mid-process.

OpenRouter free-tier routing provides better operational flexibility for non-critical generation workloads.

---

### Alternative C — Image Generation During Bootstrap

```text
Bootstrap
    ↓
Generate Images
```

Rejected.

Reason:

Greatly increases runtime duration, cost, failure surface, and quota dependency.

---

## Trade-offs

### Benefits

* Minimal schema expansion
* Maximum reuse of existing CRUD runtime
* Fast implementation path
* Consistent with Immediate Persist philosophy
* Human review remains possible through existing screens

### Costs

* Partial persistence remains possible
* No rollback support
* No resume support
* No retry support
* SceneForm save limitation remains unresolved
* Generated quality depends entirely on provider reasoning

---

## Validation

Executed Commands:

```bash
# No automated validation commands defined for this ADR.
```

Runtime evidence:

```text
EAR-D2-001
EAR-D2-002
EAR-D2-003
EAR-D2-004
EAR-D2-005
EAR-D2-006
EAR-D2-007
EAR-D2-008
EAR-D2-009
EAR-D2-009b
```

Invariant checks:

```text
A.
Bootstrap creates only existing entity types.

B.
No draft-state introduction.

C.
No review-state introduction.

D.
story_images_v2 uses existing schema.

E.
Bootstrap provider remains isolated
from RAG embedding provider.

F.
Bootstrap SHALL NOT modify:
   - Retrieval runtime
   - Scene Assistant runtime
   - Evaluation runtime
   - Oracle validation runtime

G.
Bootstrap failure cannot corrupt
existing runtime retrieval paths.
```

---

## Refs

Governance:

```text
governance/FOUNDATION.md
governance/ADR_RULES.md
governance/specs/AUTHORITY_BOUNDARY_AND_PRECEDENCE_SPEC.md
```

Runtime Evidence:

```text
EAR-D2-001 → EAR-D2-009b
```
