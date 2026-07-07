# SPEC-XRM-001 — Cross-Repository Runtime Vocabulary Migration

**Status:** Proposed  
**Version:** v1.0  
**Authority Chain:** Constitution → ADR-008 (Migration Completion) → Runtime Lexicon v2 (`governance/vocabulary/runtime-lexicon.md`)  
**Scope:** Vocabulary documentation synchronization only. No Runtime redesign.  
**Architect Review Gate:** ADR-EAR-XRM-001 (Cross-Repository End-to-End Architecture Review)

---

## Purpose

This specification defines the repository synchronization required to extend the Runtime Vocabulary
migration — completed and Architecture-Closed in `raree-show-admin` (ADR-EAR-RT-001) — to all
repositories in the Raree Show project.

The migration is **documentation-only**. Implementation symbols (TypeScript interface names, component
names, database column names, API endpoints, TSID prefixes) are unchanged in every repository.

---

## Normative Vocabulary Reference

The single authoritative source for Runtime normative vocabulary is:

```
raree-show-admin: governance/vocabulary/runtime-lexicon.md
```

All repositories SHALL reference this document. No repository SHALL define conflicting Runtime
vocabulary independently.

| Normative Term | Implementation Symbol | Classification |
|----------------|-----------------------|----------------|
| Reading Route | Scene / `scenes` | Implementation Alias |
| Reading Frame | Story Image / `story_images_v2[]` | Implementation Alias |
| Frame Narrative | `caption` | Documentation Alias |
| Route Synopsis | `summary` | Documentation Alias |
| Reader Step | slide index / `readUpToStoryIndexLast` | Documentation Alias |

---

## Repositories in Scope

| Repository | Role | Local Path |
|------------|------|------------|
| `raree-show-admin` | Governance producer; ADR/SPEC authority | `/Users/yuefuchen/Documents/GitHub/raree-show-admin` |
| `raree-governance` | Governance submodule; template canonical source | `/Users/yuefuchen/Documents/GitHub/raree-governance` |
| `Raree-show-web` | Runtime consumer; reader-facing application | `/Users/yuefuchen/Documents/GitHub/raree-show-web` |

---

## Out of Scope

```
Runtime redesign
Topology changes
Vocabulary selection or re-evaluation
ADR re-opening
TypeScript interface renaming
Component renaming
Database schema changes
API contract changes
TSID prefix changes
```

---

## Deliverable 1 — Cross-Repository Inventory

### 1.1 raree-show-admin

**Status:** Architecture Closed (ADR-EAR-RT-001). Migration substantially complete.

**Governance documents (normative layer):**

| File | Scene count | Story Image count | Migration status |
|------|-------------|-------------------|-----------------|
| `governance/vocabulary/runtime-lexicon.md` | 8 (aliases) | 6 (aliases) | Normative authority ✅ |
| `docs/adr/004-source-of-canonical-truth.md` | 36 | 5 | Core topology updated; 4 residual bare uses in deep body text ⚠️ |
| `docs/adr/005-narrative-information-model.md` | 10 | 3 | Updated ✅ |
| `docs/adr/007-rollout-architecture.md` | 46 | 8 | Core topology updated; §What opening diagram and 3 residual bare uses ⚠️ |
| `docs/specs/spec-core-001-entity-schema-registry.md` | 5 | 1 | Updated ✅ |
| `docs/specs/spec-rol-001-governed-projection.md` | 62 | 4 | Core contracts updated; section titles and minor body uses remain ⚠️ |
| `docs/specs/spec-D2-001.md` | 18 | 1 | Vocabulary Notice added (Superseded doc) ✅ |
| `docs/adr/001-assisted-work-bootstrap-pipeline.md` | 9 | 2 | Pre-migration ADR; no update required |
| `docs/adr/006-discovery-copilot-architecture.md` | 19 | 2 | Pre-migration ADR; no update required |
| `docs/specs/spec-d2-002-enrichment-copilot.md` | 11 | — | Pre-migration SPEC; no update required |
| `docs/specs/spec-d3-001-discovery-platform.md` | 6 | — | Pre-migration SPEC; no update required |
| `docs/specs/spec-d3-002-discovery-human-review.md` | 13 | — | Pre-migration SPEC; no update required |
| `docs/specs/spec-d3-003-discovery-proposals.md` | 11 | — | Pre-migration SPEC; no update required |

