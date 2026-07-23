# Review — CPP Bootstrap Regression Check

**Status:** Submitted for Architect decision (implementation authorization gate)  
**Date:** 2026-07-23  
**Mode:** Adversarial architecture review — **assume CPP is wrong until proven otherwise**  
**Scope:** Determine whether Creator Production Pipeline (CPP) risks repeating the Bootstrap architectural mistake  
**Non-goals:** Do **not** improve CPP design, authorize implementation, or amend SPEC-CPP-001  
**Inputs:** ADR-001 (Superseded) · ADR-004 (Accepted) · SPIKE-CPP-001 · SPEC-CPP-001 (Accepted · boundaries only) · `production-workflow-audit.md`

---

## Verdict (for Success Criteria)

| Criterion | Result | One-line |
| --------- | ------ | -------- |
| 1. CPP freezes Domain rather than implementation | **Conditionally Met** | SPEC-CPP-001 freezes responsibilities; risk remains if MVP persists Tasks/Jobs as tables of truth |
| 2. CPP does not repeat Bootstrap’s architectural mistake | **Conditionally Met** | Bootstrap froze AI→Asset authority; CPP freezes orchestration *around* Assets — different failure mode, not immune |
| 3. Queue / Workflow Engine / Scheduler remain replaceable | **Met (on paper)** | SPEC places them under Job / deferred; leakage only if MVP binds them into Plan/Task identity |
| 4. Runtime Truth independent of execution technology | **Met (on paper)** | Assets + Human Accept remain truth; Jobs are execution |
| 5. MVP preserves future architectural flexibility | **Met only if irreversible list in Q8 is respected** | Thin Plan projection + derived Tasks; postpone durable Task/Job stores |

**Overall:** CPP is **not proven safe by similarity avoidance alone**. It is **architecturally distinguishable** from Bootstrap’s root mistake (authority/lifecycle collapse). Authorization should remain **blocked** until the Architect accepts the **irreversibility budget** in Q8 as binding on the first MVP grant.

This review does **not** grant implementation authorization.

---

## Question 1 — What was the actual architectural mistake of Bootstrap?

### Not the answer

Not “bad prompts,” “OpenRouter,” “partial writes,” or “missing polish.” Those were symptoms and engineering debt.

### Architectural root cause

**Bootstrap froze the wrong authority and lifecycle model as Runtime Architecture.**

Specifically, it collapsed three distinct Runtime concerns into one “pipeline” abstraction:

```text
(1) Capability execution     (LLM generates catalog)
(2) Domain authority         (output treated as Canonical Truth)
(3) Persistence lifecycle    (Immediate Persist into production Assets)
```

ADR-001 made that collapse explicit and intentional:

* AI output → **production entities** immediately  
* **No** draft / Candidate lifecycle  
* **No** Human Acceptance Gate before Asset authority  
* “Human Review” occurred **after** truth was already written  
* EAR observations about existing CRUD (“Immediate Persist,” “no draft architecture”) were elevated from **implementation posture** into **architectural law**

ADR-004 names the failure without relying on chronology:

```text
AI Bootstrap → Canonical Dataset (immediate persistence)
```

vs the correcting principle:

```text
Human owns Canonical Truth.
AI provides suggestions.
Human decides.
```

### Root-cause classification

| Lens | Bootstrap failure |
| ---- | ----------------- |
| **Wrong abstraction** | “Bootstrap Pipeline” as the unit of architecture — a generation+persist procedure — instead of authority-bounded capabilities (suggest / accept / persist) |
| **Wrong lifecycle ownership** | Lifecycle owned by the generator: create ⇒ already canonical. Correct ownership: Candidate ⇒ Human Accept ⇒ Asset |
| **Capability ownership** | Generation owned both *production of content* and *admission into Runtime Truth* |
| **Runtime boundary** | Treated authoring convenience (fill the DB fast) as Runtime Truth topology |
| **Mixed implementation with domain** | “Reuse Immediate Persist / avoid draft states” (infra/CRUD fact) was frozen as domain decision |
| **Source of truth** | Model output became de facto truth; humans were auditors of committed state, not authorities of admission |

