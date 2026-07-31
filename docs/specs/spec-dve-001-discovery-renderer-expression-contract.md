# SPEC-DVE-001 — Discovery Renderer Expression Contract v1

## Metadata

| Field | Value |
| ----- | ----- |
| Title | Discovery Renderer Expression Contract |
| Status | **Accepted — Contract Freeze** |
| Version | v1.0 |
| Owner | Architect |
| Last Updated | 2026-07-31 |
| Derived From | ADR-011 (Accepted) · ADR-006 · ADR-010 (Port boundary; provider selection out of scope) |
| Evidence | discovery-expression-ownership-spike · discovery-visual-expression-contract-spike |
| Contract Freeze | **Granted** |
| Production Authorization | **Not granted** |

> **Contract Freeze granted.** Architecture ownership (ADR-011) and this Runtime Contract are frozen. Do **not** migrate production schemas or wire Runtime until **Production Authorization** is granted separately. Contract Freeze ≠ Production Authorization.

---

## 1. Purpose

Defines the **minimum Runtime Contract** for what Discovery hands to the Renderer path for narrative scene visualization:

* **Producer:** Discovery  
* **Consumer:** Renderer Runtime (Image Generation Port execution path)

This SPEC freezes **ownership and field semantics**. It does not freeze providers, models, queues, CPP, or database schemas.

---

## 2. Contract ownership

| Role | Component |
| ---- | --------- |
| Producer | Discovery (single narrative intelligence boundary) |
| Consumer | Renderer Runtime |
| Authority for meaning | `visualIntent` (Discovery) |
| Authority for execution input | `rendererExpression` (Discovery) |

Renderer MUST receive **only** `rendererExpression` for image generation.

Renderer MUST NOT consume `visualIntent` as generation input.

---

## 3. Data boundary

```text
Discovery Result
├── visualIntent          ← editorial / audit meaning (NOT rendered)
└── rendererExpression    ← ONLY input to Renderer
         ↓
      Renderer → Candidate
```

| Payload | Renderer may read for image gen? |
| ------- | -------------------------------- |
| `rendererExpression` | **Yes** |
| `visualIntent` | **No** |

Transport-only formatting (string join, length cap, blank guard) MAY wrap Expression. It MUST NOT invent story meaning.

---

## 4. Visual Intent (producer-side meaning — not Renderer input)

Informative companion to Expression. Normative for Discovery authorship; **non-input** to Renderer.

### 4.1 Type shape

```ts
type CharacterRole = {
  role: string
  name?: string
}

type VisualIntent = {
  characters?: CharacterRole[]
  relationship?: string | null
  emotion?: string
  purpose?: string
}
```

### 4.2 Presence vs quality

| Rule | Meaning |
| ---- | ------- |
| **Presence optional** | Fields MAY be omitted or null by scene (e.g. landscape: `relationship` absent/null) |
| **Quality mandatory when present** | If a field exists, Discovery owns its semantic correctness |

Valid relationship-bearing Intent:

```json
{ "relationship": "knight protects king" }
```

Valid landscape Intent (no relationship):

```json
{ "relationship": null }
```

### 4.3 Field semantics (when present)

| Field | Semantics |
| ----- | --------- |
| `characters[].role` | Story role (not costume) |
| `characters[].name` | Editorial label; MUST NOT be required for render |
| `relationship` | Narrative relationship meaning |
| `purpose` | Why the moment matters |
| `emotion` | Affect label |

### 4.4 Forbidden in Visual Intent

* Camera / shot language  
* Composition / foreground-background as Intent fields  
* Prompt or style tokens  
* Renderer-implementation-specific wording  

---

## 5. Renderer Expression (execution contract)

### 5.1 Type shape (normative sketch)

```ts
type RendererExpression = {
  environment: string
  characters: Array<{
    role: string
    visual: string
  }>
  action: string
  composition: string
  lighting?: string
  styleHints?: string
}
```

### 5.2 Required scalar fields

| Field | Semantics | Example |
| ----- | --------- | ------- |
| `environment` | Location / world context | `castle hall`, `snow mountain village`, `battlefield` |
| `action` | **Visible** action (verbs + objects) | `holding sword`, `hugging child`, `empty courtyard` |
| `composition` | Spatial reading aid | `foreground knight, background king`, `wide view of castle entrance` |

### 5.3 `characters` — MAY be empty

`characters` is always present as an array and **MAY be empty**.

Not every visualization contains characters. Allowed for landscape, architecture, object, or atmosphere frames:

```json
{
  "environment": "abandoned castle at night",
  "characters": [],
  "action": "empty courtyard",
  "composition": "wide view of castle entrance"
}
```

When non-empty, each item MUST include:

| Field | Semantics |
| ----- | --------- |
| `role` | Links to Intent role when possible |
| `visual` | Visible pose / props / appearance |

### 5.4 Optional fields

| Field | Constraint |
| ----- | ---------- |
| `lighting` | Only if it improves rendering consistency |
| `styleHints` | Stable visual **consistency** constraints only; MUST NOT become a hidden Prompt Optimizer |

#### `styleHints` allow / forbid

**Allowed** (stable style family):

```text
watercolor storybook style
dark fantasy illustration
```

**Forbidden** (quality-spam / optimizer bait):

```text
best quality
masterpiece
8k
ultra detailed
```

