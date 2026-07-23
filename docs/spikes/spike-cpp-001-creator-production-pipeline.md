# SPIKE-CPP-001 — Creator Production Pipeline Discovery

**Status:** Architecture Discovery **Complete** · Architect **Accepted (Direction B+)** (2026-07-21)  
**Production Authorization:** **Not granted** (discovery only; implementation not authorized)  
**Contract Freeze:** Responsibility boundaries → `docs/specs/spec-cpp-001-creator-production-pipeline.md` (**Accepted** 2026-07-21)  
**Authority:** Architect · evidence package for CPP scope decision  
**Depends on:** `docs/findings/production-workflow-audit.md` (2026-07-21)  
**Last Updated:** 2026-07-21

---

## What

Authorize an **architecture-discovery-only** Spike that determines whether Raree Show should evolve from an **Image Generation Workflow** into a **Content Production Pipeline (CPP)**, and where that pipeline’s architectural boundary should sit.

This Spike produces **evidence and recommendations**. It does **not** implement CPP, amend ADRs, or modify Runtime / Deployment / Discovery / Rollout code.

---

## Why

The Production Workflow Audit established Runtime Truth for operator wall-clock on a lean showcase work (Path B):

| Category | Share of wall-clock |
| -------- | ------------------: |
| AI Generation wait | **~14%** |
| Human Operations | **~83%** |
| Non-AI System Wait | **~3%** |

**Implication:** Optimizing model latency alone cannot achieve:

> One operator reliably produces one complete work within one working day.

The dominant bottleneck is the **production workflow** (navigation, Accept→persist round-trips, incomplete-asset hunting, serial UI, manual frame fill) — not Image Generation Port throughput.

Working hypothesis under test:

> Creator will become a **Content Production OS**, not an AI image admin.  
> If true, **CPP is the third core Creator capability** after **Discovery** and **Rollout**.

---

## Authorization states (do not collapse)

| State | This Spike |
| ----- | ---------- |
| Contract Freeze | **None** (no new ADR / SPEC freeze) |
| Spike Discovery Authorization | **GRANTED** by this document |
| Spike Implementation Authorization | **Not granted** |
| Production Authorization | **Not granted** |

---

## Goal

Answer Architect decision questions with evidence:

1. What is the correct **Production Unit**?
2. What is the correct **Creator / CPP Runtime boundary**?
3. What is the **smallest viable CPP**?
4. Does CPP require a **Queue**, **Workflow Engine**, **Task Graph**, or something else?
5. Which implementation direction delivers the **highest ROI** toward 1 work / operator / day?

Additionally: research how mature **content production systems** (not AI-image toys) define Job / Task / Review / Completion.

---

## Allowlist / Denylist

### Allowlist

| Artifact | Purpose |
| -------- | ------- |
| `docs/spikes/spike-cpp-001-*.md` | This Spike + Findings |
| Read-only analysis of Admin / Discovery / Rollout / Image docs | Evidence |

### Denylist (MUST NOT)

* Implement CPP code, queues, workers, or schema  
* Introduce / amend ADR or Runtime Contract  
* Redesign Discovery, Rollout, Deployment, or Image Port  
* Authorize scene-frame AI generation (still A3 Constraint B)  
* Change Reader Runtime  

---

## Evidence baseline (Runtime observations)

Source: `docs/findings/production-workflow-audit.md` unless noted.

| Observation | Evidence |
| ----------- | -------- |
| No Publish button; DB persistence ≈ live for Reader | Admin routes + Story Structure exit criteria |
| Path B: Discovery → CRUD → Rollout (captions) → manual frame URLs | Workflow map |
| Only A3-authorized AI image path: character portrait | ADR-010 A3 Constraint B |
| Rollout writes frames with `url=""` | `lib/rollout/reading-frame-persist.ts` |
| Local portrait warm P50 ≈ 35.5s | SPIKE-IMG-002 |
| Lean showcase wall-clock ≈ 5 h; stretch 8–12 h | Audit §§5–6 |
| Top bottlenecks: frame fill, serial portraits, Accept→Save, missing work cockpit, unbounded retry | Audit §7 |
| Showcase complete shape | 8 chars · 6 locs · 8–10 routes · 16–20 frames (`pd-showcase-recommendation-v1`) |

