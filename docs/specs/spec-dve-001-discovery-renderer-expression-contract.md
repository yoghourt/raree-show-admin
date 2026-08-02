# SPEC-DVE-001 — Discovery Renderer Expression Contract v1

## Metadata

| Field | Value |
| ----- | ----- |
| Title | Discovery Renderer Expression Contract |
| Status | **Accepted — Contract Freeze** |
| Version | v1.4 |
| Owner | Architect |
| Last Updated | 2026-08-02 |
| Derived From | ADR-011 (Accepted · **A3** · **A4** · **A5**) · ADR-006 · ADR-010 (Port boundary; provider selection out of scope) |
| Evidence | discovery-expression-ownership-spike · discovery-visual-expression-contract-spike · capability-adaptation-v2-spike · face-coherence-portrait-ref-spike · face-safety-visual-expression-policy-spike · **rich-expression-projection-spike** |
| Contract Freeze | **Granted** |
| Production Authorization | **Granted (scoped)** — ADR-011 **A3** · Constraints PA-A–PA-F · §13 |
| Capability Adaptation | **Granted (A4)** — static visible geometry in Expression authorship; no new AI layer; no frame Cloud |
| Expression ⊥ Projection | **Granted (A5)** — Canonical Visual Expression vs Execution Projection; Local-first = Projection/Deployment |
| Face Safety (P1) | **Granted (Capability Rules Rule 6)** — Creator `scene_frame` face-visibility ceiling; no identity transfer |

> **Contract Freeze (v1.4) + scoped Production Authorization (A3) + Capability Adaptation (A4) + Expression ⊥ Projection (A5) + Face Safety Rule 6 (P1).** Implementation MAY wire Creator-path Discovery Expression → Execution Projection → Image Port → Candidate within §13 allowlist. Expression authorship answers “what should appear if the best renderer existed.” Local capability caps/omits belong to execute-time Projection. Contract Freeze ≠ unbounded Production Authorization. A5 runtime cleanup Implementation Authorization is **deferred**.

---

## 1. Purpose

Defines the **minimum Runtime Contract** for what Discovery hands toward the Renderer path for narrative scene visualization:

* **Producer:** Discovery  
* **Canonical payload:** Visual Expression (`rendererExpression` transitional name)  
* **Adaptation:** Execution Projection (Deployment / Renderer runtime — deterministic)  
* **Consumer:** Renderer Runtime (Image Generation Port execution path)

This SPEC freezes **ownership and field semantics**. It does not freeze providers, models, queues, CPP, or database schemas.

---

## 2. Contract ownership

| Role | Component |
| ---- | --------- |
| Producer | Discovery (single narrative intelligence boundary) |
| Canonical authority (visible form) | `visualExpression` / `rendererExpression` (Discovery) |
| Meaning authority (audit / fold source) | `visualIntent` (Discovery) |
| Capability adaptation | Execution Projection (Deployment profile — not Discovery persist truth) |
| Consumer | Renderer Runtime (via projected prompt) |

Renderer MUST receive generation input derived from **Visual Expression only** (after Projection).

Renderer MUST NOT consume `visualIntent` as generation input (PA-A).

`rendererExpression` is an acceptable transitional identifier for `visualExpression` until a rename grant.

---

## 3. Data boundary

```text
Discovery Result
├── visualIntent             ← editorial / audit meaning (NOT Port input)
└── visualExpression         ← Canonical visible form (rendererExpression alias)
         ↓
Execution Projection         ← Deployment profile (runtime; not dual-persisted in v1)
         ↓
      Renderer → Candidate
```

| Payload | Renderer may read for image gen? |
| ------- | -------------------------------- |
| Visual Expression (after Projection → prompt) | **Yes** |
| `visualIntent` | **No** |
| Raw Execution Projection object | N/A (v1: not a required persisted contract) |

### 3.1 Canonical vs Projection

| Concern | Canonical Visual Expression | Execution Projection |
| ------- | --------------------------- | -------------------- |
| Owner | Discovery | Deployment / Renderer runtime |
| Persisted (Runtime Truth v1) | **Yes** | **No** (computed at execute; optional debug later) |
| Purpose | What should appear if the best renderer existed | How this Deployment/renderer can produce it |
| May invent story meaning? | Discovery authorship only | **MUST NOT** |

**Transport / Projection** (string join, length cap, optional-field omit, blank guard, deterministic Local safety rewrites) MAY wrap Expression at **execute time**. It MUST NOT invent story meaning.