**Governance templates (local submodule copy):**

| File | Status |
|------|--------|
| `governance/templates/ADR_TEMPLATE.md` | Legacy Alias Reference section added ✅ |
| `governance/templates/SPEC_TEMPLATE.md` | Legacy Alias Reference section added ✅ |
| `governance/templates/PR_TEMPLATE.md` | Not affected |

> ⚠️ **Submodule divergence**: Admin local copy of `governance/templates/` is ahead of canonical
> `raree-governance` by these template changes. Changes are uncommitted to submodule. Synchronization
> is required (see Dependency Graph §3).

**Implementation files (Implementation Symbol — DO NOT CHANGE):**

| File | Usage | Action |
|------|-------|--------|
| `lib/scenes.ts` | `Scene` type, `scenes` table queries | None — Implementation Symbol |
| `lib/ai/field-registry.ts` | `SCENE_REGISTRY` | Comment alignment done ✅ |
| `components/scenes/SceneForm.tsx` | `SceneForm` component | None — Implementation Symbol |
| `components/scenes/SceneTable.tsx` | `SceneTable` component | None — Implementation Symbol |
| `lib/rollout/scene-projection.ts` | `scene-projection` logic | None — Implementation Symbol |
| `lib/rollout/ui-copy.ts` | UI copy strings | None — Implementation Symbol |
| `app/works/[workId]/scenes/[sceneId]/edit/page.tsx` | Route | None — Implementation Symbol |

---

### 1.2 raree-governance

**Status:** Not yet migrated. No Runtime vocabulary in governance specs. Template divergence exists.

**Governance specs scan result:** 0 `Scene` occurrences in all `.md` files. ✅ No Runtime vocabulary in core governance documents (Constitution, FOUNDATION, RETRIEVAL, NAVIGATION, STREAMING, ADR_RULES).

**Templates:**

| File | Current state | Required action |
|------|--------------|-----------------|
| `templates/ADR_TEMPLATE.md` | Missing Legacy Alias Reference section | Add section |
| `templates/SPEC_TEMPLATE.md` | Missing Legacy Alias Reference section | Add section |
| `templates/PR_TEMPLATE.md` | Not affected | None |
| `templates/DEBUG_TEMPLATE.md` | Not affected | None |
| `templates/SPIKE_TEMPLATE.md` | Not affected | None |

**ADR references:** None (governance does not contain ADRs).

**Developer documentation:** `README.md` — no Runtime vocabulary issues.

---

### 1.3 Raree-show-web

**Status:** Not yet migrated. Runtime vocabulary entirely in legacy form (expected: consumer repository).

**TypeScript types (Implementation Symbols — DO NOT CHANGE):**

| File | Legacy symbol | Classification | Action |
|------|--------------|----------------|--------|
| `src/lib/types.ts` | `interface Scene` | Implementation Symbol | None |
| `src/lib/types.ts` | `type StoryImage` | Implementation Symbol | None |
| `src/lib/story-images-v2.ts` | `EffectiveStorySlide` | Implementation Symbol | None |

**Component names (Implementation Symbols — DO NOT CHANGE):**

| Component | Symbol | Action |
|-----------|--------|--------|
| `SceneExperience.tsx` | `SceneExperience` | None |
| `useSceneAtomicNavigation.ts` | `SceneReadingState`, `SceneReadingAction` | None |
| `CaptionDisplay.tsx` | `caption` field access | None |
| `SceneAssistant.tsx` | `SceneAssistant` | None |
| `SceneNavButtons.tsx` | `SceneNavButtons` | None |
| `SceneNavControls.tsx` | `SceneNavControls` | None |
| `SceneRopes.tsx` | `SceneRopes` | None |
| `SceneSlide.tsx` | `SceneSlide` | None |
| `SceneTimeCard.tsx` | `SceneTimeCard` | None |