---

## Research · Modern creative production systems

**Method:** Extract **Job / Task / Review / Completion** abstractions — not UI patterns to copy.  
**Lens:** Does the product behave as a **Content Production OS** (orchestrate incomplete → complete work) or as a **generation console** (fire one prompt at a time)?

### Comparative matrix

| System | Primary unit | Scheduling / progress unit | Review model | Completion signal | Relevance to Raree |
| ------ | ------------ | -------------------------- | ------------ | ----------------- | ------------------ |
| **Linear** | **Issue** | Team workflow states (`triage`→`backlog`→`unstarted`→`started`→`completed`); **Project** groups issues toward a deliverable | Comments + status categories (e.g. In Review as `started`) | Issue in `completed` category; Project progress = % completed issues | Strongest analogy: Work≈Project, Production Task≈Issue |
| **GitHub Projects** | **Item** (Issue / PR / draft) | Status single-select + views (board/roadmap); built-in status automations | Review lives on PR/Issue; Project tracks status | Status → Done (+ optional close Issue) | Workboard + incomplete queue without a heavy engine |
| **Figma** | **File / Frame** (asset) | Phases across surfaces: FigJam (ideate) → Design → **Dev Mode “Ready for dev”** | Multiplayer critique + comments; readiness is explicit handoff | Marked ready for consumption by next role | Discovery≈ideate; CPP≈produce+mark ready; Reader≈consume published |
| **Notion AI** | **Page / Database row** | Database properties + views; AI fills cells; humans confirm | AI draft ≠ published page truth | Human publishes / accepts properties | Copilot/Discovery pattern: suggest → human gate → persist |
| **Adobe Firefly Creative Production** | **Workflow run / bulk job** | Workflow Builder + batch asset pipelines; human-in-the-loop approvals | Explicit approval steps; audit who approved | Workflow run finished + assets delivered to DAM | Closest “production OS” for creative ops at scale |
| **Midjourney** | **Job** (queued/running) | Account job queue (`/info`); grid → Upscale / Vary as child jobs | Human selects U/V; Remix continues lineage | Upscaled/saved asset chosen by human | Image **Job** ≠ Work completion; good for gen sub-tasks only |
| **ComfyUI** (task-flow only) | **Workflow graph** + queue prompts | Graph defines dependency; queue executes nodes | Operator inspects outputs per run | Queue item done / artifacts written | Dependency graph for *generation*; overkill as Work OS |

### Abstraction patterns (portable)

Mature systems repeatedly separate **four layers**:

```text
1. Deliverable / Project     → “what must be done by when”     (Work)
2. Task / Issue / Item       → “atomic schedulable unit”       (Production Task)
3. Job / Run                 → “async execution of capability” (Generate Portrait job)
4. Asset / Artifact          → “accepted truth in store”       (portrait_url, story_images_v2)
```

And they separate **roles of time**:

| Phase | Meaning | Examples |
| ----- | ------- | -------- |
| Intake / Triage | Decide whether work exists | Linear Triage; Discovery Propose+Review |
| Plan | Commit scope | Project/Cycle; showcase subset counts |
| Produce | Execute tasks / jobs | Firefly bulk; Midjourney queue; portrait gen |
| Review | Human gate | Figma critique; Linear In Review; Asset Accept |
| Complete | Deliverable done | Project % complete; Dev Mode ready; DAM delivery |

**Anti-pattern observed in AI-first tools:** collapsing (1)–(4) into a single “Generate” button. That matches today’s Raree portrait UX — and explains why AI is only ~14% of the day while humans chase the other layers.

### Thesis check — Content Production OS?

| Claim | Verdict from research + audit |
| ----- | ----------------------------- |
| Creator is primarily an image-gen admin | **False** for day-level ROI (83% human ops) |
| Creator needs a workboard + task lifecycle around incomplete assets | **Supported** (Linear/GH Projects/Firefly pattern) |
| Creator needs a full Comfy-style node engine as the OS | **Unsupported** for MVP; graph is a *job* concern |
| Discovery + Rollout + CPP as three capabilities | **Plausible**: Intake (Discovery) · Persist narrative (Rollout) · Drive incomplete→complete (CPP) |
| Midjourney Job model alone is sufficient CPP | **No** — Jobs cover generation, not Work completion |