Projection MUST NOT overwrite persisted Canonical Expression as the sole stored truth with a Local-minimized rewrite (propose-time adapt-over-persist is **deprecated / must migrate** — cleanup grant deferred).

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

### 4.5 Intent narrow-fold (ADR-011 D2a)

Discovery MAY, in the **same authorship boundary** (no second LLM), deterministically fold Intent cues into Expression — e.g. `emotion` → `atmosphere`, threat/purpose → `threatPerception` / `visualEmphasis`, relationship → visible geometry. Renderer still MUST NOT read Intent.

---

## 5. Visual Expression (canonical contract)

Transitional payload key: `rendererExpression`.

### 5.1 Type shape (normative sketch)

```ts
type VisualExpression = {
  environment: string
  characters: Array<{
    role: string
    visual: string
  }>
  action: string
  composition: string
  /** Lighting intent (synonym: lighting). Not a model hyperparameter. */
  lighting?: string
  styleHints?: string
  atmosphere?: string
  threatPerception?: string
  visualEmphasis?: string
}

/** @deprecated transitional alias — same contract as VisualExpression */
type RendererExpression = VisualExpression
```

### 5.2 Required scalar fields

| Field | Semantics | Example |
| ----- | --------- | ------- |
| `environment` | Location / world context | `castle hall`, `snow mountain village`, `battlefield` |
| `action` | **Visible** action (verbs + objects) | `holding sword`, `hugging child`, `empty courtyard` |
| `composition` | Spatial / shot **intent** (canonical; Projection MAY rewrite for Local profiles at execute) | `foreground knight, background king`, `wide view of castle entrance` |

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
| `lighting` | Lighting **intent**; only if it improves narrative/render consistency. Synonym in prose: lightingIntent. |
| `styleHints` | Stable visual **consistency** constraints only; MUST NOT become a hidden Prompt Optimizer |
| `atmosphere` | Mood / air of the still (cold hush, dread, etc.) — narrative-visible cue |
| `threatPerception` | How threat should read visually (scale, wrong light, unseen pressure) |
| `visualEmphasis` | Narrative focus (formation, prop, scale contrast) |

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

Omit optional fields when unused. Discovery SHOULD author optional narrative-visible fields when they improve “best renderer” fidelity. Local Deployment profiles MAY omit them at **Projection** time — not by forbidding authorship.

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

Spatial arrangement **intent**. For multi-character scenes SHOULD describe relative placement. For empty-cast scenes MAY describe framing of place/objects.

Examples:

```text
foreground knight, background king
mother and child close together
two warriors facing each other
wide view of castle entrance
```

Execution Projection (Local profile) MAY replace or shorten composition at execute time for face-safety / blank avoidance. That rewrite MUST NOT become the only persisted Canonical value.

### 6.3 Forbidden patterns and layer split

#### Discovery authorship (Canonical Expression)

MUST NOT contain:

* Abstract-only relationships as the only action cue  
* Story interpretation instructions (“show loyalty”)  
* Hidden motivations  
* Second planner output blocks  
* Quality-spam `styleHints` (§5.4)  
* Complex physics / spectacular motion as **sole** cues (**A4 product continuity**): lifting, hoisting, mid-air choke, throwing, shattering into fragments, exploding, flying debris, large anonymous crowds  
* Unrestricted **full-face** scene presentation as default (**Rule 6**): close-up face, tight face fill, facing-camera portrait framing on `scene_frame`

**A4 preference:** static visible geometry (who / where / pose / prop) over cinematic physics.  
**Rule 6 preference:** for Creator `scene_frame`, face visibility ≤ `partial` (`hidden` | `back_view` | `distant` | `partial`). HIGH-risk beats (night, battlefield, crowd, monster/creature, heavy armor, blizzard) SHOULD use `hidden` or `distant`.

#### Execution Projection (Local / capability profiles)

MAY apply (execute-time only; no story invention):

* Prompt length caps  
* Omit optional fields (`lighting`, `atmosphere`, `styleHints`, …)  
* Deterministic composition safety strings for dual-cast Local face-safety  
* Unsupported-cue downgrade for a named Deployment profile  
* Size / negatives / blank-guard  

MUST NOT define Canonical Expression authorship as “Local-minimized only.”

Runtime rule text today: `lib/discovery/expression-capability-rules.ts` (mixed layers until cleanup grant).

