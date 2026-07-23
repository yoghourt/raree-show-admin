# Review — CPP MVP Goal Alignment

**Status:** Submitted for Architect / product decision  
**Date:** 2026-07-23  
**Mode:** Goal alignment only — assume implementation correct; ignore code quality  
**Objective under test:** One operator → one complete showcase work → one working day  
**Baseline:** `docs/findings/production-workflow-audit.md` (lean Path B ≈ **5.0 h** wall-clock)  
**Subject:** CPP MVP as shipped (Production Board · derived Tasks · batch frame write · Accept→Save portrait)

---

## Verdict (one sentence)

**MOSTLY YES** for a lean showcase day with prepared excerpts and ready stills; **not yet reliable** for stretch taste/variant days — CPP cut roughly **~12–15%** of lean wall-clock and barely moved the **~83% human-share** structure because the largest remaining costs sit outside MVP scope (Discovery judgment, portrait serial wait, frame **sourcing**).

---

## Question 1 — Re-run production workflow (with MVP)

Same business path (Path B). Operator actions **after** CPP MVP:

```text
1. Login
2. Create Work (+ cover)                          [unchanged]
3. Open Discovery → paste/lock narrative          [unchanged]
4. Propose → review/regen Candidates              [unchanged]
5. Accept Character → /characters/new → Create    [unchanged handoff]
6. (Edit) Generate portrait → wait → review
   →「接受肖像并保存」OR Save                      [MVP: −1 click on edit]
7. Accept Location → form → Save                  [unchanged]
8. Rollout sync → write stories (captions, url="")[unchanged]
9. Open「制作」Production Board                    [NEW]
   - Read Plan % + checklist (cover/portraits/routes/frames)
   - Open derived task deep links as needed
10. Batch Frame Completion on same page             [NEW]
   - For each empty captioned frame: pick file → upload (candidate)
   - Click「写入作品」once (Human Accept → Assets)
11. Return to Board until progress = profile-complete
12. Optional RAG                                    [unchanged]
```

**What the operator no longer does (MVP effect):**

* Hunt empty `story_images_v2` urls by opening each Reading Route edit form  
* Risk deleting empty-url frames via ReadingRouteForm filter on save  
* Guess “what’s left” without a Plan checklist  
* (Edit path) separate “Save” after deciding a generated portrait is good — one Accept→Save control  

**What the operator still does fully manually:**

* Narrative prep, Candidate Accept, Discovery→CRUD page hops  
* Per-character generate + wait + taste retry (still serial)  
* **Find/source** each frame still (library, generate elsewhere, or invent)  
* Per-frame file picker (batch UI lists rows; does not auto-fill images)  
* Rollout write cadence  

---

## Question 2 — Recalculate production time

Same lean assumptions as audit: 8 characters × 1.4 gens, 6 locations, 9 stories, 18 captioned frames, Path B, Local portrait P50 ≈ 35s.

### Phase wall-clock (before → after)

| Phase | Before | After (MVP) | Δ |
| ----- | -----: | ----------: | --: |
| Work shell | 5 | 5 | 0 |
| Discovery input + lock | 25 | 25 | 0 |
| Propose + review + regens | 50 | 50 | 0 |
| Characters (forms + portrait) | 75 | **~72** | **−3** (Accept→Save only) |
| Locations | 12 | 12 | 0 |
| Rollout writes | 25 | 25 | 0 |
| Frame image fill | 65 | **~42** | **−23** (no per-route edit; batch write; upload wait similar) |
| Navigation / hunting tax | 20 | **~8** | **−12** (Board + derived links) |
| Buffer / rework / RAG | 20 | **~14** | **−6** (visible remaining work) |
| **Total wall-clock** | **~297 min (~5.0 h)** | **~253 min (~4.2 h)** | **≈ −15%** |

### Category table (requested)

| Category | Before | After | Improvement |
| -------- | -----: | ----: | ----------: |
| AI Generation (blocked wait) | ~42 min (**~14%**) | ~42 min (**~17%**) | **0 min** (share ↑ because human fell) |
| Human Operations | ~232 min (**~83%**) | ~~195 min (**~77%**) | **≈ −37 min (~16% of human)** |
| System Wait (upload/DB/verify) | ~8 min (**~3%**) | ~8 min (**~3%**) | ~0 |
| **Total Production Time** | **~5.0 h** | **~4.2 h** | **≈ −0.8 h (~15%)** |

**Reading:** The dominant **human cost decreased in absolute minutes**, but **not transformed**. Human is still ~¾+ of the day. AI wait was untouched. CPP MVP attacked **coordination + frame write UX**, not generation or editorial judgment.

Stretch day (variants, heavy regen, hard stills): before **8–12 h** → after **~7–11 h** (similar relative cut; still multi-day risk).

---

## Question 3 — Remaining bottlenecks (ops impact rank)

| Rank | Bottleneck | Why it still exists | Why MVP left it | Future ROI (ops) |
| ---: | ---------- | ------------------- | --------------- | ---------------- |
| 1 | **Frame still sourcing + 18× file pick** | A3: no scene AI; Batch UI only wires upload→Accept write | MVP = batch write path, not image manufacture | **Highest** if drafts/library exist — could reclaim most of remaining ~40 min frame phase |
| 2 | **Discovery review + narrative prep** | Human Judgment / provenance (policy) | Sibling capability; CPP must not absorb | High absolute minutes (~65); judgment-bound — automate carefully |
| 3 | **Portrait serial generate + wait** | A3 single-entity; Local ~35s; no Job overlap UX | Gate F: no queue; Accept≠auto | High if non-blocking/batch allowed — converts ~32 min idle |
| 4 | **Discovery Accept → form Create round-trip** | Candidate≠Asset until Create (ADR-004) | Out of CPP scope | Medium–high (~10–20 min) without new image policy |
| 5 | **Rollout per-story write friction** | Editorial confirm before persist | Sibling; MVP read Assets only | Medium (~5–15 min) |
| 6 | **Taste retries (portrait/frames)** | Brand / Accept gates | Correctly human | Unbounded P95 — process, not CPP board |

