# ADR-008 — Runtime Vocabulary Convergence

**Status:** Accepted  
**Type:** Architecture ADR  
**Version:** 1.0  
**Date:** 2026-07-08  
**Owner:** Architect  
**Related ADR:** ADR-004 (Source of Canonical Truth — Runtime Truth v1 topology);
ADR-005 (Narrative Information Model — Editorial Domain glossary);
ADR-006 (Discovery Copilot Architecture — candidate lifecycle);
ADR-007 (Editorial → Runtime Rollout Architecture — governed projection)  
**Supersedes:** None  
**Amendment:** —

---

## What

This ADR establishes the **Runtime Vocabulary Convergence Policy** for Raree Show.

It defines:

* The **Ubiquitous Language Principle** — a single canonical term per concept across
  every architectural layer.
* The **Inferability Principle** — a runtime quality attribute that domain identifiers
  must satisfy.
* The **Alias Acceptance Rule** — the precise condition under which an alias is
  architecturally acceptable.
* The definition of **Vocabulary Debt** and the classification of existing
  terminology against that definition.
* The **Runtime Truth Language Architecture** — the target topology in which every
  layer communicates using the same language.

This ADR does **not** govern:

* Runtime Truth v1 topology, database schema, or routing (ADR-004 remains authoritative).
* Editorial Domain Story semantics or the ONE Rule (ADR-005).
* Discovery Candidate lifecycle or Authority Emergence (ADR-006).
* Governed projection rules (ADR-007).
* Specific rename targets, migration sequences, or acceptance criteria — these are
  the responsibility of the implementation SPEC authorized by this ADR:
  `docs/specs/spec-vdc-001-vocabulary-debt-closure.md`.

---

## Why

### The Evidence Base

A vocabulary audit conducted on 2026-07-08 (findings embedded below) produced the following evidence:

1. **Five parallel vocabularies exist simultaneously** across Governance, Editorial
   Domain, Discovery artifacts, implementation symbols, and UI labels.

2. **The word "Story" carries four distinct concepts**: the Editorial narrative
   unit (ADR-005), the Discovery candidate type, the Reading Frame collection
   prefix (`StoryImage`, `story_images_v2`), and an ad-hoc admin UI label
   (`Story Sequence`).

3. **The word "Scene" carries three distinct concepts**: the Runtime Reading Route
   (implementation alias), the Discovery Editorial-layer scene candidate, and general
   UI operational language.

4. **Reading Frame alone has eight or more active aliases** across the admin and web
   repositories: `StoryImage`, `story_images_v2`, `EffectiveStorySlide`,
   `StoryImageSlide`, `storyImages`, `revealedStorySlides`, `slide`, `segment`,
   `Story Sequence`, and `<story>` (LLM XML).

5. **Zero production code** uses the normative Governance vocabulary
   (`Reading Route`, `Reading Frame`, `Frame Narrative`, `Route Synopsis`,
   `Reader Step`) as an identifier. The single exception is comments in
   `lib/ai/field-registry.ts`.

6. **Vocabulary Notice stubs** in four documentation files acknowledge the divergence
   but do not resolve it.

### Why This Is Architecture Debt, Not Style

The prior vocabulary work — documented in `governance/vocabulary/runtime-lexicon.md`
(RV-01 ~ RV-07) and `docs/specs/spec-xrm-001-cross-repo-vocabulary-migration.md` —
established normative vocabulary and classified legacy aliases as acceptable
Implementation Aliases. That work was correct within its scope: it prevented
further vocabulary fragmentation and documented the mapping.

However, the Vocabulary Audit reveals that the *alias model itself* is the problem.
Every legitimate alias introduces a translation step. Translation steps are not
free: they accumulate as cognitive overhead at every boundary crossing — between
ADR and SPEC, between SPEC and code, between code and UI, between UI and AI prompt,
between prompt response and test assertion.

The Constitution states: *Cognitive Cost First.* Mandatory translation is cognitive
cost by definition. An architecture that requires a glossary lookup to understand
an identifier imposes cognitive cost independent of execution correctness.