**Documentation (migration required):**

| File | Scene count | Story Image count | Issue |
|------|-------------|-------------------|-------|
| `docs/runtime-architecture.md` | 5 | 0 | Architecture doc uses `Scene` as normative runtime term; no vocabulary notice |
| `README.md` | 9 | 0 | Product README uses `Scene` as normative runtime term; no vocabulary notice |
| `docs/specs/w-01-visibility-synchronized-navigation.md` | 3 | 0 | Spec uses `Scene` in architecture context; no vocabulary notice |
| `docs/adr/002-hybrid-rag-retrieval.md` | 11 | 5 | ADR uses `Scene` and `story_images_v2` without vocabulary notice |
| `docs/international-team-glossary.md` | 2 | 0 | Team glossary — non-architecture context; OK |

**AGENTS.md:** 1 occurrence of `Scene` — governance adapter file; no vocabulary notice needed.

---

## Deliverable 2 — Migration Matrix

Legend for **Migration Type**:
- `VOCAB-NOTICE` — Add vocabulary notice header pointing to Runtime Lexicon v2
- `ALIAS-TABLE` — Add Legacy Alias Reference table
- `TEMPLATE-SYNC` — Push template changes to canonical governance source
- `NO-CHANGE` — Implementation Symbol; must not be modified

Legend for **Risk**:
- `LOW` — Documentation-only; no functional impact
- `NONE` — Excluded from scope

---

### admin (raree-show-admin)

| # | Path | Current term | Normative term | Migration type | Risk | Reviewer |
|---|------|-------------|----------------|----------------|------|----------|
| A-01 | `docs/adr/004`: L1897 | `Runtime Scene` | `Runtime Reading Route` | Add alias annotation `(implementation: Scene)` | LOW | Architect |
| A-02 | `docs/adr/004`: L2065 | `Work → Scene → Story Images` | `Work → Reading Route → Reading Frame` | Add `[legacy: implementation symbols]` inline note | LOW | Architect |
| A-03 | `docs/adr/004`: L2086 | `Runtime Scene association` | `Runtime Reading Route (implementation: Scene) association` | Inline alias | LOW | Architect |
| A-04 | `docs/adr/004`: L2263 | `Story ↔ Scene orthogonal` | `Story ↔ Reading Route orthogonal` | Inline alias | LOW | Architect |
| A-05 | `docs/adr/004`: L1868 | `imageCaption` (no Deprecated marker) | `imageCaption (Deprecated)` | Add `(Deprecated)` annotation | LOW | Architect |
| A-06 | `docs/adr/007`: L42-46 | `Scene / Story Images` in §What diagram | Add `(normative: Reading Route / Reading Frame)` annotation | `VOCAB-NOTICE` | LOW | Architect |
| A-07 | `docs/adr/007`: L340 | `Runtime Scene records` | `Runtime Reading Route records (implementation: Scene)` | Inline alias | LOW | Architect |
| A-08 | `docs/adr/007`: L473 | `Story ↔ Scene orthogonal association model` | `Story ↔ Reading Route orthogonal association model (implementation: Scene)` | Inline alias | LOW | Architect |
| A-09 | `docs/adr/007`: L494 | `Runtime Scene association` | `Runtime Reading Route (implementation: Scene) association` | Inline alias | LOW | Architect |
| A-10 | `docs/specs/spec-rol-001`: §4.3 title | `Story ↔ Scene governed link` | `Story ↔ Reading Route (implementation: Scene) governed link` | Section title update | LOW | Architect |
| A-11 | `docs/specs/spec-rol-001`: §4.4 title | `Scene Projection Accept outcomes` | `Reading Route Projection Accept outcomes (implementation: Scene)` | Section title update | LOW | Architect |
| A-12 | `docs/specs/spec-rol-001`: §4.7.3 title | `Scene Projection Accept` | `Reading Route Projection Accept (implementation: Scene)` | Section title update | LOW | Architect |
| A-13 | `docs/specs/spec-rol-001`: ROL-AC-01 | `Story↔Scene N:M association` | `Story↔Reading Route N:M association (implementation: Scene)` | Inline alias | LOW | Architect |
| A-14 | `governance/templates/ADR_TEMPLATE.md` | Missing Legacy Alias Reference | — | `TEMPLATE-SYNC` to canonical raree-governance | LOW | Architect |
| A-15 | `governance/templates/SPEC_TEMPLATE.md` | Missing Legacy Alias Reference | — | `TEMPLATE-SYNC` to canonical raree-governance | LOW | Architect |

