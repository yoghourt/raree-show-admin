# Runtime Lexicon v2

**Authority:** ADR-BP-RT-001 — Runtime Vocabulary Migration Blueprint  
**Status:** Normative  
**Version:** 2.0  
**Supersedes:** Inline definitions in ADR-004 §Runtime Truth v1 Topology (legacy vocabulary)  
**Established:** ADR-RFC-RT-001 → ADR-RFC-RT-002 → ADR-RFC-RT-003 → AST-RT-001 → ADR-BP-RT-001  

---

> **This document is the single normative authority for Runtime vocabulary.**
>
> All ADRs and SPECs must reference these definitions.
> No ADR or SPEC may define Runtime vocabulary independently after this document is in effect.
> Legacy terms may appear only as Implementation Alias or Documentation Alias — never as normative architecture language.

---

## 1. Normative Vocabulary Registry

### RV-01 — Work

| Field | Value |
| ----- | ----- |
| **Normative Vocabulary** | Work |
| **Legacy Alias** | Work (unchanged) |
| **Implementation Symbol** | `works` table |
| **Architectural Responsibility** | Reading corpus root. All Reading Routes belong to one Work. The Work boundary defines the scope for all Runtime navigation. |
| **Reader-facing Definition** | The work you are reading. |

---

### RV-02 — Reading Route

| Field | Value |
| ----- | ----- |
| **Normative Vocabulary** | Reading Route |
| **Legacy Alias** | Scene |
| **Implementation Symbol** | `scenes` table; `scene_` TSID prefix; `scenes.tsid` as business key |
| **Architectural Responsibility** | The only routable reading container in Runtime Truth v1. Defines the navigation boundary. Carries Chapter Metadata as descriptive fields. Contains an ordered sequence of Reading Frames. |
| **Reader-facing Definition** | A navigable section of the work. |
| **Migration Note** | Vocabulary Update from Scene (ADR-RFC-RT-001 Evaluation B: Misleading; ADR-BP-RT-001 Task 2). |

---

### RV-03 — Route Synopsis

| Field | Value |
| ----- | ----- |
| **Normative Vocabulary** | Route Synopsis |
| **Legacy Alias** | summary (Scene-level) |
| **Implementation Symbol** | `scenes.summary` column |
| **Architectural Responsibility** | Optional container-level narrative prose attached to a Reading Route. Does not substitute for Frame Narrative as the reader progression carrier. Classified `narrative` in the field registry (SPEC-CORE-001 §4.3.4). |
| **Reader-facing Definition** | An optional overview of what this section covers. |
| **Migration Note** | Documentation Alias from summary (ADR-BP-RT-001 Task 2). |

---

### RV-04 — Reading Frame

| Field | Value |
| ----- | ----- |
| **Normative Vocabulary** | Reading Frame |
| **Legacy Alias** | Story Image |
| **Implementation Symbol** | Element of `story_images_v2` JSONB array; stored as `{ url, caption }` |
| **Architectural Responsibility** | One ordered, non-routable narrative-visual unit inside a Reading Route. Consists of a visual reference (`url`) and a Frame Narrative (`caption`). Reading Frames are not independent routable entities. Classified `asset` as a collection in the field registry (SPEC-CORE-001 §4.3.4). |
| **Reader-facing Definition** | One step in reading a section. |
| **Migration Note** | Vocabulary Update from Story Image (ADR-RFC-RT-001 Evaluation B: Misleading — "Story" conflates with Editorial Story; ADR-BP-RT-001 Task 2). |

---

### RV-05 — Frame Narrative

| Field | Value |
| ----- | ----- |
| **Normative Vocabulary** | Frame Narrative |
| **Legacy Alias** | caption; `imageCaption` (ADR-004 §Decision 3 historical field name — Deprecated) |
| **Implementation Symbol** | `story_images_v2[].caption` field |
| **Architectural Responsibility** | The narrative prose attached to each Reading Frame. The primary text carrier for reader progression within a Reading Route. Classified `narrative` in the field registry (ADR-004 §Decision 3). |
| **Reader-facing Definition** | The narrative text accompanying each step. |
| **Migration Note** | Documentation Alias from caption. `imageCaption` is Deprecated — must not appear in new ADR/SPEC text (ADR-BP-RT-001 Task 2). |

---

### RV-06 — Reader Step

