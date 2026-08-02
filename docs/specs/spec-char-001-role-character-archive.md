# SPEC-CHAR-001 — Role Character Archive Capability (MVP)

## Metadata

| Field | Value |
| ----- | ----- |
| Title | Role Character Archive Capability |
| Status | **Implemented (MVP)** |
| Version | v1.0 |
| Owner | Architect |
| Last Updated | 2026-08-01 |
| Derived From | ADR-011 · SPEC-DVE-001 · Character Archive MVP Spike |
| Evidence | `docs/findings/character-archive-mvp-spike.md` · `docs/findings/character-archive-capability-implementation.md` |
| Related | SPEC-D3-003 (character / scene propose) · Face Safety Rule 6 (unchanged) |

> **MVP scope:** Character Archive is a **Role capability** inside Discovery. No independent entity, no DB table, no management UI, no face identity transfer.

---

## 1. Purpose

Enable Discovery to understand and express a Role through **stable visual identity cues** (costume, props, silhouette symbols).

This SPEC does **not**:

- create a character database
- create a face identity system
- generate prompts outside Renderer Expression
- replace narrative understanding (`visualIntent`)
- replace Face Safety policy

---

## 2. Ownership model

```text
Work
 └── Role                    ← Discovery character candidate (editorial)
      └── Character Archive  ← optional Role capability (not a peer entity)
```

| Rule | Normative |
| ---- | --------- |
| Character Archive belongs to Role | **MUST** |
| Character Archive as independent entity / table | **MUST NOT** |
| Renderer consumes Character Archive objects | **MUST NOT** |
| Discovery selects cues into `rendererExpression` | **MUST** |

TypeScript shape (conceptual):

```ts
interface Role {
  id: string
  name: string
  characterArchive?: CharacterArchive
}

interface CharacterArchive {
  visualSummary?: string
  costumeCues: string[]
  propCues: string[]
}
```

In this MVP, Role ≈ Discovery `character` candidate (`fields.characterArchive`).

---

## 3. Character Archive schema

| Field | Type | Semantics |
| ----- | ---- | --------- |
| `visualSummary` | `string?` | Stable visual thesis (narrative meaning). Not dumped wholesale into Expression. |
| `costumeCues` | `string[]` | Clothing / silhouette cues (short phrases). |
| `propCues` | `string[]` | Iconic props / symbols that travel with the Role. |

### 3.1 Stable vs dynamic boundary

| Character Archive **MAY** describe | Character Archive **MUST NOT** describe |
| ---------------------------------- | --------------------------------------- |
| Clothing style, iconic props | Current scene action |
| Visual symbols, recognizable silhouette | Emotional state / temporary conditions |
| Stable identity cues across scenes | Camera decisions, close-up language |
| | Face-ref / InstantID / IP-Adapter / LoRA / `ref_images` |

Dynamic scene meaning stays in `visualIntent` + Expression `action` / `composition`.

---

## 4. Cue budget rules

When Discovery folds archive → Expression, enforce:

| Cap | Value |
| --- | ----- |
| Costume cues active | ≤ 2 |
| Prop cues active | ≤ 1 |
| Additional visual cue | optional (within total) |
| Total active cues per figure | ≤ 3 (hard cap in MVP implementation) |

**Reason:** Long cue dumps overload Local renderer prompts and may blank (`character-archive-mvp-spike`).

Authored archive lists MAY be longer than the active budget; only budgeted cues enter Expression.

---

## 5. Discovery integration

### 5.1 Correct flow

```text
Story Understanding
        ↓
Discovery
        ↓
Role Understanding
        ├── Character Archive     (stable cues)
        ├── Current Scene Context
        └── Visual Intent
        ↓
Renderer Expression   ← budgeted characterCues in characters[].visual
        ↓
Renderer              ← Expression only
```

### 5.2 Integration rules

1. Discovery **authors** optional `fields.characterArchive` on character candidates.
2. Discovery **selects** relevant cues for the scene; MUST NOT copy all archive fields.
3. Folded cues land in `rendererExpression.characters[].visual` as short fragments.
4. `visualIntent` MUST NOT carry archive dumps for Port consumption.
5. Face Safety Rule 6 (SPEC-DVE-001) remains authoritative for face visibility; archive does not override it.
6. Deterministic post-parse fold MAY append missing budgeted cues when Role name matches Expression `characters[].role`.

### 5.3 Expression selection example

**Role archive (Ned):**

```json
{
  "visualSummary": "Northern lord shaped by honor and winter",
  "costumeCues": ["dark northern fur cloak", "wool noble attire"],
  "propCues": ["ancestral greatsword"]
}
```

**Scene Expression (selected cues only):**

```json
{
  "environment": "winter godswood",
  "characters": [
    {
      "role": "Eddard Stark",
      "visual": "bearded northern man, dark northern fur cloak, ancestral greatsword"
    }
  ],
  "action": "lord stands before weirwood, face partially obscured",
  "composition": "medium shot, figure mid-frame"
}
```

Face visibility / geometry remain Expression + Face Safety concerns — not archive fields.

---

## 6. Out of scope (MVP)

- Character Archive table / migration
- Character management UI / CRUD
- Face embeddings, portrait reference URLs
- InstantID / IP-Adapter / LoRA
- Renderer architecture or provider selection changes
- Replacing Face Safety policy

---

## 7. Acceptance criteria

| Domain | Criterion |
| ------ | --------- |
| Ownership | Character Archive belongs to Role; no independent entity |
| Architecture | Discovery produces/uses archive; Renderer receives Expression only |
| Identity | No facial identity transfer |
| Quality | Cue budget prevents prompt overload; Face Safety unchanged |

---

## 8. Implementation map (this repo)

| Concern | Location |
| ------- | -------- |
| Types + parse + budget + fold | `lib/discovery/character-archive.ts` |
| Character candidate field | `lib/discovery/propose-types.ts` → `CharacterCandidateFields.characterArchive` |
| Validate + scene fold helper | `lib/discovery/candidate-validate.ts` |
| Propose prompts + batch/regen fold | `lib/discovery/propose-service.ts` |
| Expression contract (unchanged consumer) | SPEC-DVE-001 / `lib/discovery/visual-contract.ts` |