---

## Discovery Questions

### Q1 — What is the correct Production Unit?

#### Candidates

| Unit | What it schedules well | What it fails at |
| ---- | ---------------------- | ---------------- |
| **Character** | Portrait loops; identity consistency | Ignores frame-heavy critical path; Work still incomplete |
| **Reading Route / Story** | Caption + frame bundles; Rollout write | Orphan characters/locations; no whole-work % |
| **Reading Frame** | Empty-url queue (largest asset count) | Too fine; floods board; loses narrative context |
| **Work** | Matches product goal “1 work / day”; progress % | Too coarse to schedule GPU/upload actions |
| **Production Task** (typed, targets an entity) | Schedules heterogeneous work under one Work | New abstraction cost |

#### Trade-offs (do not freeze)

1. **Work as completion unit** maps cleanly to Linear **Project** and to the product goal. Progress = f(required tasks complete), not “last button clicked.”
2. **Production Task as scheduling unit** maps to Linear **Issue** / GH **Item**. Types: `complete_character`, `fill_frame_images`, `write_story`, `review_assets`, …
3. **Entity units alone** (Character / Route) recreate today’s siloed CRUD and miss cross-cutting “what’s left for this Work?”
4. **Frame as only unit** optimizes bottleneck #1 but cannot express portrait / Discovery gates.

#### Spike recommendation (directional → **Architect-refined B+**)

| Role | Unit |
| ---- | ---- |
| **Deliverable unit** | **Work** — product-level what must be completed |
| **Completion / progress / strategy unit** | **Production Plan** — how a Work reaches completion (checklist, progress, metrics) |
| **Scheduling / actionable unit** | **Production Task** (typed; references Character / Location / Route / Frame) — derived from Assets whenever possible |
| **Execution unit** | **Job** (generate / upload / adapter invoke) — infrastructure, not business progress |

Do **not** replace Character/Scene domain models — they remain Assets. CPP projects **Plans and Tasks over Assets**; Assets remain canonical Runtime Truth.

---

### Q2 — Where is the true workflow boundary?

#### Lifecycle map (evidence-aligned)

```text
[Outside CPP]
  Source text / Source Profile
        ↓
DISCOVERY          Intake + Candidate Review
  lock → propose → accept/regen (human judgment)
        ↓
PLANNING (thin today)   Scope a showcase subset (often implicit)
        ↓
ROLLOUT            Persist narrative structure
  write story + captions (+ empty urls allowed)
        ↓
CPP / ASSET PRODUCTION   Drive incomplete → complete Assets
  portraits · frame urls · bindings polish · retries
        ↓
REVIEW             Human Accept into Assets (Constraint D)
        ↓
COMPLETION         Work checklist green (showcase-complete)
        ↓
[Outside Creator production]
READER RUNTIME     Consume published URLs/rows only
```

#### Boundary table

| Concern | Inside Creator Runtime? | Inside proposed CPP? | Outside |
| ------- | ----------------------- | -------------------- | ------- |
| Narrative Candidate Propose/Review | Yes (Discovery) | **No** — sibling capability; CPP *consumes* accepts | — |
| Story / caption persist | Yes (Rollout) | **No** — sibling; may *emit* incomplete-frame tasks | — |
| Incomplete-asset inventory & next-action | Today: implicit / missing | **Yes — core** | — |
| Portrait generate Job | Yes (Image Port call) | **Yes — as task execution** | — |
| Provider Local/Cloud choice | Deployment Adapter | **Invoked when Job runs** (see Q6) | Not Architecture freeze |
| Reader navigation / plaques | No | No | Reader Runtime |
| DAM / public CDN policy beyond Cloudinary URLs | Deployment / ops | Optional later | — |
| Multiplayer editorial org | Future | Future CPP | — |

#### Where Creator Runtime begins / ends

