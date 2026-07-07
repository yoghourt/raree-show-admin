# SPEC-D2-001

**Title:** AI-Assisted Work Bootstrap Pipeline
**Status:** Ready for Implementation
**Version:** 1.1
**Owner:** Architect
**Last Updated:** 2026-06-01

> **Vocabulary Notice (ADR-BP-RT-001):** This document was authored before the Runtime Vocabulary Migration.
> Throughout this document, "Scene" is an implementation symbol for the normative term **Reading Route**,
> and "Story Images" / `story_images_v2` refers to the normative concept **Reading Frame**.
> The normative Runtime vocabulary is defined in `governance/vocabulary/runtime-lexicon.md`.
> No content, contracts, or topology in this document has changed; only vocabulary names differ.

---

## Purpose

Define the implementation contract for a Work-level AI Bootstrap pipeline capable of generating an initial narrative dataset from existing Work metadata.

The objective is to accelerate D2 content production while preserving Runtime Truth v1 and existing Raree Show operational constraints.

This specification governs:

```text
Work
 ├─ Characters
 ├─ Locations
 └─ Scenes
```

generation only.

This specification does not govern:

```text
Portrait Generation
Scene Image Generation
RAG Embedding
Evaluation Runtime
Reader Runtime
```

---

## Runtime Scope

### Included

Bootstrap MAY generate:

```typescript
Character
Location
Scene
```

using only:

```typescript
Work.title
Work.description
```

as source material.

---

### Excluded

Bootstrap MUST NOT generate:

```typescript
Character.portraitUrl
Scene.story_images_v2[].url

Location.map_focus_x
Location.map_focus_y

rag_embedding
evaluation artifacts
```

These remain downstream responsibilities.

---

## Input Contract

### Source

```typescript
type BootstrapInput = {
  workId: string;
};
```

Runtime lookup:

```typescript
type Work = {
  title: string;
  description: string;
};
```

---

### Hard Constraint

Bootstrap MUST NOT introduce any additional user input fields.

Forbidden:

```text
Story Synopsis Textarea
Character Prompt
Location Prompt
Scene Prompt
Custom Seed Input
File Upload
```

Generation authority is:

```text
Work.title
+
Work.description
```

only.

---

## Output Contract

### Character

```typescript
{
  tsid: string;

  name: string;

  house: string;

  description: string;

  signatureQuote: string | null;

  portraitUrl: "";
}
```

#### Bootstrap Rule

If the provider cannot determine a house:

```typescript
house: ""
```

MUST be used.

`null` is not permitted.

---

### Location

```typescript
{
  tsid: string;

  name: string;

  region: string;

  description: string;

  map_focus_x: null;
  map_focus_y: null;
}
```

#### Bootstrap Rule

If the provider cannot determine a region:

```typescript
region: ""
```

MUST be used.

`null` is not permitted.

---

### Scene

```typescript
{
  tsid: string;

  title: string;

  chapter_number: number;

  chapter_title: string | null;

  summary: string;

  locationId: string;

  characterIds: string[];

  story_images_v2: [
    {
      url: "";
      caption: string;
    }
  ];
}
```

---

## API Contract

### Endpoint

```http
POST /api/admin/ai/bootstrap
```

---

### Request

```typescript
{
  workId: string;
}
```

---

### Response

```typescript
type BootstrapResult = {
  charactersCreated: number;
  locationsCreated: number;
  scenesCreated: number;

  success: boolean;

  errors: {
    phase: string;
    message: string;
  }[];
};
```

---

## Entity Creation Algorithm

### Phase 1 — Load Work

Read:

```text
title
description
```

from the target Work.

---

### Phase 2 — Generate Bootstrap Payload

Provider output MUST contain:

```text
Characters
Locations
Scenes
```

within a single structured generation response.

---

### Phase 3 — Persist Characters

```text
Create Character records
Capture TSID mapping
```

---

### Phase 4 — Persist Locations

```text
Create Location records
Capture TSID mapping
```

---

### Phase 5 — Persist Scenes

Resolve:

```text
characterIds
locationId
```

using server-generated TSID mappings.

Create Scene records.

---

### Ordering Constraint

Allowed topology:

```text
Characters
      ╲
       ╲
        → Scenes
       ╱
Locations
```

Therefore:

```text
Characters and Locations MAY execute in parallel.

Scenes MUST execute after both complete.
```

---

### Location Resolution Rule

Every generated Scene MUST reference an existing generated Location.

Bootstrap MUST NOT create a Scene without a resolved Location reference.

Forbidden:

```typescript
locationId: null
```

If a generated Scene cannot be matched to a generated Location:

```text
Skip Scene
Record Error
Continue Execution
```

is the required behavior.

---

## TSID Generation Rules

Bootstrap-generated entities MUST use standard runtime identifier generation.

Provider-generated identifiers are never authoritative.

---

### Character

```text
char_<generated>
```

---

### Location

```text
loc_<generated>
```

---

### Scene

```text
scene_<generated>
```

---

### Constraint

The server owns identifier creation.

The provider MUST NOT supply authoritative TSIDs.

---

## Failure Semantics

### Transaction Model

Runtime Truth:

```text
No Transaction
No Rollback
```

