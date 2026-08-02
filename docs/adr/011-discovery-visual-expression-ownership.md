# ADR-011 — Discovery Visual Expression Ownership

**Status:** Accepted  
**Type:** Architecture ADR  
**Version:** 0.5  
**Last Updated:** 2026-08-02  
**Owner:** Architect  
**Related ADR:** ADR-006 (Discovery Copilot Architecture); ADR-010 (Image Runtime — Port / Creator ⊥ Reader; Deployment Local/Cloud remains replaceable)  
**Related SPEC:** `docs/specs/spec-dve-001-discovery-renderer-expression-contract.md` (**Contract Freeze** · **v1.4** · **Production Authorization scoped**)  
**Evidence:** Spike findings (local `docs/findings/`; runners under `scripts/*-spike/`); `scripts/rich-expression-projection-spike/`  
**Amendment A1 (2026-07-31):** Architecture Review — accept ownership boundary; refine D1 (renderer-executable form, Local-first capability orientation without model coupling); Visual Intent field presence optional by scene with quality-when-present.  
**Amendment A2 (2026-07-31):** SPEC-DVE-001 Contract Freeze Accepted.  
**Amendment A3 (2026-07-31):** Grant **scoped Production Authorization** for Creator-path Discovery Visual Intent + Renderer Expression → Image Port execution → Candidate (Human Accept → Assets). Constraints PA-A–PA-F. Does **not** authorize Planner/Adapter intelligence, frame-level Cloud-by-default, Reader generation, or auto-Accept.  
**Amendment A4 (2026-07-31):** Grant **Expression Capability Adaptation** (Discovery propose rules only): retain adaptation; tighten to **static visible geometry**; forbid complex physics motion cues in Expression; **MUST NOT** add AI layers; **MUST NOT** frame-level Cloud switch. Evidence: `capability-adaptation-v2-spike`.  
**Amendment A5 (2026-08-02):** **Runtime Truth v1 Freeze** — Visual Expression ⊥ Execution Projection. Canonical Visual Expression is provider-independent narrative-visible form; Local-first capability constraints belong to Execution Projection / Deployment, not Discovery authorship. Intent narrow-fold into Expression allowed (no second LLM). Paper freeze only — runtime cleanup Implementation Authorization **deferred**. Evidence: EAR Local-leak · Spike 2 `rich-expression-projection-spike` · Spike 3 boundary freeze.

> **Authorization note:** Architecture boundary **Accepted**; SPEC-DVE-001 **Contract Freeze (v1.4)** + **Production Authorization (scoped, A3)** + **Capability Adaptation (A4)** + **Expression ⊥ Projection (A5)**. Implementation MUST stay inside A3 allowlist / Constraints PA-A–PA-F, A4 Discovery authorship rules, and A5 Projection ownership. A5 does **not** by itself grant runtime cleanup code.

---

## What

This ADR freezes the **ownership boundary** for narrative visualization intelligence:

1. **Discovery** is the **single narrative intelligence boundary** for scene visualization meaning and **Canonical Visual Expression** (what should appear if the best renderer existed).
2. Discovery produces **two** outputs for visualization:
   - **Visual Intent** — narrative meaning (why the scene matters)
   - **Visual Expression** (aka Renderer Expression — transitional name) — provider-independent visible representation
3. **Execution Projection** (Deployment / Renderer runtime) adapts Expression to a specific renderer capability **deterministically** (no AI rewrite).
4. **Renderer** (Image Generation Port consumer path) consumes the **projected** Expression-derived generation input only and MUST NOT reinterpret story meaning from Visual Intent.

```text
Discovery
├── Visual Intent           (narrative meaning)
└── Visual Expression       (canonical visible form)
         ↓
Execution Projection        (Deployment / renderer capability)
         ↓
      Renderer → Candidate
```

`rendererExpression` remains an acceptable transitional identifier for Visual Expression in payloads and code until a rename grant.

This ADR does **not** freeze:

* Unrelated / wholesale schema redesign (A3 PA-F allows **minimal** Intent/Expression payload only)  
* Image provider / model selection (Deployment; ADR-010)  
* Queue / CPP redesign beyond Expression → existing Port wiring  
* Whole-route Cloud Deployment policies (distinct from rejected frame-level Cloud switching)  
* Dual persistence of `executionProjection` (Runtime Truth v1 = single persisted Expression + runtime projection)

---

## Why

Raree requires narrative visualization with **near-zero marginal generation cost** and **reading continuity**.