| Edge | Definition |
| ---- | ---------- |
| **Begins** | Authenticated operator acts on a Work to produce or curate Assets (Admin authoring surface per ADR-010 A2) |
| **Ends** | Assets required for the chosen completion definition are persisted; Reader can consume without generation |
| **CPP begins** | After (or interleaved with) Discovery/Rollout outputs exist as Candidates or rows with **known incompleteness** |
| **CPP ends** | Work completion checklist satisfied (not merely “last Rollout write succeeded”) |

**Key boundary statement:**  
Discovery answers “what might belong.” Rollout answers “narrative structure is written.” **CPP answers “the Work is production-complete.”** Image Generation is a **capability inside** CPP tasks — not the pipeline itself.

---

### Q3 — Which human decisions are essential?

Classification of production steps (audit step catalog + policy):

| Step | Class | Rationale |
| ---- | ----- | --------- |
| Narrative lock / attestation | **Human Judgment** | Source authority; irreversible editorial commit |
| Candidate Accept / Edit / Regen decision | **Human Judgment** | SPEC-D3; no catalog Accept-All |
| Showcase scope (which 8 chars / 10 scenes) | **Human Judgment** | Taste + portfolio intent |
| Portrait Accept into Assets | **Human Judgment** | ADR-010 Constraint D |
| Frame image Accept (when AI exists later) | **Human Judgment** | Visual brand; today = choose upload |
| Map focus placement | **Human Confirmation** | Light spatial intent; defaults possible |
| Copilot field Accept | **Human Confirmation** | Suggest≠truth |
| Rollout bindings review | **Human Confirmation** | Auto-resolve exists; showcase needs check |
| Trigger Propose | **Human Confirmation** | Start expensive LLM; policy gate |
| Trigger portrait Job | **Human Confirmation** today → can become auto-enqueue after Confirm | Cost/latency gate |
| Cloudinary upload after bytes exist | **Fully Automatic** | Already on AI path |
| Reader-evidence read-back | **Fully Automatic** | Integrity check |
| Persist form Save | **Human Confirmation** today | Could merge with Accept (still confirmation) |
| RAG backfill | **Background Automation** | Optional quality; not completion gate |
| Provider failover Local→Cloud | **Background Automation** | Deployment Adapter |
| Technical retries on provider errors | **Background Automation** | Partial today (SiliconFlow) |
| Empty-url frame detection | **Background Automation** (missing today) | Derive tasks from DB truth |
| Navigation between `/works` hubs | Neither — **waste** | Should become system-derived next task |

**Rule of thumb:**  
**Judgment** = irreversible taste/authority.  
**Confirmation** = approve a prepared default.  
**Automatic** = no taste.  
**Background** = no operator in the loop for the mechanic.

---

### Q4 — What is a Production Task?

#### Today’s center of gravity

```text
Generate Portrait  (Server Action + form dirty URL + Save)
```

This is a **Job-shaped** interaction pretending to be the whole pipeline.

#### Proposed abstraction (discovery)

```text
Production Task
  id
  work_id
  type            // e.g. complete_character | fill_route_frames | write_story | review_work
  target_ref      // char_ / loc_ / scene_ / frame index
  state           // triage | ready | in_progress | in_review | done | canceled
  blocker_of      // optional dependency (soft)
  completion_rule // e.g. portrait_url non-empty; all frame urls non-empty
```

**Job** (narrower) remains:

```text
Job = execution of a capability (generate_portrait, upload_batch, …)
     invoked by a Task when state = in_progress
```

#### Does a unified task abstraction simplify Creator Runtime?

| Argument for | Argument against |
| ------------ | ---------------- |
| One Work board replaces hunting empty urls + missing portraits | New concept alongside Discovery Candidates + Rollout staging |
| Heterogeneous bottlenecks share one lifecycle (Linear pattern) | Over-modeling CRUD (e.g. rename character) as tasks adds noise |
| Enables % complete toward 1 work/day | Risk of building a second Jira inside Admin |
| Separates Task (why) from Job (how/Deployment) | Requires careful derivation from DB to avoid dual truth |

**Spike finding:** Yes — **as an orchestration layer over existing Assets**, not as a replacement domain model. Dual truth is avoided if Tasks are **derived or projected** from Asset incompleteness (+ explicit review tasks), with Assets remaining canonical (ADR-004 posture).