**One sentence:** Bootstrap’s mistake was **freezing an execution convenience (generate-and-persist) as Canonical Truth Architecture**, before the Human Acceptance Gate and Candidate lifecycle were established as Runtime law.

---

## Question 2 — Bootstrap vs CPP

| Dimension | Bootstrap (ADR-001) | CPP (SPEC-CPP-001 B+) | Similarity? | Difference? |
| --------- | ------------------- | --------------------- | ----------- | ----------- |
| **Runtime responsibility** | “Create initial narrative foundation” via one pipeline | Drive Work **incomplete → complete** via Plan / Tasks / Jobs | Both are Creator-side orchestration stories | Bootstrap creates authority; CPP claims to orchestrate completeness **over** existing Assets |
| **Domain ownership** | Pipeline owned entity birth + content | Discovery / Rollout / CPP claimed as siblings; Assets owned by existing domain | Both introduce a named Creator capability | CPP explicitly **must not** absorb Discovery/Rollout or Asset authority |
| **Source of truth** | AI output persisted as Assets | **Assets** canonical; Tasks **derived** | — | **Critical difference** if upheld in implementation |
| **Human gate** | Review after persist | Portrait Accept (ADR-010) + Discovery Accept remain outside CPP ownership; CPP must not bypass Accept into Assets | Both can still skip gates if mis-implemented | CPP SPEC forbids Task/Plan as Asset truth |
| **Execution model** | Sync provider call → CRUD create | Job = execution; Deployment under Job | Both have an execution step | CPP separates Job from Plan/Task progress |
| **Lifecycle** | Generate ⇒ Persist ⇒ (optional) edit | Plan progress ⇔ Asset completeness predicates; Task actionable; Job ephemeral execution | Both invent lifecycle vocabulary | Bootstrap lifecycle **writes** truth; CPP lifecycle **measures** truth (if derived) |
| **User mental model** | “Run Bootstrap, get a Work skeleton” | “Complete a Work against a Plan” | Both promise throughput | Bootstrap = manufacture catalog; CPP = production OS / incompleteness |
| **Infrastructure dependency** | Tied to Immediate Persist CRUD + chosen text provider | SPEC forbids freezing queue/engine; Deployment replaceable under Job | Both can leak infra if coded carelessly | CPP Contract Freeze **explicitly denylists** engine/queue/schema |
| **Failure mode when wrong** | Wrong entities become Runtime Truth; downstream graphs poisoned | Wrong Plan/Task model becomes second Jira; or Tasks stop deriving and become dual truth | Shared class: **premature abstraction freeze** | Different poison: **authority poison** vs **orchestration poison** |
| **Supersession evidence** | ADR-004 Decision 7 rejected Bootstrap as production architecture | Not yet production-authorized; boundaries Accepted only | — | CPP still unproven in Runtime |

### Similarity that should worry the Architect

Both introduce a **named pipeline abstraction** under pressure to reduce operator cost, and both risk elevating a convenient workflow into Architecture before Runtime Truth is stress-tested.

### Difference that must remain non-negotiable

| Bootstrap | CPP (required to avoid repeat) |
| --------- | ------------------------------ |
| Pipeline **produces** Canonical Assets | Pipeline **projects** incompleteness from Assets |
| Success = rows exist | Success = Plan completion vs Asset predicates |
| AI admission automatic | AI admission remains Human Accept (elsewhere + Job outcomes) |

If MVP implementation makes Tasks/Plans the place operators “fix content,” CPP **does** become Bootstrap-class.

---

## Question 3 — Which CPP assumptions could later prove false?

Challenge every major concept. Evidence is intentionally split into **supporting** vs **missing**.

### Work