---

### raree-governance

| # | Path | Current term | Normative term | Migration type | Risk | Reviewer |
|---|------|-------------|----------------|----------------|------|----------|
| G-01 | `templates/ADR_TEMPLATE.md` | Missing Legacy Alias Reference section | Add section | `ALIAS-TABLE` | LOW | Architect |
| G-02 | `templates/SPEC_TEMPLATE.md` | Missing Legacy Alias Reference section | Add section | `ALIAS-TABLE` | LOW | Architect |

---

### Raree-show-web

| # | Path | Current term | Normative term | Migration type | Risk | Reviewer |
|---|------|-------------|----------------|----------------|------|----------|
| W-01 | `docs/runtime-architecture.md` | `Scene` as normative term | Add vocabulary notice header | `VOCAB-NOTICE` | LOW | Engineer |
| W-02 | `docs/adr/002-hybrid-rag-retrieval.md` | `Scene` / `story_images_v2` without notation | Add vocabulary notice header | `VOCAB-NOTICE` | LOW | Engineer |
| W-03 | `docs/specs/w-01-visibility-synchronized-navigation.md` | `Scene` in architecture context | Add vocabulary notice header | `VOCAB-NOTICE` | LOW | Engineer |
| W-04 | `README.md` | `Scene Slideshow`, `Scene Caption Panel`, `Scene Assistant` as product feature names | Add vocabulary notice footnote | `VOCAB-NOTICE` | LOW | Engineer |
| W-05 | `src/lib/types.ts` | `interface Scene`, `type StoryImage` | — | `NO-CHANGE` (Implementation Symbols) | NONE | — |
| W-06 | `src/lib/story-images-v2.ts` | `EffectiveStorySlide`, `story_images_v2` | — | `NO-CHANGE` (Implementation Symbols) | NONE | — |
| W-07 | `src/components/raree/Scene*.tsx` | Component names | — | `NO-CHANGE` (Implementation Symbols) | NONE | — |
| W-08 | `src/components/raree/useSceneAtomicNavigation.ts` | `SceneReadingState`, `SceneReadingAction` | — | `NO-CHANGE` (Implementation Symbols) | NONE | — |
| W-09 | `src/components/raree/CaptionDisplay.tsx` | `caption` field access | — | `NO-CHANGE` (Implementation Symbols) | NONE | — |

---

## Deliverable 3 — Dependency Graph

### Synchronization Order

```
Step 1 — raree-show-admin (documentation cleanup)
│
│  Resolve 15 residual items (A-01 through A-15)
│  Priority: A-06 (ADR-007 §What diagram) first — highest reader visibility
│  Commit as a single documentation-cleanup PR
│  PR label: docs / vocabulary-cleanup / no-architecture-change
│
▼
Step 2 — raree-governance (template synchronization)
│
│  Receive template changes from admin submodule (G-01, G-02)
│  Option A: cherry-pick diff from admin submodule local changes
│  Option B: re-apply identical Legacy Alias Reference sections manually
│  Commit to raree-governance main branch
│  Admin then updates submodule pointer and runs npm run sync:governance
│
▼
Step 3 — Raree-show-web (vocabulary notices)
│
│  Apply W-01 through W-04 (documentation vocabulary notices only)
│  W-05 through W-09 explicitly excluded (Implementation Symbols)
│  Commit as a single documentation PR
│  PR label: docs / vocabulary-alignment / no-code-change
│
▼
Step 4 — Cross-Repository EAR (ADR-EAR-XRM-001)
│
│  Verify all repositories reference the same Runtime Lexicon v2
│  Confirm no architectural drift
│  Determine Project Runtime Vocabulary closure status
│
▼
Project Runtime Vocabulary: Closed / Frozen
```