---

### Q5 — Is Queue actually required?

Do **not** assume queues. Map needs → mechanism:

| Need from audit | Minimal mechanism | Queue? | Workflow engine? | State machine? | Task graph? |
| --------------- | ----------------- | ------ | ---------------- | -------------- | ----------- |
| See what’s left on a Work | Workboard / derived task list | No | No | Task **state** enum yes | Soft deps optional |
| Serial portrait idle time | Async Job runner + UI non-blocking | **Maybe later** | No | Job state | No |
| Batch uploads | Client multi-file + progress | No | No | No | No |
| Accept→persist without navigation | Command API / same-page actions | No | No | No | No |
| Long-running Local GPU batches | Job queue (in-process or worker) | **Yes if batch** | No | Job state | Fan-out graph optional |
| Discovery→Rollout→CPP ordering | Documented phase conventions + gates | No | **Not for MVP** | Work phase optional | Light DAG only if hard blockers |
| Enterprise approvals / audit | Engine territory (Firefly-like) | Possibly | **Future** | Yes | Yes |

#### Answer

| Horizon | Required backbone |
| ------- | ----------------- |
| **Minimal CPP (highest ROI)** | **Task list + state machine categories** (Linear-style) + **derived incompleteness** — **no** durable queue, **no** workflow engine, **no** Comfy-style graph |
| **When portrait/frame Jobs become non-blocking / batch** | Add a **Job queue** (execution substrate) **under** Tasks — still not a full workflow engine |
| **When multi-operator approvals & compliance matter** | Revisit workflow engine (Firefly Creative Production class) |

**Natural fit:** **State machine over Production Tasks** (+ optional later Job queue).  
**Not natural for MVP:** workflow engine or heavy task graph.

---

### Q6 — Where should Deployment Profile participate?

Current topology (ADR-010 / Deployment Defaults):

```text
Creator Runtime → Deployment Profile → Local | Cloud
```

#### Options

| Placement | Meaning | Fit |
| --------- | ------- | --- |
| **Before Production Task** | Choose provider when planning the board | Premature; tasks shouldn’t freeze vendor |
| **Inside Production Task** | Task type encodes Local vs Cloud | Couples product tasks to Deployment — **rejects Architecture layering** |
| **After scheduling / at Job execution** | Task says `generate_portrait`; Job binds Deployment Adapter | **Matches A2/A3** |

#### Recommendation

```text
Work
 └─ Production Task (domain intent)
      └─ Job (capability invoke)
           └─ Deployment Adapter → Local | Cloud fallback
```

* Scheduling and Review stay **Deployment-agnostic**.  
* Only **generation/upload Jobs** read Deployment Profile.  
* Changing Local↔Cloud must not rewrite task boards (replaceable Deployment).

---

### Q7 — What is the minimal CPP?

**Objective:** Remove largest operational bottlenecks **without** redesigning Discovery, Rollout, Image Port, or Deployment.

#### ROI-ordered slice (MVP CPP)

| Priority | Capability | Bottleneck attacked | Approx. complexity |
| -------: | ---------- | ------------------- | ------------------ |
| 1 | **Production Plan** Runtime object for a Work — completion definition, checklist, progress % (UI may later show a Production Board) | #4 hunting + goal clarity | S–M |
| 2 | **Derived Production Tasks** — missing portrait, empty frame url, missing cover, unbound route | #4 navigation | S–M |
| 3 | **Incomplete Frames path** — deep-link + **batch upload** for empty urls (Jobs under Tasks) | #1 frame fill (non-AI) | M |
| 4 | **Character complete Task** — Accept/prefill **persist without full-page detour**; optional Generate→Accept→Save | #3 Accept→Save | M |
| 5 | **Non-blocking portrait Job** — continue other Tasks while Job runs | #2 serial idle | M (may need light Job queue) |

**Explicitly out of minimal CPP**

* Scene-frame AI generation (needs new Production Authorization beyond A3)  
* Replacing Discovery or Rollout  
* Workflow engine / Comfy graph OS  
* Multiplayer / org roles  
* Hard Budget USD enforcement  
* Naming UI “Work Production Board” as Architecture — board is UI; **Production Plan** is Runtime  