| | |
| - | - |
| **Why might this be wrong?** | Product goal “1 work / day” may not equal the real scheduling/completion boundary. Operators may complete by **Story arc**, **chapter batch**, or **visual pack**, not whole Work. Work may be too coarse (Spike already said so — hence Plan). |
| **Runtime evidence for** | Showcase definition is Work-scoped; Admin navigation and Assets are Work-keyed; audit throughput measured per Work. |
| **Runtime evidence missing** | No production telemetry that operators *think* in Works vs Stories when managing incompleteness; no multi-Work / multi-Plan campaigns observed. |

### Production Plan

| | |
| - | - |
| **Why might this be wrong?** | May be a **documentation object** mistaken for Runtime. Completeness might be a pure function `f(Assets, policy)` with no Plan entity. “Strategy” may be Deployment/ops, not Runtime. Plan may duplicate Work metadata or become a shadow Asset store. |
| **Runtime evidence for** | Audit: write-complete ≠ visual-complete; checklist/progress had no home; Work too coarse / Tasks too fine (Architect B+). |
| **Runtime evidence missing** | Zero implemented Plans; no proof operators need a persistent Plan vs ephemeral “completion profile”; no proof multiple concurrent Plans per Work are needed or harmful. |

### Production Task

| | |
| - | - |
| **Why might this be wrong?** | “Task” imports Linear/Jira mental model into a content CMS. Actionable units may be **Asset fields** (empty url) with no Task identity. Explicit Tasks may become dual truth the moment they are stored and edited independently of Assets. |
| **Runtime evidence for** | Heterogeneous incompleteness (portraits, frames, bindings) and navigation tax; derived incompleteness is observable in DB today (`portrait_url`, empty `story_images_v2.url`). |
| **Runtime evidence missing** | No measured operator preference for task boards vs incompleteness lists; no proof Task state machine categories are necessary vs boolean “blocking gaps.” |

### Job

| | |
| - | - |
| **Why might this be wrong?** | Elevating every upload/generate to “Job” may over-formalize sync Server Actions. Job identity may smuggle queue/worker semantics into Runtime. If Jobs carry business progress, the model collapses toward Bootstrap’s execution=authority pattern. |
| **Runtime evidence for** | Portrait generation already is an async-ish capability with Deployment Adapter; non-blocking/batch needs an execution concept distinct from Plan progress (audit + Spike). |
| **Runtime evidence missing** | No production requirement yet for durable Job records; Local/Cloud failover works today without a Job Runtime type. |

### Cross-cutting assumption: “Derived Tasks whenever possible”

| | |
| - | - |
| **Why might this be wrong?** | Some production work is **not** derivable (taste review, “ship it” judgment). Over-deriving creates noisy tasks; under-deriving recreates manual hunting. “Whenever possible” is a loophole that can become “always store Tasks.” |
| **Evidence for** | Empty urls / missing portraits are mechanically detectable. |
| **Evidence missing** | Stable predicate set for showcase-complete vs lean-complete; conflict rules when Plan definition disagrees with operator intent. |

---

## Question 4 — Does CPP remain valid if all execution technologies are replaced?

### Replaceability test

Assume replacement of: Queue, Workflow Engine, BullMQ, Temporal, Local Runtime, Cloud Runtime, in-process `startTransition`, cron, etc.

| Layer | Must remain unchanged? | Why |
| ----- | ---------------------- | --- |
| Assets + Human Accept | **Yes** | Runtime Truth / authority |
| Production Plan responsibilities (completion definition, progress) | **Yes** | Domain orchestration intent |
| Production Task as actionable projection | **Yes** (as concept) | Domain actionability |
| Job as “execution occurred / capability invoked” | **Yes** (as concept) | Separation of progress vs execution |
| Concrete Job runner, queue, Temporal workflows | **No** | Infrastructure |
| Local vs Cloud | **No** | Deployment |

### Would the Runtime model remain unchanged?

**Yes — if and only if** SPEC-CPP-001 invariants hold:

* Plan/Task identity does not encode BullMQ job ids, Temporal workflow ids, or provider names  
* Progress is computed from Assets (+ Plan definition), not from “workflow succeeded”  
* Deployment Adapter remains under Job execution  

### Where leakage would break the test