---

## Question 4 — Goal achievement

### Answer: **MOSTLY YES**

| Scenario | Achievable in ≤8 h focused? | Evidence |
| -------- | --------------------------- | -------- |
| Lean showcase (8×1 portrait, ~18 frames, excerpts+stills ready) | **Yes (~4.2 h)** | Audit 5.0 h − MVP ~0.8 h |
| Reliable daily cadence including normal rework | **Fragile** | Still ~77% human; Discovery + stills dominate |
| Stretch (≤24 portrait variants, scarce stills, heavy regen) | **No as routine** | Still multi-hour tail outside CPP |

CPP made the lean day **more predictable** (Plan %) and **faster on frame write**, but did **not** change whether a bad stills day or Discovery day fits in 8 hours.

---

## Question 5 — Remaining gap (if not fully YES)

Target: reliable **1 operator · 1 work · 1 day**.

| Definition of “done” | Estimated remaining gap vs 8 h budget |
| -------------------- | -------------------------------------: |
| Lean optimistic | **~0%** (already under budget) |
| **Reliable lean** (normal retries, mild still hunting) | **~15–25%** (~1–2 h soft buffer missing) |
| Stretch showcase | **~40–60%+** |

**What prevents a solid YES:**

1. Frame images still require **external acquisition** labor.  
2. Discovery **judgment + handoff** untouched (~1 h).  
3. Portrait **GPU wait remains serial** (~0.5 h blocked).  
4. CPP cannot legally collapse Accept gates or absorb Discovery/Rollout.

Gap to close for “reliable YES” ≈ **cut another ~60–90 minutes** of residual human/idle time on the critical path — not another progress bar.

---

## Question 6 — Single highest-ROI next improvement

**Choose one:**

> **Eliminate manual manufacture/hunt of Reading Frame images** — feed draft (or library) images into the existing Batch Frame Completion → Human Accept → Assets path.

**Why this alone:**

* After MVP, frame phase is still **~40+ min**, and it is the largest **non-judgment** block CPP already partially instrumented.  
* Board/deep-links/Accept→Save already skimmed coordination cream (~0.8 h). Further CPP chrome returns **minutes**, not the next **half-hour**.  
* Discovery review is larger in minutes but is **Human Judgment**; compressing it fights policy and quality.  
* Portrait wait is large but converting it needs Job overlap/batch — still less than removing 18 still hunts if drafts exist.

(Whether drafts come from a future Image grant or an offline library is an authorization choice — the **ops** target is the same: stop the operator from being a stock-photo courier.)

---

## Question 7 — Stop or Continue?

### Choice: **B — Return to Discovery**

**Product ROI justification:**

* CPP MVP already delivered the **authorized, high-ROI slice** of the production OS (visibility + batch frame **write** + Accept→Save). Marginal CPP UX is past the steep part of the curve (~15% lean gain; human share still ~77%).  
* Under **current Image A3** (no scene gen), the next large **in-policy** operator-time cut is **Discovery Accept → Asset materialize without full-page Create hops** (and related intake friction) — work CPP is forbidden to own (sibling boundary).  
* Rollout (C) is smaller residual than Discovery intake/review/handoff.  
* Continuing CPP (A) only pays if the next step is Question 6’s frame drafts — that is **Image / Authorization**, not more Plan UI → prefer a scoped grant (**D**) *instead of* more CPP, if Architect prioritizes frames over Discovery.  
* Default recommendation under **no new Image grant**: **B Discovery**.  
* If Architect prioritizes Q6 immediately: choose **D** (scoped frame-draft capability), not endless CPP.

**Stop rule:** Do **not** keep optimizing CPP for elegance. Either attack Discovery handoff **or** authorize frame drafts — not both in parallel.

---

## Success criterion answer

> **After CPP MVP, how close is Raree Show to one operator / one complete work / one day?**

| Metric | Value |
| ------ | ----- |
| Lean wall-clock | **~4.2 h** (was ~5.0 h) |
| Distance to 8 h budget (lean) | **Inside budget** |
| Human-ops share | **~77%** (was ~83%) — structure unchanged |
| Reliable daily YES | **MOSTLY YES** — gap **~15–25%** buffer for rework/stills |
| Next constraint | **Frame image acquisition** (ops); **Discovery handoff** (in-policy next build) |

---

## Appendix — Evidence sources

| Item | Source |
| ---- | ------ |
| Before times | `docs/findings/production-workflow-audit.md` §2.2 / §8 |
| MVP surfaces | `/works/[workId]/production`, `BatchFrameCompletion`, `deriveProductionPlan`, CharacterForm Accept→Save |
| Unchanged Discovery/Rollout/A3 | SPEC-CPP-001 INV-05 · ADR-010 Constraint B · Gates A–F |

---

## Document history

| Version | Date | Note |
| ------- | ---- | ---- |
| v1.0 | 2026-07-23 | Goal alignment post CPP MVP; throughput-only |