#### Minimal shape diagram (B+)

```text
Work  (deliverable)
  └─ Production Plan  (completion definition · progress · checklist · strategy)
        └─ Derived Production Tasks  (actionable units)
              └─ Jobs  (execution only)
                    └─ Deployment Adapter → Local | Cloud
                          └─ Assets  (canonical Runtime Truth)
```

#### Expected impact (directional, from audit)

| Slice | Estimated wall-clock effect on lean ~5 h day |
| ----- | -------------------------------------------- |
| Board + deep links | −15–25 min |
| Batch frame upload | −20–40 min |
| Accept→persist shortcuts | −15–30 min |
| Non-blocking portrait Jobs | Convert ~32 min blocked wait → overlapped productive time |
| **Combined MVP** | Lean day → **~3–3.5 h**; stretch days still helped on predictability |

Enough to make **1 work / day reliable** for lean showcase; stretch variant-heavy days still need later policy (variants, optional frame AI grant).

---

## Candidate architectures

### A — Status Quo + faster models

Keep Generate Portrait as center; tune Local/Cloud latency.

| Pros | Cons |
| ---- | ---- |
| No new abstraction | Addresses ≤~14% of day; fails target reliability |

### B — Derived Tasks under Work (Spike original MVP)

Work + Production Task board derived from Asset incompleteness (no Plan layer).

| Pros | Cons |
| ---- | ---- |
| Hits 83% human-ops mass | Progress/checklist/strategy lack a home; Work too coarse, Tasks too fine |

### B+ — Production Plan + derived Tasks (**Architect Accepted**)

Insert **Production Plan** between Work and Tasks; UI board visualizes Plan, does not define Runtime.

| Pros | Cons |
| ---- | ---- |
| Completion progress, checklist, strategy owned by Plan | One more Runtime concept to keep thin |
| Tasks stay actionable-only; Assets remain truth | Must freeze Plan≠Task≠Job boundaries (SPEC-CPP-001) |
| Still no engine/queue required for MVP | — |

### C — Full Content Production OS (Firefly-class)

Visual workflow builder, approvals, audit, DAM delivery.

| Pros | Cons |
| ---- | ---- |
| Long-term platform ceiling | Massive scope; wrong ROI now |

### D — Job Queue first (Midjourney-like)

Queue all generations; UI is job monitor.

| Pros | Cons |
| ---- | ---- |
| Fixes GPU idle | Ignores frame upload & navigation — majority cost |

### E — Comfy-style Task Graph as Creator OS

| Pros | Cons |
| ---- | ---- |
| Powerful dependencies | Confuses generation graphs with production OS; high complexity |

---

## Trade-off analysis (summary)

| Dimension | Prefer | Avoid (for now) |
| --------- | ------ | ---------------- |
| Deliverable unit | Work | Character-only |
| Completion / progress unit | **Production Plan** | Stuffing progress into Tasks or raw Work |
| Scheduling unit | Production Task (derived) | Raw Generate button; Task as second truth |
| Execution | Job + Deployment Adapter | Provider baked into Task or Plan |
| Orchestration MVP | Plan + derived Task states | Workflow engine; UI “Board” as Architecture |
| Async | Add Job queue when batch/non-blocking needed | Queue-first redesign |
| Sibling capabilities | Discovery ⊥ Rollout ⊥ CPP | Merging all into one mega-pipeline module |
| Image Gen | Capability via Jobs under CPP | Identity of Creator |

---

## Recommended direction

### Verdict (Architect Accepted — Direction B+)

1. **Yes — evolve toward Content Production Pipeline**, not merely Image Generation Workflow.  
2. **CPP is justified as a third Creator capability** alongside Discovery and Rollout — orchestrating **incomplete → complete Work**.  
3. **Do not** start with queue/engine/graph.  
4. **Do** start with **MVP architecture B+**:  
   `Work → Production Plan → Derived Production Tasks → Jobs → Deployment Adapter → Assets`  
   with Assets as sole Runtime Truth; Plan owns checklist/progress/strategy; Tasks are actionable-only; Jobs are execution-only.  