| Leakage | Symptom after tech swap |
| ------- | ----------------------- |
| Task.state = Temporal workflow state | Swapping engine rewrites “domain” progress |
| Plan.strategy = `use_bullmq_batch` | Plan becomes infra config |
| Job row is the only place portrait URL lives before Accept | Tech swap corrupts Asset admission path |
| “Work complete” = last queue drain | Bootstrap-class: execution success ⇒ truth/completeness |

**Conclusion:** The **responsibility model** is designed to be execution-technology-invariant. It is **not automatically so** after implementation; invariance is a property of **discipline**, not of naming.

---

## Question 5 — Domain vs Infrastructure boundary

```text
DOMAIN (Runtime Contract / Creator semantics)
────────────────────────────────────────────
  Work                         deliverable identity
  Assets                       sole Runtime Truth
  Human Acceptance Gate        authority admission (ADR-004 / ADR-010)
  Discovery / Rollout / CPP    sibling capabilities (ownership boundaries)
  Production Plan              completion definition · progress · checklist · strategy
  Production Task              actionable unit (projection of incompleteness)
  Completeness predicates      domain rules: what “done” means for a Plan

BOUNDARY ───────────────────────────────────
  Job (conceptual)             “a capability execution was requested/finished”
        ※ thin: success/failure of execution — NOT business progress

INFRASTRUCTURE / ADAPTER / IMPLEMENTATION
────────────────────────────────────────────
  Deployment Adapter           Local | Cloud binding
  Image Generation Port        capability port (ADR-010 / SPEC-IMG-001)
  Queue / Worker / Scheduler   how Jobs run
  Workflow Engine / Temporal   optional orchestration machinery
  State machine library        how Task UI states are stored
  Production Board UI          visualization of Plan
  DB tables / caches           persistence choices
```

### Why each Runtime concept sits where it does

| Concept | Side | Why |
| ------- | ---- | --- |
| Work | Domain | Product deliverable; exists without any Job runner |
| Assets | Domain | Reader and completeness consume them |
| Production Plan | Domain | Answers “how do we know this Work is complete?” — independent of GPU/queue |
| Production Task | Domain | Answers “what actionable gap remains?” — derivable from Assets |
| Job (concept) | **Boundary** | Names execution without owning progress; easy to smuggle infra upward — keep thin |
| Queue / Engine / Worker | Infrastructure | Replaceable without changing “incomplete frame” meaning |
| Deployment Adapter | Adapter | Provider binding under Job |
| Board UI | Implementation | Visualizes Plan; not Architecture (CPP-INV-07) |

**Strict rule:** If removing BullMQ/Temporal/Local would force a rename or rewrite of Plan/Task **meaning**, that meaning was Infrastructure leaked into Domain.

---

## Question 6 — Implementation leakage map

| Concept | Belongs in | Runtime? | Notes |
| ------- | ---------- | -------- | ----- |
| Queue | Infrastructure | **No** | Optional Job substrate |
| Worker | Infrastructure | **No** | |
| Scheduler / cron | Infrastructure | **No** | |
| Workflow Engine (Temporal, etc.) | Infrastructure | **No** | |
| BullMQ / Inngest / etc. | Infrastructure | **No** | |
| Background Job (product phrase) | Ambiguous → treat as **Infrastructure** unless meaning = conceptual Job | Conceptual Job only | Do not freeze product copy as Runtime type |
| State Machine | **Implementation** of Task/Plan state categories | Categories may be Domain; library is not | Linear-like *categories* can be Domain; XState/Temporal signals are not |
| “Job” durable table | Implementation | Only if required; must not hold Asset truth | Prefer ephemeral execution logs early |
| Production Board | Implementation (UI) | **No** | |
| Derived Task list (computed) | Domain projection / Application | Yes as **projection**, not as authority store | Safest MVP form |
| Persisted Task rows editable independently of Assets | **Danger — dual truth** | Forbidden by CPP-INV-01/02 if they become authority | Highest Bootstrap-rhyming risk inside CPP |
| Provider name on Task | Forbidden leak | Violates CPP-INV-04 | |
| Completeness % | Domain (Plan) | Yes | Must recompute from Assets |