Approaches considered and tested via spikes:

| Approach | Outcome |
|----------|---------|
| Improve Local models alone | Insufficient for semantic relationships |
| Separate Gemini visual planner | Extra interpretation hop → semantic drift risk |
| Prompt / adapter intelligence layer | Moves narrative decisions into execution; drift |
| Frame-level Cloud fallback | Higher single-frame fidelity; **breaks visual consistency** |
| Local-shaped Expression fed to all renderers | Cloud quality rises; **narrative alignment capped** (Spike 2) |

Spike chain (evidence):

* `discovery-visual-intent-extension-spike` — Visual Intent preserves meaning better than caption-only  
* `renderer-boundary-validation-spike` — Local strong on environment/action; weak on abstract/precise multi-role geometry  
* `capability-adaptation-validation-spike` — Visible-expression adaptation expands Local coverage (hybrid, not Cloud-default)  
* `visual-consistency-adaptation-spike` — Optimize for consistent narrative visualization, not max single-frame quality  
* `discovery-expression-ownership-spike` — Discovery should own Expression; external adapter increases drift  
* `discovery-visual-expression-contract-spike` — Minimum Intent / Expression field split validated  
* `capability-adaptation-v2-spike` — Static visible geometry improves hard multi-char beats; complex physics cues worsen Local blank rate  
* `rich-expression-projection-spike` — Same Cloud model: Rich Expression ≫ Local-shaped Expression on narrative alignment; Rich→Local projection remains usable (non-blank)

Governing pressures: Convergence Before Expansion · Local-first Creator **economics via Deployment/Projection** · Runtime supremacy of a clear ownership boundary · **Weakest renderer MUST NOT define the product's visual language**.

---

## Decision

### D1 — Discovery owns narrative intelligence for visualization

Discovery is the **sole** architectural owner of:

* Narrative understanding relevant to scene visualization  
* Conversion of abstract relationships into **Canonical Visual Expression** — the provider-independent visible form answering: *if the best renderer existed, what should appear?*

Dependency direction MUST be:

```text
Discovery Contract
       ↓
Visual Expression (canonical)
       ↓
Execution Projection (Deployment / renderer capability)
       ↓
Renderer / Image Port
```

Discovery MUST NOT become coupled to a specific renderer implementation or model capability (e.g. SDXL / FLUX / LocalAI-specific blank avoidance) as Architecture.

**Local-first** Creator economics remain valid as **Deployment default and Execution Projection profiles** (ADR-010 · D4). They MUST NOT shrink Canonical Visual Expression authorship to the weakest renderer's prompt budget.

No independent **Planner**, **Adapter intelligence**, or **Prompt Optimizer intelligence** layer MAY sit between Discovery and Renderer for story meaning.

Execution Projection helpers (field join, length cap, field omit, blank guard, deterministic safety rewrites for a Deployment profile) are **not** narrative intelligence layers — and MUST NOT invent story meaning.

### D1a — Expression Capability Adaptation (A4) — authorship vs projection (A5 refine)

**Discovery authorship (A4 — remains):**

* Convert abstract relationships into **static visible geometry** (placement, pose, prop presence).  
* Prefer frozen stills of power/relationship over spectacular physics as **product continuity** cues when authored into Expression.  
* Face Safety product ceilings for Creator `scene_frame` (SPEC-DVE-001 Rule 6).  
* **MUST NOT** introduce a new AI call, Planner, Adapter, or Prompt Optimizer.  
* **MUST NOT** authorize frame-level Cloud switch for hard beats (PA-E / D4 remain).

**Execution Projection (A5 — not Discovery persist truth):**

* Prompt length caps, optional-field omit (e.g. drop `lighting` / `atmosphere` on Local profiles), dual-cast composition string overrides for Local face-safety blank avoidance, unsupported-cue downgrade, resolution / negatives.  
* MAY run at **execute time** against Canonical Expression.  
* MUST NOT overwrite persisted Canonical Expression as the sole stored truth with a Local-minimized rewrite.

Normative field / projection split: SPEC-DVE-001 v1.4. Runtime rule text today still mixes layers in `lib/discovery/expression-capability-rules.ts` — **cleanup Implementation Authorization deferred** (A5).

### D2 — Dual output: Visual Intent + Visual Expression

Discovery Result for visualization MUST be able to carry:

```text
Discovery Result
├── Visual Intent
│     characters? / roles?
│     relationship?
│     emotion? / purpose?
│
└── Visual Expression (rendererExpression transitional)
      environment
      characters[{ role, visual }]   (MAY be empty)
      action
      composition
      lighting? / styleHints?
      atmosphere? / threatPerception? / visualEmphasis?
```

**Visual Intent** represents narrative meaning (why the scene matters).  
**Visual Expression** represents canonical visible representation (what should be drawn).

These concepts MUST NOT be collapsed into a single ambiguous blob.

**Visual Intent field presence is optional by scene.** When a field is present, Discovery MUST maintain its semantic quality (**presence optional; quality mandatory when present**). Landscape / atmosphere scenes MAY omit `relationship` (null / absent). Relationship-bearing scenes SHOULD include a meaningful `relationship` when applicable.

Normative field semantics and validation live in **SPEC-DVE-001**.

### D2a — Intent narrow-fold (A5)

Visual Intent remains **non-input** to the Renderer / Image Port (PA-A).

Discovery MAY, within the **same authorship boundary** (no second LLM / Planner), deterministically fold selected Intent cues into Visual Expression fields — e.g. `emotion` → `atmosphere`, `relationship` / power → visible geometry or `visualEmphasis`, threat meaning → `threatPerception` + visible action.

Folding MUST NOT become a separate interpretation service.

### D3 — Renderer boundary

**Renderer MUST:**

* Consume **Visual Expression** (after Execution Projection) as the visualization generation input  
* Execute image generation via the Image Generation Port (ADR-010 / SPEC-IMG-001)

**Renderer MUST NOT:**

* Interpret story meaning from Visual Intent  
* Infer relationships not present as visible Expression  
* Rewrite narrative intent  
* Create independent visual plans

Visual Intent MAY be retained for editorial review / audit; it MUST NOT be required for image execution.

### D4 — Local-first continuity over frame-level quality spikes

Creator visualization strategy prefers:

```text
Most consistent narrative visualization
```

over:

```text
Highest quality individual frame via mid-sequence Cloud switch
```

Frame-level Cloud switching for “hard” frames is **rejected** as a default architecture pattern (see Rejected Alternatives). Whole-surface Deployment bindings remain ADR-010 Deployment concern.

**A5 clarify:** D4 constrains **Deployment / continuity policy**, not Canonical Expression authorship. Local-first defaults apply via Execution Projection profiles and surface Deployment, not by defining the product's visual language as Local-minimized Expression.

### D5 — Visual Expression ⊥ Execution Projection (A5)

| Layer | Owner | Persisted (v1) | May |
| ----- | ----- | -------------- | --- |
| Visual Expression | Discovery | **Yes** (canonical) | Define what should appear for any capable renderer |
| Execution Projection | Deployment / Renderer runtime | **No** (runtime; optional debug snapshot later) | Cap, omit, deterministic safety rewrite, size, negatives per profile |
| Visual Intent | Discovery | Yes (audit) | Meaning; narrow-fold into Expression; never Port input |

**Principle:** Discovery decides what the story should visually mean. Execution decides how a specific renderer can produce it. No renderer capability MAY become the product's visual language.

---

## Rejected Alternatives

### R1 — Independent Visual Planner

```text
Discovery meaning → Planner interpretation → Renderer prompt
```

**Rejected:** Second narrative interpretation layer; increases drift; duplicates Discovery responsibility.

### R2 — Prompt Optimizer intelligence layer

**Rejected:** Moves semantic decisions into the execution layer; expands AI workflow surface without ownership clarity.

### R3 — Frame-level Cloud fallback for difficult scenes

**Rejected:** Improves isolated fidelity; harms reading continuity (style / cast discontinuity across frames). Evidence: visual-consistency-adaptation-spike Strategy C.

### R4 — Local-shaped Expression as sole product language (A5)

**Rejected:** Feeding Local-minimized Expression to all renderers caps narrative alignment on high-capability models. Evidence: `rich-expression-projection-spike`.

---

## Consequences

### Positive

* Fewer transformation points for **story meaning**  
* Lower semantic drift  
* Local-first **economics** via Deployment / Projection without shrinking visual language  
* Predictable production cost narrative (no per-hard-frame Cloud tax by default)  
* Clear validation ownership (Discovery produces Canonical Expression; Projection adapts; Renderer executes)  
* Future Local ↔ Cloud swap is an **execution / Deployment** decision

### Negative / accepted costs