### Dependency Justification

The prescribed order (admin → governance → web) is correct because:

1. **admin first**: It is the governance producer. All residual cleanup must be resolved before other
   repositories synchronize to it. The governance submodule changes also originate here.

2. **governance second**: Governance templates are canonical sources read by all consumer repositories.
   Templates must be stable before web documentation is written against them.

3. **web third**: Pure consumer. Its documentation can only adopt normative vocabulary after the
   canonical source (admin) and template authority (governance) are stable.

4. **EAR last**: Verification can only run after all synchronized changes are committed.

---

## Deliverable 4 — Consistency Rules

The following invariants MUST hold across all repositories at the conclusion of this migration.

### XRM-INV-01 — Single Normative Source

`governance/vocabulary/runtime-lexicon.md` in `raree-show-admin` is the only authoritative Runtime vocabulary
definition. No repository SHALL define or redefine Runtime normative terms independently.

### XRM-INV-02 — Reading Route Is the Only Normative Routing Term

No governance document (ADR, SPEC, or template) SHALL use `Scene` as a normative Runtime routing
term without the annotation `(implementation: Scene)` or equivalent alias declaration.

### XRM-INV-03 — Reading Frame Is the Only Normative Frame Term

No governance document SHALL use `Story Image` as a normative Runtime frame term without the
annotation `(implementation: Story Image)` or equivalent alias declaration.

### XRM-INV-04 — Implementation Symbols Are Frozen

The following symbols SHALL NOT be renamed in any repository:

```
scenes          (table name)
story_images_v2 (column name / JSON field)
caption         (JSON field in story_images_v2[])
summary         (column name)
scene_          (TSID prefix)
SceneForm       (component)
SceneExperience (component)
SceneAssistant  (component)
```

These are database-contract and API-contract stable identifiers. Vocabulary migration does not
alter them.

### XRM-INV-05 — Legacy Aliases Follow Documented Policy

All occurrences of legacy Runtime terms in governance documents MUST fall into exactly one of:

| Category | Policy |
|----------|--------|
| Implementation Alias | Appears as `(implementation: Scene)` or equivalent |
| Documentation Alias | Appears as `(formerly X)` or `(implementation: caption)` |
| Deprecated | Appears with `(Deprecated)` marker; MUST NOT appear in new documents |

No legacy term SHALL appear in governance documents without explicit category declaration.

### XRM-INV-06 — Topology Equivalence Across Repositories

All repositories that describe the Runtime topology MUST express it equivalently as:

```
Work → Reading Route → Reading Frame
```

with implementation symbols annotated where applicable. No repository SHALL express a topology
that conflicts with this structure.

### XRM-INV-07 — Vocabulary Notices in Consumer Documentation

Consumer repository documentation (Raree-show-web docs) that describes the Runtime architecture
using implementation symbols MUST include a vocabulary notice pointing to `governance/vocabulary/runtime-lexicon.md`
in `raree-show-admin`. The notice format is:

```markdown
> **Vocabulary Notice:** This document uses implementation symbols (`Scene`, `StoryImage`,
> `story_images_v2`). Normative Runtime vocabulary is `Reading Route`, `Reading Frame`, and
> `Frame Narrative`. See `governance/vocabulary/runtime-lexicon.md` in `raree-show-admin`.
```

### XRM-INV-08 — Template Consistency

Governance templates in `raree-governance` MUST include the Legacy Alias Reference section identical
to the version in `raree-show-admin/governance/templates/`. No template fork is permitted.

### XRM-INV-09 — No Cross-Repository Conflicting Definitions

No repository SHALL contain a glossary, README section, or developer documentation that defines
`Scene` as a normative architectural term independently of Runtime Lexicon v2. Product feature names
(e.g. "Scene Slideshow" as a UI feature name in README) are exempt from this rule and require
only the vocabulary notice footer (XRM-INV-07).

---