The Governance chain documented in `governance/vocabulary/runtime-lexicon.md §6`
established the *normative vocabulary*. ADR-008 establishes the *policy that that
vocabulary must be implemented directly*, not merely documented.

---

## How

### Decision 1 — Ubiquitous Language

**Runtime Truth v1 adopts a single ubiquitous language as the long-term architectural
target.**

> One concept → one directly inferable identifier, at every layer.

The canonical vocabulary established in `governance/vocabulary/runtime-lexicon.md`
(RV-01 ~ RV-07) is the ubiquitous language for the Runtime domain.

Every layer — Governance, SPEC, TypeScript type, React component, API contract,
route path, UI label, AI prompt, documentation, and test assertion — is a consumer
of this language and must implement it directly.

The ubiquitous language is not a translation reference. It is the identifier set
used in production.

**Rationale.** Ubiquitous language is a necessary architectural property when
multiple teams, layers, and automated systems must reason about the same domain
model. When the language is not ubiquitous, every boundary crossing requires
translation. Translation is a failure mode, not a feature: it introduces
latency, asymmetric understanding, and inconsistency under change. Runtime Truth
requires consistent understanding at every layer — from the governance architect
to the AI model responding in a prompt.

---

### Decision 2 — Role of the Glossary

**The Runtime Lexicon (`governance/vocabulary/runtime-lexicon.md`) is the normative
language specification, not a translation dictionary.**

Its purpose is to define the canonical identifiers that all layers implement
directly. It is not a reference for mapping one layer's naming to another layer's
naming.

After this ADR is adopted:

* A new SPEC that introduces a Runtime type must use RV-identified vocabulary as
  the primary identifier, not as a comment.
* A new React component rendering a Reading Route must use `ReadingRoute` (or its
  localized equivalent) as the component name, not `Scene` with a comment
  saying `// Reading Route`.
* A new API contract field carrying a Reading Frame must be named with the
  canonical term, not the implementation symbol.

The Lexicon remains the single normative authority. ADRs and SPECs must not
define Runtime vocabulary independently (rule already codified in
`governance/vocabulary/runtime-lexicon.md §4 DR-01`; this ADR elevates that rule
to a policy obligation for implementation layers).

---

### Decision 3 — Inferability Principle

**A domain identifier must allow a newcomer to infer its domain meaning without
consulting external documentation.**

This is defined as the **Inferability Principle** (IP-01).

**IP-01** A Runtime domain identifier satisfies the Inferability Principle if and
only if:

* A reader who has not previously encountered the identifier can correctly infer
  its domain role from the identifier itself; and
* The inference does not require consulting the Glossary, a comment, an alias
  mapping, or any document external to the identifier's declaration context.

Inferability is a **runtime quality attribute**, not a naming preference, for the
following reason: the Raree Show system includes AI models as architectural
participants. AI models reason about identifiers in prompts, context windows, and
code completions. When an identifier requires external context to be understood
correctly, an AI model operating without that context will produce architecturally
incorrect output. This failure mode is not detectable at review time and propagates
silently across generated text, test assertions, and documentation drafts.

Inferability therefore has the same architectural standing as a consistency
constraint: it is a property the system must preserve to operate correctly across
all of its participants, including non-human ones.

**Counter-example.** The identifier `story_images_v2` does not satisfy IP-01:

* A newcomer reading the identifier infers a collection of story-related images,
  version 2.
* The correct domain meaning is: an ordered sequence of Reading Frames, each
  consisting of a visual reference and a Frame Narrative.
* Correct inference requires the Glossary (two lookups: `story_images_v2` →
  `Reading Frame`, then `Story Image` → `Reading Frame`).

**Satisfying example.** The identifier `readingFrames` satisfies IP-01:

* A newcomer reading the identifier infers: frames used for reading.
* This is consistent with the domain meaning.
* No external lookup is required.

---

### Decision 4 — Alias Acceptance Rule

**An alias is architecturally acceptable only when it preserves immediate
inferability and does not require translation into another domain term.**

Formally: an alias `A` for canonical term `C` is acceptable if and only if:

> A reader who has not previously encountered `A` can correctly infer `C` from `A`
> without external documentation.

Historical aliases that require Glossary lookup are classified as **Vocabulary Debt**
(defined in Decision 5) rather than permanent architecture.

**Consequences of this rule:**

* `scenes` (database table name) is acceptable as an alias for Reading Route
  (implementation): a newcomer infers a collection of scene-like reading units,
  which is adjacent to the domain meaning of a navigable reading container. The
  alias is tolerable within the database layer where changing table names carries
  high migration cost.

* `story_images_v2` is **not acceptable** as a normative identifier: the alias does
  not yield inferability of Reading Frame from the name alone. It is Vocabulary Debt.

* `caption` is acceptable as an alias for Frame Narrative: the domain meaning of
  a narrative text accompanying a visual is directly inferable from the word
  "caption."

* `Story Sequence` (admin UI label) is **not acceptable**: it is not a registered
  alias, does not appear in the Glossary, and its relationship to Reading Frame is
  not directly inferable. It is Vocabulary Debt.

* `segment` (admin UI informal term) is **not acceptable**: it has no governance
  registration and does not infer Reading Frame.

This rule does **not** require all aliases to be eliminated before any other work
proceeds. The implementation SPEC authorized by this ADR defines the elimination
sequence based on migration risk (see Migration Risk section of the Vocabulary Audit).

---

### Decision 5 — Vocabulary Debt

**Vocabulary Debt is any use of a domain identifier that fails the Inferability
Principle and requires translation into a canonical term.**

Vocabulary Debt is measured along four dimensions:

| Dimension | Definition |
|-----------|------------|
| **Inferability deficit** | The gap between what a newcomer infers from the identifier and its correct domain meaning. |
| **Ambiguity** | The number of distinct concepts the same identifier represents across layers. |
| **Translation requirement** | Whether understanding the identifier requires consulting external documentation. |
| **Cognitive cost** | The total mental load imposed on all participants — human and AI — who must reason about the identifier across layers. |

**Vocabulary Debt is not:**

* A measure of how long an alias has existed.
* A criticism of historical decisions.
* A signal that existing implementations are incorrect.

A term may have been introduced correctly for its context and still constitute
Vocabulary Debt today, if the system has grown to the point where the term's
ambiguity imposes systematic translation cost.

**Vocabulary Debt classification from the Audit:**

| Identifier | Debt Category | Debt Reason |
|---|---|---|
| `StoryImage` | High | No inferability of Reading Frame; false inference toward story-related images |
| `story_images_v2` | High | No inferability; version suffix implies technical artifact |
| `Story Sequence` (UI label) | High | Unregistered alias; collides with three other "Story" concepts |
| `story` (Discovery candidate type) | Medium | Collides with Editorial Story (ADR-005) and with StoryImage prefix |
| `scene` (Discovery candidate type) | Medium | Collides with RV-02 Reading Route implementation alias |
| `segment` (UI informal) | Medium | No governance registration; domain meaning not directly inferable |
| `slide` / `EffectiveStorySlide` | Medium | Carries no Reading Frame inferability |
| `Scene` (TypeScript type) | Low | Direct legacy alias; inferability partially preserved within implementation context |
| `caption` (field name) | None | Directly inferable as Frame Narrative; acceptable alias |
| `summary` (field name) | None | Directly inferable as Route Synopsis within context; acceptable alias |

---

### Decision 6 — Runtime Truth Language Architecture

**Every architectural layer consumes the same ubiquitous language.**

The target architecture is a **vertical language stack** in which each layer
receives the canonical vocabulary from the layer above and transmits it to the
layer below without translation:

```text
Governance (runtime-lexicon.md — RV-01 ~ RV-07)
      │  canonical identifiers defined here
      ▼
ADR / SPEC
      │  define decisions and contracts using canonical identifiers
      ▼
TypeScript types and interfaces
      │  type names match canonical identifiers
      ▼
React components and hooks
      │  component names and prop names match canonical identifiers
      ▼
API routes and contracts
      │  path segments and payload field names match canonical identifiers
      ▼
UI labels (admin and reader)
      │  operator-visible and user-visible text uses canonical terms
      ▼
AI prompts and LLM context
      │  XML tags, JSON keys, and narrative descriptions use canonical terms
      ▼
Documentation and tests
           assertion variable names and doc prose match canonical terms
```