Bootstrap MUST follow existing repository behavior.

---

### Allowed Outcome

```text
20 Characters created
10 Locations created
15 Scenes created

Scene 16 fails

→ Partial persistence remains
```

This is valid runtime behavior.

---

### Recovery Strategy

Official recovery mode:

```text
Manual Cleanup
```

Operator workflow:

```text
Delete generated entities

Re-run Bootstrap
```

---

### Explicitly Rejected

```text
Automatic Rollback
Retry Queue
Resume Execution
Checkpoint Recovery
```

These mechanisms do not exist in current Runtime Truth.

---

## Provider Architecture

### Provider Selection

Per ADR-001 §4, Bootstrap text generation SHALL use:

```text
Bootstrap Text Generation
    ↓
OpenRouter Free Model Tier
```

Rationale (from ADR-001):

```text
Avoid coupling bootstrap completion
to Gemini quota availability.
```

Alternative B (Gemini Bootstrap) has been explicitly rejected in ADR-001 due to quota exhaustion risk.

---

### Provider Separation

The following runtime systems are explicitly separated from Bootstrap:

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

## UI Contract

### Placement

Page:

```text
/works/{workId}/edit
```

Location:

```text
Below WorkForm
```

---

### UI Pattern

Bootstrap MUST follow RagBackfillPanel conventions.

---

#### Loading

```typescript
loading === true
```

Button text:

```text
Bootstrapping...
```

Button disabled:

```text
true
```

---

#### Error

Inline alert:

```html
role="alert"
```

No toast notifications.

---

#### Result

Summary card displaying:

```text
Characters Created
Locations Created
Scenes Created
```

and:

```text
Errors[]
```

when present.

---

## Security Constraints

### Authentication

The route MUST verify:

```typescript
getUser()
```

before execution.

Unauthenticated requests:

```http
401 Unauthorized
```

---

### API Key Boundary

Provider credentials MUST remain server-side.

Forbidden:

```text
Client-side provider calls
Client-side provider keys
```

---

### Provider Isolation

Bootstrap provider implementation MUST NOT modify:

```text
Avatar Generation Runtime
RAG Embedding Runtime
Scene Assistant Runtime
Evaluation Runtime
```

---

## Known Runtime Constraints

### SceneForm Constraint

Runtime Truth:

```typescript
story_images_v2[].url
=> z.string().min(1)
```

exists inside:

```text
SceneForm
```

only.

Therefore:

```text
Bootstrap-created Scene
with url=""
```

can:

```text
Open
Display
Render
```

but:

```text
cannot be saved through SceneForm
```

until a valid URL exists.

This is a known runtime limitation.

This specification does not attempt to resolve it.

---

### Web Visibility Constraint

Runtime Truth:

```text
effectiveStorySlidesFromV2
```

filters:

```typescript
url.length > 0
```

Therefore Bootstrap captions are:

```text
Visible in RAG backfill

Invisible in Reader Runtime
Invisible in Scene Assistant
Invisible in Evaluation Runtime
```

until image URLs are populated.

This behavior is intentional and preserved.

---

## Cross-Repository Obligations

Per ADR-001 §7, the introduction of `signatureQuote` requires changes outside of this repository.

### Admin Repository

Governed by this specification.

Changes required:

```text
Character type
Character row mapping
Insert mapping
Update mapping
Character form
Database schema
```

### Web Repository

This specification does not govern Web Repository implementation.

Changes required per ADR-001 §7:

```text
Character type
Data mapping
Character presentation layer
```

Web Repository implementation MUST be tracked and completed separately.

Cross-repository implementation is required before `signatureQuote` is considered fully deployed.

---

## Acceptance Criteria

### AC-01

Bootstrap executes from Work metadata only.

---

### AC-02

Characters are created successfully.

---

### AC-03

Locations are created successfully.

---

### AC-04

Scenes are created successfully.

---

### AC-05

All bootstrap-created Characters use:

```text
portraitUrl = ""
```

---

### AC-06

All bootstrap-created Scenes use:

```text
story_images_v2[].url = ""
```

---

### AC-07

No draft state introduced.

---

### AC-08

No review queue introduced.

---

### AC-09

No transaction layer introduced.

---

### AC-10

Bootstrap failure cannot affect:

```text
Avatar Runtime
RAG Runtime
Evaluation Runtime
Reader Runtime
```

---

## Cursor Implementation Checklist

```text
[ ] Add signatureQuote to Character schema
[ ] Add bootstrap provider abstraction
[ ] Add bootstrap prompt builder
[ ] Add bootstrap API route
[ ] Add BootstrapResult type

[ ] Implement Character creation phase
[ ] Implement Location creation phase
[ ] Implement Scene creation phase

[ ] Implement TSID mapping
[ ] Implement location resolution validation

[ ] Implement auth guard

[ ] Implement Bootstrap panel UI
[ ] Implement loading state
[ ] Implement error state
[ ] Implement result summary state

[ ] Verify no runtime regressions
[ ] Verify ADR-001 compliance
[ ] Verify Runtime Truth v1 compatibility
```

---

## Refs

```text
ADR-001
docs/adr/001-assisted-work-bootstrap-pipeline.md

Governance
governance/FOUNDATION.md

Evidence Chain
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