* Discovery remains responsible (meaning + canonical visible expression)  
* Runtime must migrate propose-time Local adapt-over-persist (deferred Implementation Grant)  
* Local Renderer capability limits remain visible at Projection — not a Planner revival  

### Follow-ons (need a new grant)

* Reader Runtime image generation  
* Frame-level Cloud switching as product default  
* Auto-Accept Candidates → Assets  
* Independent Planner / Adapter intelligence layers  
* **A5 runtime cleanup** (split capability rules; move adapt/caps to execute-time Projection; persist Canonical only)  
* Dual persistence of executionProjection snapshots  

---

## Production Authorization (scoped — A3)

**Authority:** Architect Decision 2026-07-31 — **GRANT WITH CONSTRAINTS (PA-A–PA-F)**  
**Normative detail:** SPEC-DVE-001 §13  
**A5 note:** Paper Runtime Truth v1 Freeze; cleanup Implementation Authorization **deferred**

### Authorized (Creator path)

```text
Discovery
  ├── Visual Intent
  └── Visual Expression (rendererExpression)
         ↓
Execution Projection (execute-time; Deployment profile)
         ↓
Image Generation Port (ADR-010 / SPEC-IMG-001)
         ↓
Candidate (Media Admission)
         ↓
Human Accept → Assets
```

### Constraints

| Id | Constraint |
| -- | ---------- |
| **PA-A** | Generation input derives from **Visual Expression only** (via Projection → prompt); MUST NOT read Visual Intent for generation |
| **PA-B** | No Planner / Adapter intelligence / Prompt Optimizer intelligence between Discovery and Renderer |
| **PA-C** | Candidate ≠ Asset until Human Accept (existing Media Admission / Asset authority) |
| **PA-D** | Creator Runtime only; Reader generation **denied** |
| **PA-E** | Frame-level Cloud-by-default for “hard” frames **denied** (ADR-011 D4 / R3); Deployment Local+Cloud fallback remains ADR-010 |
| **PA-F** | Minimal payload / staging extension for Intent+Expression **MAY** proceed; wholesale unrelated schema redesign **MUST NOT** |

### Production allowlist (MAY under A3)

* Discovery propose / scene visualization path emitting Visual Intent + Visual Expression (SPEC-DVE-001)  
* Creator Scene Frame draft / job input derived from Expression → existing Image Generation Port  
* Thin transport / **Execution Projection** (join / length / omit / blank-guard) without narrative rewrite — **execute-time** under A5  
* Minimal Candidate / staging fields required to carry Expression (scoped)  
* Existing Cloudinary Candidate upload + Human Accept paths  
* **A4:** Discovery Expression authorship rules (static geometry; Face Safety product ceiling; forbid complex physics as sole cues) — normative in SPEC-DVE-001; runtime file may still mix Projection until cleanup grant  

### Production denylist (MUST NOT under A3)

* Independent Visual Planner or Adapter intelligence services  
* Quality-spam `styleHints` / Prompt Optimizer layer  
* Mid-sequence frame-level Cloud switch as architecture default  
* Reader Runtime / `raree-show-web` generation hot path  
* Auto-Accept into Assets  
* Freezing any provider/model as Architecture  
* Treating Local blank-avoidance rewrites as Canonical Expression truth (A5)

---

## Compatibility

* **ADR-006:** Extends Discovery responsibility for visualization outputs; does not redefine Authority Emergence or Human Review.  
* **ADR-010 / SPEC-IMG-001:** Image Port / Deployment Local·Cloud remain; A3/A5 authorize Expression as Creator visualization **input**, Projection as Deployment adaptation — not a new Port or provider hierarchy.  
* **SPEC-D3-003:** Scene (or related) Candidate payloads MAY gain Intent/Expression under A3 PA-F; unrelated propose redesign remains out of scope.  
* **SPEC-DVE-001 v1.4:** Normative contract for Intent / Expression / Projection split and optional Expression fields.

---

## Frozen boundary (reminder) — Runtime Truth v1

```text
Discovery
├── Visual Intent         (meaning; audit; narrow-fold source)
└── Visual Expression     (canonical visible form)
         ↓
Execution Projection      (Deployment / renderer capability)
         ↓
      Renderer → Candidate
```

* Discovery decides what the story should visually mean.  
* Execution decides how a specific renderer can produce it.  
* No renderer capability may become the product's visual language.  
* Renderer does not reinterpret stories from Intent.  
* No Planner · No Adapter intelligence · No Prompt Optimizer intelligence.