## Deliverable 5 — Acceptance Checklist

The following checklist must pass before ADR-EAR-XRM-001 is triggered.

### admin (raree-show-admin)

- [ ] **A-01** — ADR-004 L1897: `Runtime Scene` annotated as `(implementation: Scene)`
- [ ] **A-02** — ADR-004 L2065: `Work → Scene → Story Images` annotated with implementation note
- [ ] **A-03** — ADR-004 L2086: `Runtime Scene association` annotated
- [ ] **A-04** — ADR-004 L2263: `Story ↔ Scene` → `Story ↔ Reading Route (implementation: Scene)`
- [ ] **A-05** — ADR-004 L1868: `imageCaption` marked `(Deprecated)`
- [ ] **A-06** — ADR-007 §What diagram (L42-46): alias annotation added
- [ ] **A-07** — ADR-007 L340: `Runtime Scene records` annotated
- [ ] **A-08** — ADR-007 L473: `Story ↔ Scene` annotated
- [ ] **A-09** — ADR-007 L494: `Runtime Scene association` annotated
- [ ] **A-10** — SPEC-ROL-001 §4.3 title updated
- [ ] **A-11** — SPEC-ROL-001 §4.4 title updated
- [ ] **A-12** — SPEC-ROL-001 §4.7.3 title updated
- [ ] **A-13** — SPEC-ROL-001 ROL-AC-01 annotated
- [ ] **A-14** — `governance/templates/ADR_TEMPLATE.md` submodule change committed
- [ ] **A-15** — `governance/templates/SPEC_TEMPLATE.md` submodule change committed
- [ ] No undocumented bare `Scene` remains in ADR-004, ADR-005, ADR-007 normative sections
- [ ] No undocumented `Story Image` remains in any governance document
- [ ] `imageCaption` appears only in Legacy Alias Reference tables or marked `(Deprecated)`
- [ ] `governance/vocabulary/runtime-lexicon.md` exists and is complete

### raree-governance

- [ ] **G-01** — `templates/ADR_TEMPLATE.md` includes Legacy Alias Reference section
- [ ] **G-02** — `templates/SPEC_TEMPLATE.md` includes Legacy Alias Reference section
- [ ] Template content is identical to admin submodule version
- [ ] `npm run sync:governance` in admin succeeds after governance commit

### Raree-show-web

- [ ] **W-01** — `docs/runtime-architecture.md` has vocabulary notice header
- [ ] **W-02** — `docs/adr/002-hybrid-rag-retrieval.md` has vocabulary notice header
- [ ] **W-03** — `docs/specs/w-01-visibility-synchronized-navigation.md` has vocabulary notice header
- [ ] **W-04** — `README.md` has vocabulary notice footnote
- [ ] `interface Scene` in `src/lib/types.ts` — unchanged (Implementation Symbol)
- [ ] `type StoryImage` in `src/lib/types.ts` — unchanged (Implementation Symbol)
- [ ] `EffectiveStorySlide` in `src/lib/story-images-v2.ts` — unchanged (Implementation Symbol)
- [ ] No component in `src/components/raree/Scene*.tsx` was renamed
- [ ] `story_images_v2` column references — unchanged (Implementation Symbol)

### Cross-Repository

- [ ] All three repositories' governance documentation express the same Runtime topology
- [ ] No repository defines a conflicting normative Runtime term
- [ ] `governance/vocabulary/runtime-lexicon.md` (admin) is the only authoritative vocabulary source
- [ ] No repository's template diverges from canonical governance templates
- [ ] XRM-INV-01 through XRM-INV-09 all pass

---

## Deliverable 6 — Cross-Repository EAR Plan (ADR-EAR-XRM-001)

### Purpose

After all repositories have completed migration steps, a final Cross-Repository End-to-End
Architecture Review (ADR-EAR-XRM-001) determines whether the Runtime Vocabulary initiative can
transition from:

```
Architecture Closed (per ADR-EAR-RT-001)
Cross-Repository Migration Pending
```

to:

```
Project Runtime Vocabulary: Closed / Frozen
```

### Review Scope

