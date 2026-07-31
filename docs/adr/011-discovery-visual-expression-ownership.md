# ADR-011 — Discovery Visual Expression Ownership

**Status:** Accepted  
**Type:** Architecture ADR  
**Version:** 0.4  
**Last Updated:** 2026-07-31  
**Owner:** Architect  
**Related ADR:** ADR-006 (Discovery Copilot Architecture); ADR-010 (Image Runtime — Port / Creator ⊥ Reader; Deployment Local/Cloud remains replaceable)  
**Related SPEC:** `docs/specs/spec-dve-001-discovery-renderer-expression-contract.md` (**Contract Freeze** · **Production Authorization scoped**)  
**Evidence:** Spike findings (local `docs/findings/`; runners under `scripts/*-spike/`)  
**Amendment A1 (2026-07-31):** Architecture Review — accept ownership boundary; refine D1 (renderer-executable form, Local-first capability orientation without model coupling); Visual Intent field presence optional by scene with quality-when-present.  
**Amendment A2 (2026-07-31):** SPEC-DVE-001 Contract Freeze Accepted.  
**Amendment A3 (2026-07-31):** Grant **scoped Production Authorization** for Creator-path Discovery Visual Intent + Renderer Expression → Image Port execution → Candidate (Human Accept → Assets). Constraints PA-A–PA-F. Does **not** authorize Planner/Adapter intelligence, frame-level Cloud-by-default, Reader generation, or auto-Accept.  
**Amendment A4 (2026-07-31):** Grant **Expression Capability Adaptation** (Discovery propose rules only): retain adaptation; tighten to **static visible geometry**; forbid complex physics motion cues in Expression; **MUST NOT** add AI layers; **MUST NOT** frame-level Cloud switch. Evidence: `capability-adaptation-v2-spike`.

> **Authorization note:** Architecture boundary **Accepted**; SPEC-DVE-001 **Contract Freeze** + **Production Authorization (scoped, A3)** + **Capability Adaptation (A4)**. Implementation MUST stay inside A3 allowlist / Constraints PA-A–PA-F and A4 Expression rules.

---

## What

This ADR freezes the **ownership boundary** for narrative visualization intelligence:

1. **Discovery** is the **single narrative intelligence boundary** for scene visualization meaning and renderer-executable visual form.
2. Discovery produces **two** outputs for visualization:
   - **Visual Intent** — narrative meaning
   - **Renderer Expression** — renderer-executable visible representation
3. **Renderer** (Image Generation Port consumer path) **consumes Renderer Expression only** and MUST NOT reinterpret story meaning.

```text
Discovery
├── Visual Intent          (narrative meaning)
└── Renderer Expression    (executable visual representation)
         ↓
      Renderer  →  Candidate
```

This ADR does **not** freeze:

* Unrelated / wholesale schema redesign (A3 PA-F allows **minimal** Intent/Expression payload only)  
* Image provider / model selection (Deployment; ADR-010)  
* Queue / CPP redesign beyond Expression → existing Port wiring  
* Whole-route Cloud Deployment policies (distinct from rejected frame-level Cloud switching)

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

Spike chain (evidence):

* `discovery-visual-intent-extension-spike` — Visual Intent preserves meaning better than caption-only  
* `renderer-boundary-validation-spike` — Local strong on environment/action; weak on abstract/precise multi-role geometry  
* `capability-adaptation-validation-spike` — Visible-expression adaptation expands Local coverage (hybrid, not Cloud-default)  
* `visual-consistency-adaptation-spike` — Optimize for consistent narrative visualization, not max single-frame quality  
* `discovery-expression-ownership-spike` — Discovery should own Expression; external adapter increases drift  
* `discovery-visual-expression-contract-spike` — Minimum Intent / Expression field split validated  
* `capability-adaptation-v2-spike` — Static visible geometry improves hard multi-char beats; complex physics cues worsen Local blank rate

Governing pressures: Convergence Before Expansion · Local-first Creator economics · Runtime supremacy of a clear ownership boundary.

---

## Decision

### D1 — Discovery owns narrative intelligence for visualization

Discovery is the **sole** architectural owner of:

* Narrative understanding relevant to scene visualization  
* Conversion of abstract relationships into **renderer-executable visual form**, optimized for the **current Local-first runtime capability** (as Renderer Expression)

Dependency direction MUST be:

```text
Discovery Contract
       ↓
Current Renderer Capability
       ↓
Execution
```

Discovery MUST NOT become coupled to a specific renderer implementation or model capability (e.g. SDXL / FLUX / LocalAI-specific behavior as Architecture).

No independent **Planner**, **Adapter intelligence**, or **Prompt Optimizer intelligence** layer MAY sit between Discovery and Renderer for story meaning.

Transport-only helpers (field join, length cap, blank guard) are **not** narrative intelligence layers.

### D1a — Expression Capability Adaptation (A4)

Discovery propose MAY apply **capability adaptation rules** inside Renderer Expression authorship:

* Convert abstract relationships into **static visible geometry** (placement, pose, prop presence).  
* Prefer frozen stills of power/relationship over spectacular physics.  
* **MUST NOT** use complex physics motion as sole cues (lift / hoist / mid-air choke / shatter-into-fragments / throw / explode / flying debris / anonymous crowds).  
* **MUST NOT** introduce a new AI call, Planner, Adapter, or Prompt Optimizer.  
* **MUST NOT** authorize frame-level Cloud switch for hard beats (PA-E / D4 remain).

Normative rule text: `lib/discovery/expression-capability-rules.ts` · SPEC-DVE-001 §6.3.

### D2 — Dual output: Visual Intent + Renderer Expression

Discovery Result for visualization MUST be able to carry:

```text
Discovery Result
├── Visual Intent
│     characters? / roles?
│     relationship?
│     emotion? / purpose?
│
└── Renderer Expression
      environment
      characters[{ role, visual }]   (MAY be empty)
      action
      composition
      lighting? / styleHints?
```

**Visual Intent** represents narrative meaning (why the scene matters).  
**Renderer Expression** represents executable visual representation (what the Renderer draws).

These concepts MUST NOT be collapsed into a single ambiguous blob.

**Visual Intent field presence is optional by scene.** When a field is present, Discovery MUST maintain its semantic quality (**presence optional; quality mandatory when present**). Landscape / atmosphere scenes MAY omit `relationship` (null / absent). Relationship-bearing scenes SHOULD include a meaningful `relationship` when applicable.

Normative field semantics and validation live in **SPEC-DVE-001**.

### D3 — Renderer boundary

**Renderer MUST:**

* Consume **Renderer Expression** as the visualization execution input  
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

---

## Consequences

### Positive

* Fewer transformation points  
* Lower semantic drift  
* Local-first architecture compatible with Creator cost goals  
* Predictable production cost narrative (no per-hard-frame Cloud tax by default)  
* Clear validation ownership (Discovery produces; Renderer executes Expression)

### Negative / accepted costs

* Discovery becomes more responsible (meaning + executable expression)  
* Renderer capability limits remain visible (e.g. multi-role geometry) — handled by Expression quality + Deployment policy, not by inventing a Planner  
* Local Renderer capability limits remain visible; Expression quality + Deployment policy address them — not a Planner revival

### Follow-ons (outside A3 — need a new grant)

* Reader Runtime image generation  
* Frame-level Cloud switching as product default  
* Auto-Accept Candidates → Assets  
* Independent Planner / Adapter intelligence layers  

---

## Production Authorization (scoped — A3)

**Authority:** Architect Decision 2026-07-31 — **GRANT WITH CONSTRAINTS (PA-A–PA-F)**  
**Normative detail:** SPEC-DVE-001 §13

### Authorized (Creator path)

```text
Discovery
  ├── Visual Intent
  └── Renderer Expression
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
| **PA-A** | Renderer consumes **Renderer Expression only**; MUST NOT read Visual Intent for generation |
| **PA-B** | No Planner / Adapter intelligence / Prompt Optimizer intelligence between Discovery and Renderer |
| **PA-C** | Candidate ≠ Asset until Human Accept (existing Media Admission / Asset authority) |
| **PA-D** | Creator Runtime only; Reader generation **denied** |
| **PA-E** | Frame-level Cloud-by-default for “hard” frames **denied** (ADR-011 D4 / R3); Deployment Local+Cloud fallback remains ADR-010 |
| **PA-F** | Minimal payload / staging extension for Intent+Expression **MAY** proceed; wholesale unrelated schema redesign **MUST NOT** |

### Production allowlist (MAY under A3)

* Discovery propose / scene visualization path emitting Visual Intent + Renderer Expression (SPEC-DVE-001)  
* Creator Scene Frame draft / job input derived from Expression → existing Image Generation Port  
* Thin transport (join / length / blank-guard) without narrative rewrite  
* Minimal Candidate / staging fields required to carry Expression (scoped)  
* Existing Cloudinary Candidate upload + Human Accept paths  
* **A4:** Discovery propose Expression capability adaptation rules (static geometry; forbid complex physics cues) — `lib/discovery/expression-capability-rules.ts`  

### Production denylist (MUST NOT under A3)

* Independent Visual Planner or Adapter intelligence services  
* Quality-spam `styleHints` / Prompt Optimizer layer  
* Mid-sequence frame-level Cloud switch as architecture default  
* Reader Runtime / `raree-show-web` generation hot path  
* Auto-Accept into Assets  
* Freezing any provider/model as Architecture  

---

## Compatibility

* **ADR-006:** Extends Discovery responsibility for visualization outputs; does not redefine Authority Emergence or Human Review.  
* **ADR-010 / SPEC-IMG-001:** Image Port / Deployment Local·Cloud remain; A3 authorizes Expression as Creator visualization **input**, not a new Port or provider hierarchy.  
* **SPEC-D3-003:** Scene (or related) Candidate payloads MAY gain Intent/Expression under A3 PA-F; unrelated propose redesign remains out of scope.

---

## Frozen boundary (reminder)

```text
Discovery
├── Visual Intent        (meaning)
└── Renderer Expression  (execution form)
         ↓
      Renderer → Candidate
```

* Discovery decides visual meaning.  
* Renderer executes expression.  
* Renderer does not reinterpret stories.  
* No Planner · No Adapter intelligence · No Prompt Optimizer intelligence.