| Field | Value |
| ----- | ----- |
| **Normative Vocabulary** | Reader Step |
| **Legacy Alias** | (none — new normative concept) |
| **Implementation Symbol** | Element returned by `effectiveStorySlidesFromV2`; gate condition: `url.length > 0` |
| **Architectural Responsibility** | The minimum effective progression unit for the Reader. Equal to a Reading Frame that has passed the visual reference gate. Reading Frames without a visual reference are not Reader Steps. Defined by SPEC-D2-001 §Web Visibility Constraint. |
| **Reader-facing Definition** | A published step that can be read. |
| **Migration Note** | New normative concept. Fills naming gap for the gated frame unit previously unnamed in normative vocabulary (ADR-BP-RT-001 Task 2). |

---

### RV-07 — Chapter Metadata

| Field | Value |
| ----- | ----- |
| **Normative Vocabulary** | Chapter Metadata |
| **Legacy Alias** | chapter metadata; chapter fields |
| **Implementation Symbol** | `chapter_number`, `chapter_title` columns on `scenes` table |
| **Architectural Responsibility** | Descriptive organisational fields on a Reading Route. Not a separate navigation layer in Runtime Truth v1. Source First fields (SPEC-CORE-001 §4.3.4). |
| **Reader-facing Definition** | Chapter number and title from the original work. |
| **Migration Note** | No semantic change. Term formalised in this registry. |

---

## 2. Runtime Truth v1 Topology (Normative)

```text
Work                                    [RV-01]
 └─ Reading Route                       [RV-02]  ← routable navigation boundary
      ├─ Route Synopsis (optional)      [RV-03]
      ├─ Chapter Metadata               [RV-07]
      └─ Reading Frame (ordered)        [RV-04]  ← non-routable
           └─ Frame Narrative           [RV-05]

Reader Step = Reading Frame [ url gate passed ]  [RV-06]
```

**Implementation symbol map (informational only):**

```text
Work             →  works table
Reading Route    →  scenes table / scene_ TSID
Route Synopsis   →  scenes.summary
Reading Frame    →  story_images_v2[] element
Frame Narrative  →  story_images_v2[].caption
Reader Step      →  effectiveStorySlidesFromV2 element
Chapter Metadata →  chapter_number, chapter_title
```

---

## 3. Legacy Alias Reference

| Normative Term | Legacy Term | Classification | Status |
| -------------- | ----------- | -------------- | ------ |
| Reading Route | Scene | Implementation Alias | Active — appears only as `(implementation: Scene)` notation |
| Reading Frame | Story Image | Implementation Alias | Active — appears only as `(implementation: Story Image)` notation |
| Frame Narrative | caption | Documentation Alias | Active — implementation field name |
| Route Synopsis | summary | Documentation Alias | Active — implementation column name |
| Frame Narrative | imageCaption | Deprecated | Must not appear in new ADR/SPEC text |
| Reader Step | (none) | — | New concept; no legacy alias |

---

## 4. Documentation Authoring Rules (Summary)

For full rules see ADR-BP-RT-001 §Task 6.

**DR-01** — Normative vocabulary (RV-01 ~ RV-07) is mandatory in ADR/SPEC definitions, Glossary sections, architecture diagrams, invariants, and acceptance criteria.

**DR-02** — When an implementation symbol appears in a normative document, the first occurrence must use the format: `Reading Route (implementation: scenes)`.

**DR-03** — Every ADR/SPEC that defines or revises Runtime vocabulary must include a §Legacy Alias Reference section matching the format in §3 above.

**DR-04** — `imageCaption` must not appear in new ADR/SPEC text. `Scene` and `Story Image` may appear only within `(implementation: X)` notation.

**DR-05** — Architecture diagrams in ADRs use normative vocabulary. Implementation diagrams in SPECs may use implementation symbols with a legend note.

**DR-06** — The following disclaimer forms are retired and must not appear in new documents:
- "Scene ≠ narrative scene"
- "Story Image (despite the name)"
- "Scene is a routable unit (not a narrative scene)"

---

## 5. Vocabulary Selection Principles Reference

Vocabulary in this lexicon was selected using VSP-01 ~ VSP-09 as established in ADR-RFC-RT-003 and validated by adversarial testing in AST-RT-001. For the full principle set and scoring evidence see those documents.

---

## 6. Governance Chain

```text
Constitution
  └─ ADR-004 (Runtime Truth v1 topology — unchanged)
       └─ ADR-RFC-RT-001 (vocabulary no longer faithful)
            └─ ADR-RFC-RT-002 (Reading Route Model selected)
                 └─ ADR-RFC-RT-003 (VSP-01~09 established)
                      └─ AST-RT-001 (β survives adversarial test)
                           └─ ADR-BP-RT-001 (migration blueprint)
                                └─ Runtime Lexicon v2 (this document)
```