5. Deployment Profile participates **at Job execution**, never as Task or Plan identity.  
6. UI may expose a Production Board; Architecture names **Production Plan**, not “Work Production Board.”

### Architect answer card (Success Criteria — post B+)

| # | Question | Spike answer |
| - | -------- | ------------ |
| 1 | Correct Production Unit? | **Work** = deliverable; **Production Plan** = completion/progress/strategy; **Production Task** = actionable scheduling; **Job** = execution |
| 2 | Correct Runtime boundary? | Discovery / Rollout / CPP are siblings; CPP owns Plan→Tasks→Jobs over Assets; Reader outside; Deployment only under Jobs |
| 3 | Smallest viable CPP? | Production Plan + derived Tasks + incomplete-frame batch upload Jobs + character-complete shortcuts (± non-blocking portrait Jobs) |
| 4 | Queue / Engine / Graph? | **MVP: Plan + Task state categories.** Job queue only when async batch needed. Engine/graph deferred |
| 5 | Highest ROI toward 1 work/day? | **Attack human ops** via B+ — not model latency alone |

### Suggested next Architecture steps

1. ~~SPEC for responsibility boundaries~~ → **SPEC-CPP-001** (**Accepted** · Contract Freeze).  
2. ~~Architect Accept SPEC-CPP-001~~.  
3. Implementation authorization for MVP CPP — **separate grant** (not yet).  
4. Optional later: ADR “Discovery ⊥ Rollout ⊥ CPP.”  
5. Revisit A3 only if frame AI becomes necessary after MVP CPP saturates ROI.

---

## Risks

| Risk | Mitigation in discovery posture |
| ---- | ------------------------------- |
| Dual truth (Tasks vs Assets) | Derive tasks from Assets; Assets remain canonical |
| Plan becomes a second Asset store | Plan holds completion definition & progress projection — not portrait URLs / captions |
| CPP absorbs Discovery/Rollout | Keep sibling boundaries explicit (SPEC-CPP-001) |
| Queue premature optimization | Gate Job queue on measured non-blocking need |
| Scope creep to Firefly-class OS | Cap MVP to Plan + derived Tasks + batch upload + shortcuts |
| UI Board mistaken for Runtime | Name Runtime **Production Plan**; board is visualization only |
| Ignoring frame bottleneck by chasing portrait batch | ROI order in Q7 remains normative for first implementation |

---

## Recommendation checklist

- [x] Record Runtime Truth (audit-backed): human ops dominate  
- [x] External research supports Content Production OS direction  
- [x] Production Unit recommendation (Work / Plan / Task / Job) — **B+**  
- [x] Boundary vs Discovery / Rollout / Reader / Deployment  
- [x] Minimal CPP defined with ROI order  
- [x] Queue/engine/graph deferred with criteria  
- [x] **Architect decision:** Accept Direction **B+** (2026-07-21)  
- [x] **Follow-on:** SPEC-CPP-001 responsibility freeze draft  
- [x] **Architect Accept** SPEC-CPP-001 (2026-07-21)  
- [x] **Follow-on:** Conditional MVP Implementation Authorization (2026-07-23 · Gates A–F)  
- [ ] Broad Production Authorization beyond MVP (not granted)

**Decision owner:** Architect  
**Discovery completed:** 2026-07-21  
**Architect review:** Accepted with refinement B+ (2026-07-21)

---

## Appendix · File index

| Doc | Role |
| --- | ---- |
| `docs/findings/production-workflow-audit.md` | Cost evidence |
| `docs/specs/spec-cpp-001-creator-production-pipeline.md` | Responsibility boundary SPEC (B+) |
| `docs/adr/010-image-runtime-and-policy.md` | Creator ⊥ Reader; A3 portrait scope |
| `docs/specs/story-structure-exit-criteria.md` | Write-complete vs visual-complete |
| `docs/deployment/pd-showcase-recommendation-v1.md` | Complete-work shape |
| `docs/spikes/spike-img-002-local-image-generation.md` | Portrait latency |
| Linear / GH Projects / Figma / Firefly / Midjourney / ComfyUI | External abstraction research (this Spike §Research) |