**The invariant is vertical consistency: a canonical identifier introduced at the
Governance layer must be traceable down every level without synonym substitution.**

This does not require identical surface forms at every layer. A React component
named `ReadingRouteEditor` is consistent with canonical term `Reading Route`. A
URL path segment `/reading-routes` is consistent. A Chinese UI label `阅读路线` is
consistent with `Reading Route` provided a localization mapping is registered in
the implementation SPEC.

What is not consistent: a TypeScript type `Scene`, a React component `SceneForm`,
an API route `/scenes`, and a UI label `场景` when the canonical term is
`Reading Route` — because each layer independently uses the alias without
transmitting the canonical form.

---

## Validation

This ADR defines policy. Validation is the responsibility of
`docs/specs/spec-vdc-001-vocabulary-debt-closure.md`.

Invariant checks established by this ADR:

- **VDC-INV-01** — No new ADR or SPEC after 2026-07-08 may introduce a domain
  identifier for an RV-registered concept that fails IP-01, unless the identifier
  is explicitly registered as an acceptable alias in `runtime-lexicon.md`.

- **VDC-INV-02** — No new React component, TypeScript type, or API route field
  introduced after this ADR may use `Story` as a prefix or suffix when the
  intended domain concept is a Reading Frame, Reading Route, or Frame Narrative.

- **VDC-INV-03** — The UI label `Story Sequence` must be replaced in the
  implementation SPEC. Its continued presence in `SceneForm.tsx` after SPEC
  acceptance constitutes an unresolved Vocabulary Debt item.

- **VDC-INV-04** — The implementation SPEC must include a complete inferability
  audit for every renamed identifier, confirming IP-01 is satisfied.

---

## Refs

- Constitution: `Constitution.md` — Cognitive Cost First, Convergence Before Expansion
- Governance: `governance/FOUNDATION.md` — Runtime Supremacy Law
- Vocabulary: `governance/vocabulary/runtime-lexicon.md` — RV-01 ~ RV-07
- ADR-004 — Source of Canonical Truth (Runtime Truth v1 topology)
- ADR-005 — Narrative Information Model (Editorial Domain glossary)
- ADR-006 — Discovery Copilot Architecture
- ADR-007 — Editorial → Runtime Rollout Architecture
- `docs/specs/spec-vdc-001-vocabulary-debt-closure.md` — implementation SPEC (rename targets, phases, acceptance criteria)
- `governance/vocabulary/runtime-lexicon.md §4` — DR-01 ~ DR-06 (authoring rules)
- `governance/vocabulary/runtime-lexicon.md §6` — Governance Chain (vocabulary selection record)
- `docs/specs/spec-xrm-001-cross-repo-vocabulary-migration.md` — cross-repo alias migration

---

## Decision

Runtime Truth v1 adopts a ubiquitous language governed by IP-01 (Inferability
Principle). The canonical vocabulary defined in `governance/vocabulary/
runtime-lexicon.md` is the implementation target for every layer. Aliases that fail
IP-01 are classified as Vocabulary Debt and must be eliminated in the implementation
SPEC authorized by this ADR.

---

## Alternatives Considered

### A — Retain the current alias model; document more thoroughly

The prior alias model — codified in `governance/vocabulary/runtime-lexicon.md §3`
— treats `Scene` and `StoryImage` as permanent acceptable aliases and requires
only documentation-layer convergence.

**Rejected.** The Vocabulary Audit demonstrates that documentation-layer convergence
does not reduce cognitive cost in practice. After completing the most thorough
vocabulary documentation effort to date (normative vocabulary definition,
cross-repo migration per `spec-xrm-001`, and Vocabulary Notice files in four
documentation files), zero production identifiers use normative vocabulary. The
alias model has proven insufficient to bridge the gap between governance intent and
implementation reality.