### 6.4 Face Safety capability (Rule 6) — Creator scene_frame

Controlled vocabulary (presentation only; encoded in Expression strings in P1 — no required new schema field):

```ts
type FaceVisibility =
  | "hidden"
  | "back_view"
  | "distant"
  | "partial"
  | "full"
```

| Track | Default ceiling | Notes |
| ----- | --------------- | ----- |
| `scene_frame` | ≤ `partial` | `full` is restricted; needs explicit override + Human Accept |
| `portrait` | `full` allowed | Portrait rail unchanged; Rule 6 does **not** apply |

Discovery owns authorship of safe presentation. Renderer executes Expression only and MUST NOT infer narrative meaning or inject portrait references.

Policy assessment shape (execution / Accept advisory):

```json
{
  "safety_status": "allowed | requires_human_review | restricted",
  "reason": "full_face_scene_expression"
}
```

No computer-vision face detector is required. Human Accept remains final authority for Assets.

---

## 7. Validation rules (before Renderer execution)

1. `environment`, `action`, and `composition` exist and are non-empty.  
2. `characters` is an array (length MAY be `0`).  
3. When `characters.length > 0`, each item has non-empty `role` and `visual`; `composition` SHOULD describe multi-figure placement.  
4. `action` is visually executable (not abstract-only; see §6.1).  
5. Empty / blank Expression MUST trigger rejection or blank-guard (no silent render).  
6. Visual Intent fields are optional by scene; when present, Discovery owns semantic quality. Renderer MUST NOT “fix” Intent by inventing meaning.  
7. **Face Safety (Rule 6):** unrestricted full-face scene cues MUST be rejected at Discovery propose; before Port execution, assess Expression and attach `faceSafety` for Human Accept. `restricted` without explicit override MUST NOT call Image Port. Portrait jobs MUST skip this gate.

Validation ownership:

| Check | Owner |
| ----- | ----- |
| Intent + Expression authorship quality | Discovery |
| Face Safety Rule 6 authorship + propose hard-gate | Discovery |
| Expression required-field / blank guard / Face Safety assess before Port | Renderer Runtime (or Execution Projection) |
| Story reinterpretation | **Forbidden** for Renderer / Projection |
| Asset Accept | Human |

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
    "composition": "foreground knight, background king",
    "atmosphere": "tense loyalty under threat",
    "visualEmphasis": "raised sword and protective placement"
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
    "composition": "wide view of castle entrance",
    "atmosphere": "eerie stillness",
    "lighting": "cold moonlight, deep courtyard shadow"
  }
}
```

Renderer generation input = Visual Expression after Execution Projection only.

---

## 9. Field ownership table (normative summary)

| Concern | Visual Intent | Visual Expression | Execution Projection |
| ------- | ------------- | ----------------- | -------------------- |
| Relationship meaning | Optional by scene; quality when present | Visible poses / optional emphasis | No |
| Emotion / purpose | Optional; quality when present | Via narrow-fold → atmosphere / emphasis | No |
| Atmosphere | No (fold source may be emotion) | Optional `atmosphere` | MAY omit (Local profile) |
| Threat perception | Optional narrative source | Optional `threatPerception` | MAY omit / shorten |
| Visual emphasis | No | Optional `visualEmphasis` | MAY omit / shorten |
| Character role | Optional by scene | Yes when cast non-empty (`role` link) | No |
| Pose / props / appearance | No | Yes (`visual`) when cast non-empty | MAY hardCap length |
| Environment | No | Yes | MAY hardCap length |
| Composition / camera intent | No | Yes (canonical intent) | MAY rewrite for Local safety at execute |
| Lighting intent | No | Optional `lighting` | MAY omit |
| Style consistency family | No | Optional `styleHints` (stable only) | MAY omit |
| Max prompt length / unsupported cues | No | **MUST NOT** encode as product language | **Yes** (profile) |
| Provider / model / resolution | No | No | Deployment (ADR-010) |

---

## 10. Out of scope

| Topic | Owner |
| ----- | ----- |
| Image provider / model selection | Deployment · ADR-010 |
| Projection profile tables (Local vs Cloud knobs) | Deployment (not frozen provider IDs) |
| Cloud fallback / routing strategy | Deployment (not frame-level Cloud-by-default; see ADR-011) |
| Model evaluation benchmarks | Spikes / Deployment |
| Prompt optimizer intelligence | **Rejected** (ADR-011) |
| Queue / job envelope | Generate-jobs / CPP specs |
| CPP integration | SPEC-CPP-001 |
| Dual persistence of `executionProjection` | Future grant (not Runtime Truth v1) |
| Production Candidate schema migration beyond PA-F minimal fields | Needs new grant |
| Asset Accept / `story_images_v2` | Existing Asset authority (Human Accept; A3 PA-C) |
| A5 runtime cleanup (split rules file; move adapt off persist) | **Deferred Implementation Grant** |

---

## 11. Evidence reference

* `docs/findings/discovery-expression-ownership-spike.md` (gitignored local findings tree)  
* `docs/findings/discovery-visual-expression-contract-spike.md`  
* Runners: `scripts/discovery-expression-ownership-spike/` · `scripts/discovery-contract-spike/` · **`scripts/rich-expression-projection-spike/`**

---

## 12. Authorization states

Per `POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC` three-state model:

| State | SPEC-DVE-001 |
| ----- | ------------ |
| Contract Freeze | **Granted** (this SPEC Accepted · **v1.4**) |
| Spike Implementation Authorization | Completed (evidence spikes including rich-expression-projection) |
| Production Authorization | **Granted (scoped)** → ADR-011 **A3** · Constraints PA-A–PA-F · §13 |
| A5 runtime cleanup | **Deferred** — needs Implementation Grant |

Contract Freeze checklist:

- [x] Architecture Review of ADR-011 ownership (Accepted)  
- [x] Renderer MUST NOT read `visualIntent`  
- [x] Expression `characters` MAY be empty  
- [x] Intent presence-optional / quality-when-present  
- [x] `styleHints` anti-optimizer constraint  
- [x] Visual Expression ⊥ Execution Projection (A5)  
- [x] Optional atmosphere / threatPerception / visualEmphasis (PA-F minimal)

---

## 13. Production Authorization (granted — scoped, A3)

**Authority:** ADR-011 Amendment **A3** · Architect Decision 2026-07-31 — GRANT WITH CONSTRAINTS (PA-A–PA-F)  
**A5:** Paper Runtime Truth v1 Freeze; execute-time Projection ownership clarified; cleanup Implementation Authorization deferred.

### 13.1 Authorized path

```text
Discovery → Visual Intent + Visual Expression
                ↓
     Execution Projection (execute-time; Deployment profile)
                ↓
     (Expression-derived prompt only) → Image Generation Port
                ↓
            Candidate
                ↓
     Human Accept → Assets