Omit optional fields when unused.

---

## 6. Field semantics (normative)

### 6.1 `action` — visible only

**Allowed:** holding sword · hugging child · fighting opponent · walking through forest · empty courtyard  

**Forbidden as sole cue:** protecting · betraying · trusting · leading  

Abstract relationships MUST be converted into visible behavior before Expression.

Forbidden:

```text
knight protects king
```

Allowed:

```text
knight standing in front of king with sword raised
```

### 6.2 `composition`

Spatial arrangement. For multi-character scenes SHOULD describe relative placement. For empty-cast scenes MAY describe framing of place/objects.

Examples:

```text
foreground knight, background king
mother and child close together
two warriors facing each other
wide view of castle entrance
```

### 6.3 Forbidden patterns in Renderer Expression

MUST NOT contain:

* Abstract-only relationships as the only action cue  
* Story interpretation instructions (“show loyalty”)  
* Hidden motivations  
* Second planner output blocks  
* Quality-spam `styleHints` (§5.4)  

---

## 7. Validation rules (before Renderer execution)

1. `environment`, `action`, and `composition` exist and are non-empty.  
2. `characters` is an array (length MAY be `0`).  
3. When `characters.length > 0`, each item has non-empty `role` and `visual`; `composition` SHOULD describe multi-figure placement.  
4. `action` is visually executable (not abstract-only; see §6.1).  
5. Empty / blank Expression MUST trigger rejection or blank-guard (no silent render).  
6. Visual Intent fields are optional by scene; when present, Discovery owns semantic quality. Renderer MUST NOT “fix” Intent by inventing meaning.

Validation ownership:

| Check | Owner |
| ----- | ----- |
| Intent + Expression authorship quality | Discovery |
| Expression required-field / blank guard before Port call | Renderer Runtime (or thin transport) |
| Story reinterpretation | **Forbidden** for Renderer |

---

## 8. Example JSON

### 8.1 Relationship scene

```json
{
  "visualIntent": {
    "characters": [
      { "role": "knight", "name": "Young Knight" },
      { "role": "king", "name": "Old King" }
    ],
    "relationship": "knight protects king",
    "emotion": "tension",
    "purpose": "show loyalty under threat"
  },
  "rendererExpression": {
    "environment": "stone castle hall",
    "characters": [
      {
        "role": "knight",
        "visual": "standing in foreground holding a raised sword"
      },
      {
        "role": "king",
        "visual": "standing behind the knight"
      }
    ],
    "action": "knight in defensive posture facing outward",
    "composition": "foreground knight, background king"
  }
}
```

### 8.2 Atmosphere / no cast

```json
{
  "visualIntent": {
    "relationship": null,
    "purpose": "establish place and mood"
  },
  "rendererExpression": {
    "environment": "abandoned castle at night",
    "characters": [],
    "action": "empty courtyard",
    "composition": "wide view of castle entrance"
  }
}
```

Renderer input = `rendererExpression` only.

---

## 9. Field ownership table (normative summary)

| Concern | Visual Intent | Renderer Expression |
| ------- | ------------- | ------------------- |
| Relationship meaning | Optional by scene; quality when present | No (show as poses) |
| Emotion / purpose | Optional; quality when present | No |
| Character role | Optional by scene | Yes when cast non-empty (`role` link) |
| Pose / props / appearance | No | Yes (`visual`) when cast non-empty |
| Environment | No | Yes |
| Composition / camera hints | No | Yes |
| Style consistency family | No | Optional `styleHints` (stable only; not optimizer spam) |

---

## 10. Out of scope

| Topic | Owner |
| ----- | ----- |
| Image provider / model selection | Deployment · ADR-010 |
| Cloud fallback / routing strategy | Deployment (not frame-level Cloud-by-default; see ADR-011) |
| Model evaluation benchmarks | Spikes / Deployment |
| Prompt optimizer intelligence | **Rejected** (ADR-011) |
| Queue / job envelope | Generate-jobs / CPP specs |
| CPP integration | SPEC-CPP-001 |
| Production Candidate schema migration | Future Production Authorization |
| Asset Accept / `story_images_v2` | Existing Asset authority |

---

## 11. Evidence reference

* `docs/findings/discovery-expression-ownership-spike.md` (gitignored local findings tree)  
* `docs/findings/discovery-visual-expression-contract-spike.md`  
* Runners: `scripts/discovery-expression-ownership-spike/` · `scripts/discovery-contract-spike/`

---

## 12. Authorization states

Per `POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC` three-state model:

| State | SPEC-DVE-001 |
| ----- | ------------ |
| Contract Freeze | **Granted** (this SPEC Accepted) |
| Spike Implementation Authorization | Completed (evidence spikes; not a production path) |
| Production Authorization | **Not granted** |

Contract Freeze checklist (closed):

- [x] Architecture Review of ADR-011 ownership (Accepted)  
- [x] Renderer MUST NOT read `visualIntent`  
- [x] Expression `characters` MAY be empty  
- [x] Intent presence-optional / quality-when-present  
- [x] `styleHints` anti-optimizer constraint  

Before Production Authorization / Runtime wiring:

- [ ] Explicit Production Authorization grant  
- [ ] Schema / Candidate payload migration plan (if any)  
- [ ] Creator frame path wiring plan (Discovery Expression → Port)