### B — Prohibit all aliases immediately; rename in a single pass

Require all layers to use canonical vocabulary immediately, with no alias tolerance.

**Rejected.** Database table renames (`scenes` → `reading_routes`) carry high
migration risk and require coordinated deployment across admin and web repositories.
A blanket prohibition without a sequenced migration plan introduces unnecessary
operational risk. The Alias Acceptance Rule (Decision 4) provides a principled
distinction between tolerable aliases and Vocabulary Debt, enabling a risk-stratified
migration.

### C — Adopt a different canonical vocabulary

Introduce a new vocabulary set different from RV-01 ~ RV-07.

**Rejected.** RV-01 ~ RV-07 was established through a five-stage governance chain
(see `governance/vocabulary/runtime-lexicon.md §6` — Governance Chain)
including adversarial testing. The vocabulary is architecturally sound. The problem
identified by this ADR is not the vocabulary itself but the policy that governs its
implementation scope.

---

## Trade-offs

| Trade-off | Cost | Benefit |
|-----------|------|---------|
| Renaming TypeScript types (`Scene` → `ReadingRoute`) | Mechanical effort across ~25 admin files, ~10 web files | Eliminates translation requirement at every downstream usage |
| Renaming React components (`SceneForm` → `ReadingRouteForm`) | Import updates; component library churn | AI code generation uses correct domain identifiers without prompt engineering |
| Renaming URL path segments (`/scenes` → `/reading-routes`) | Requires HTTP redirects; potential SEO impact | URL directly expresses domain semantics to operators and tools |
| Database table rename (`scenes` → `reading_routes`) | SQL migration; Supabase RLS policy update; high operational risk | Full stack consistency; low immediate benefit relative to cost |
| AI prompt identifier updates | Low — string replacement in prompt files | Removes false inferences in AI-generated responses |
| Test rename | Mechanical; low risk | Assertion variables match domain terms; test failures are directly readable |

**Net assessment.** The highest-benefit / lowest-risk items are TypeScript types,
React component names, UI labels, AI prompts, and tests. The database table rename
(`scenes`) is the lowest-benefit / highest-risk item and should be deferred or
excluded from the initial convergence SPEC based on the Alias Acceptance Rule:
`scenes` retains partial inferability within its database layer context.

---

## Non-Goals

This ADR does **not**:

* Specify which files must be renamed or in what order.
* Define acceptance criteria for convergence completeness.
* Modify `governance/vocabulary/runtime-lexicon.md`.
* Change Runtime Truth v1 topology (ADR-004 remains authoritative).
* Mandate database table renames (to be decided by the implementation SPEC based
  on the Alias Acceptance Rule).
* Define localization (Chinese) equivalents for canonical terms (implementation
  SPEC responsibility).
* Address Editorial Domain vocabulary (ADR-005 governs that independently).
* Address Discovery candidate naming (governed by ADR-006 downstream SPECs).

---

## Legacy Alias Reference

*This ADR references Runtime vocabulary as defined in*
`governance/vocabulary/runtime-lexicon.md`.

| Normative Term | Legacy Term | Classification | Status under this ADR |
|---|---|---|---|
| Reading Route | Scene | Implementation Alias | Vocabulary Debt — fails IP-01 at TypeScript/component/UI layers; acceptable at DB layer only |
| Reading Frame | Story Image | Implementation Alias | Vocabulary Debt — fails IP-01 at all layers |
| Frame Narrative | caption | Documentation Alias | Acceptable — satisfies IP-01 |
| Route Synopsis | summary | Documentation Alias | Acceptable — satisfies IP-01 within context |
| Frame Narrative | imageCaption | Deprecated | Must not appear (lexicon §4 DR-04) |
| Reading Frame | Story Sequence (UI label) | Unregistered ad-hoc | Vocabulary Debt — must be replaced (VDC-INV-03) |
| Reading Frame | segment | Unregistered ad-hoc | Vocabulary Debt — must be replaced |
| Reading Frame / Reader Step | slide | Technical leakage | Vocabulary Debt — to be addressed in implementation SPEC |