---

## Question 7 — Runtime evidence that would invalidate today’s CPP

Concrete observations (six months out) that should **trigger architectural reconsideration** — not minor UX tweaks.

### Invalidate Production Unit / Plan layering

1. Operators reliably complete and ship by **Reading Route / Story packs**, and Work-level Plans are ignored or always 0%/100% noise.  
2. Multiple conflicting “completion definitions” per Work are required simultaneously, and Plan cannot express them without becoming a workflow engine.  
3. Progress that matters is **Reader-facing quality grades**, not Asset field predicates — Plan checklist never predicts ship readiness.

### Invalidate derived Tasks

4. Stored Production Tasks are routinely edited such that **Task state disagrees with Assets**, and operators trust Tasks over DB fields (dual truth in the wild).  
5. \>N% of actionable work cannot be derived from Assets, and the system becomes a manual ticketing tool disconnected from content.  
6. Derivation produces chronic false positives/negatives; operators disable the Plan and return to `/works` table hunting.

### Invalidate Job boundary

7. Business completeness is computed from **Job success** (e.g. “3 portrait jobs done”) while Assets remain empty or unaccepted.  
8. Jobs must carry editorial fields (captions, names) to “finish,” recreating Bootstrap generate-and-persist.  
9. Deployment choice must be stored on Plan/Task to make progress intelligible.

### Invalidate sibling capability split

10. CPP cannot operate without owning Discovery Accept or Rollout persist; “siblings” collapse into one mega-pipeline in practice.  
11. Discovery/Rollout teams cannot evolve without CPP schema breakage (ownership coupling).

### Invalidate Work-as-deliverable for CPP

12. The economic unit becomes **Asset pack / visual episode**, and “one Work / day” is no longer the governing goal — Plan-per-Work is the wrong freeze.

### Invalidate human workflow assumptions

13. Human Judgment moves **before** Asset existence again (catalog manufacture), making incompleteness-projection the wrong primary metaphor.  
14. Multi-operator approval chains require Firefly-class engines; thin Plan/Task model becomes a lie we maintain only in docs.

**Any one of {4, 7, 8} alone is Bootstrap-regression-class** (authority or execution⇒truth collapse).

---

## Question 8 — Can MVP CPP maximize learning while minimizing commitment?

### Already frozen (Contract Freeze — SPEC-CPP-001)

These are **reversible only via SPEC/ADR amendment**, not silently:

* Assets as sole Runtime Truth  
* Tasks as projections (whenever possible)  
* Plan ≠ Task ≠ Job responsibilities  
* Deployment under Job only  
* Discovery ⊥ Rollout ⊥ CPP  
* UI Board ≠ Runtime  

**Assessment:** Freezing **responsibilities** is appropriate and Bootstrap-unlike (Bootstrap froze a persist pipeline). Keep this freeze; do not expand it.

### Irreversible-leaning decisions (implementation risks)

| Decision | Irreversibility | Postpone? | Safer MVP alternative |
| -------- | --------------- | --------- | --------------------- |
| Durable `production_tasks` table as editable authority | **High** — dual truth | **Yes** | Computed projection from Assets + Plan definition in memory/API |
| Durable Job queue as Architecture | **High** | **Yes** | Sync Server Action + optional later queue behind Job Port |
| Persist Plan as rich strategy document (provider, batch sizes) | **Medium–High** | **Yes** | Plan = completion profile id + computed progress only |
| Freeze concrete completeness predicate list in code constants as Architecture | **Medium** | Partially | Keep as replaceable Plan configuration / Deployment-adjacent policy |
| Couple CPP routes into Discovery/Rollout modules | **High** | **Yes** | Read Assets only; emit deep links |
| UI named and shipped as “the Runtime” | **Medium** | N/A | Call UI “board”; Plan remains conceptual even if only server-computed |
| Task state machine library / Temporal for MVP | **High** | **Yes** | Boolean gaps + simple status labels |
| Make Job completion auto-write Assets without Accept | **Bootstrap-class** | **Must never** | Preserve Human Accept |