```

### 13.2 Constraints (normative)

| Id | Rule |
| -- | ---- |
| **PA-A** | Generation input derives from Visual Expression only (via Projection); MUST NOT read Intent |
| **PA-B** | No Planner / Adapter intelligence / Prompt Optimizer intelligence |
| **PA-C** | Candidate ≠ Asset until Human Accept |
| **PA-D** | Creator Runtime only; Reader generation denied |
| **PA-E** | Frame-level Cloud-by-default denied; Deployment Local+Cloud fallback per ADR-010 |
| **PA-F** | Minimal Intent/Expression payload extension MAY proceed; unrelated schema redesign MUST NOT |

### 13.3 Production allowlist (MAY)

* Discovery propose / scene visualization emitting Intent + Expression  
* Creator Scene Frame draft / generate-job input built from Expression → existing Port  
* **Execution Projection** at execute time (join / length / omit / blank-guard) without narrative rewrite  
* Minimal staging / Candidate fields to carry Expression  
* Existing Cloudinary Candidate + Human Accept wiring  

### 13.4 Production denylist (MUST NOT)

* Independent Visual Planner or Adapter intelligence services  
* Quality-spam `styleHints` / Prompt Optimizer layer  
* Mid-sequence frame-level Cloud switch as product default  
* Reader Runtime generation hot path  
* Auto-Accept into Assets  
* Freezing provider/model IDs in this Contract  
* Treating Local blank-avoidance rewrites as Canonical Expression truth (A5)

### 13.5 Deprecated until cleanup grant

* Propose-time / persist-time Local adapt that **overwrites** Canonical Expression as the only stored form  
* Hardcoding Local prompt caps as the sole Expression→prompt path for all Deployments  

### 13.6 Implementation note

Production Authorization **permits** implementation inside §13.3. It does **not** by itself ship code. Implementers MUST preserve PA-A–PA-F, ADR-011 D1–D5, and this SPEC v1.4. A5 runtime cleanup requires a separate Implementation Grant.