The EAR SHALL cover:

```
raree-show-admin  governance/vocabulary/runtime-lexicon.md       ← Single normative source
raree-show-admin  docs/adr/004, 005, 007           ← Governance ADRs
raree-show-admin  docs/specs/spec-core-001          ← Entity schema
raree-show-admin  docs/specs/spec-rol-001           ← Rollout projection
raree-governance  templates/ADR_TEMPLATE.md         ← Template authority
raree-governance  templates/SPEC_TEMPLATE.md        ← Template authority
Raree-show-web    docs/runtime-architecture.md      ← Consumer documentation
Raree-show-web    docs/adr/002-hybrid-rag-retrieval.md
Raree-show-web    docs/specs/w-01-visibility-synchronized-navigation.md
Raree-show-web    README.md
```

### Required Verifications

#### 6.1 Terminology Consistency

- Every normative Runtime term appears in exactly one authoritative source: `governance/vocabulary/runtime-lexicon.md`.
- No repository defines conflicting normative Runtime terms.
- Every occurrence of `Scene` or `Story Image` in governance documents carries an alias annotation
  or is classified in a Legacy Alias Reference table.
- `imageCaption` appears only as `(Deprecated)` or in Legacy Alias Reference tables.

#### 6.2 Topology Consistency

- All architecture diagrams across all repositories express `Work → Reading Route → Reading Frame`.
- No diagram contradicts this topology.
- Implementation symbol annotations (`scenes`, `story_images_v2[]`) are present where required.

#### 6.3 Responsibility Consistency

- No migration change has silently transferred architectural responsibility between components.
- Human Acceptance Gate (ADR-004 Decision 2) remains unchanged.
- N:M Story ↔ Reading Route projection (ADR-007 Decision 2) remains unchanged.
- Runtime Truth v1 topology remains unchanged.

#### 6.4 Glossary Consistency

- All repositories that define Runtime terms point to or are consistent with `governance/vocabulary/runtime-lexicon.md`.
- No repository glossary contradicts the normative definitions.
- Consumer repository documentation uses Implementation Symbols correctly.

#### 6.5 Template Consistency

- `raree-governance` templates are identical to `raree-show-admin` local submodule templates.
- `npm run sync:governance` produces `.github/pull_request_template.md` consistent with governance.
- All new ADRs and SPECs written after this migration MUST use the updated templates.

#### 6.6 Implementation Symbol Consistency

- `scenes` table name: unchanged across all repositories.
- `story_images_v2` column/field: unchanged across all repositories.
- `caption` field: unchanged across all repositories.
- `Scene` component/type names in Raree-show-web: unchanged.
- `StoryImage` type: unchanged.

### Review Output

ADR-EAR-XRM-001 SHALL produce exactly one decision:

**A — Project Runtime Vocabulary: Closed / Frozen**

All repositories are synchronized. Runtime Lexicon v2 is the stable authoritative source.
No further migration RFC required. Implementation of normative vocabulary in new documents
is enforced by updated templates.

— OR —

**B — Additional Repository Migration Required**

One or more repositories failed Acceptance Checklist criteria. Specific failures enumerated.
Re-entry into migration steps required.

### EAR Entry Condition

ADR-EAR-XRM-001 may only be triggered after:

1. All items in the Acceptance Checklist (Deliverable 5) are checked.
2. PRs for admin cleanup, governance template sync, and web vocabulary notices are merged.
3. `npm run check:governance` passes in both admin and web repositories.

---

## Legacy Alias Reference

| Normative Term | Legacy Term | Classification | Status |
|----------------|-------------|----------------|--------|
| Reading Route | Scene | Implementation Alias | Active — appears as `(implementation: Scene)` |
| Reading Frame | Story Image | Implementation Alias | Active — appears as `(implementation: Story Image)` |
| Frame Narrative | caption | Documentation Alias | Active — appears as `(implementation: caption)` |
| Route Synopsis | summary | Documentation Alias | Active — appears as `(implementation: summary)` |
| Frame Narrative | imageCaption | Deprecated | Must not appear in new documents |