### Maximal-learning / minimal-commitment MVP shape (recommendation for a *future* grant — not authorization)

```text
1. Define a completion profile (Plan-as-config) for a Work
2. Compute progress + actionable gaps from Assets (derived Tasks)
3. Deep-link + batch upload for empty frame urls
4. Optional: non-blocking portrait invoke without durable Job store
5. Measure: do operators use progress? do gaps match reality? dual-truth attempts?
```

**No** queue, **no** workflow engine, **no** editable Task authority store, **no** CPP ownership of Discovery/Rollout.

### Can MVP be done without locking future architecture?

**Yes**, if the first grant’s denylist includes:

* No durable Task authority  
* No engine/queue requirement  
* No provider fields on Plan/Task  
* No auto-persist from Jobs into Assets without Accept  
* No expansion of SPEC beyond boundaries without amendment  

**No**, if MVP “helpfully” introduces BullMQ + `production_tasks` rows that operators edit as the work tracker.

---

## Bootstrap mistake vs CPP — regression test summary

| Bootstrap root mistake | CPP safeguard (SPEC) | Remaining hole |
| ---------------------- | -------------------- | -------------- |
| AI/execution admits Canonical Truth | Assets + Human Accept; Jobs ≠ progress | Job auto-write / Task-as-truth in MVP code |
| Pipeline frozen from CRUD convenience | Explicit denylist of schema/queue/engine in SPEC | Implementation grant could ignore denylist |
| Human review after persist | Accept gates remain outside CPP ownership | CPP UI could still skip Accept for speed |
| Wrong abstraction: manufacture catalog | Abstraction: incompleteness → complete | Plan/Task could still be wrong units (Q3/Q7) |

**CPP does not automatically repeat Bootstrap** — the failure modes differ (authority poison vs orchestration poison).  
**CPP can still fail Bootstrap-adjacent** if Tasks/Jobs become admission paths for Asset truth.

---

## Success Criteria checklist (authorization gate)

| # | Criterion | Demonstrated? | Condition |
| - | --------- | ------------- | --------- |
| 1 | Freezes Domain rather than implementation | **Yes at SPEC layer** | MVP must not freeze queue/Task tables as Architecture |
| 2 | Does not repeat Bootstrap mistake | **Distinguishable; not immune** | Enforce Q8 denylist; watch Q7 items 4, 7, 8 |
| 3 | Queue / Engine / Scheduler replaceable | **Yes if Job stays thin** | No Plan/Task provider or engine identity |
| 4 | Runtime Truth ⊥ execution technology | **Yes on paper** | Assets remain admission path |
| 5 | MVP preserves flexibility | **Only with irrev. budget** | Computed Plan/Tasks first |

### Reviewer recommendation to Architect

| Option | Meaning |
| ------ | ------- |
| **A — Block implementation** | Until an Implementation Grant text cites Q8 denylist explicitly |
| **B — Authorize MVP with irrev. budget** | Thin Plan projection + derived gaps only; denylist normative |
| **C — Reject CPP direction** | If Architect believes Plan/Task fails Q3 without more evidence |

This review **recommends Option A or B**, not unconditional authorization.  
It **does not** itself authorize implementation.

---

## Appendix — Authority citations

| Claim | Source |
| ----- | ------ |
| Bootstrap AI → immediate Canonical Dataset | ADR-004 §Why; ADR-001 Decision |
| Human owns Canonical Truth | ADR-004 Foundational Principle |
| Bootstrap rejected as production architecture | ADR-004 Decision 7 |
| CPP boundaries / Assets truth / Job under Deployment | SPEC-CPP-001 |
| Human ops dominate; incompleteness bottlenecks | `docs/findings/production-workflow-audit.md` |
| Direction B+ | SPIKE-CPP-001 Architect Review |

---

## Document history

| Version | Date | Note |
| ------- | ---- | ---- |
| v1.0 | 2026-07-23 | Bootstrap regression check; adversarial; no implementation grant |
