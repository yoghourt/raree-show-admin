# SPIKE-GRANULARITY-GATE-001 — Discovery → Reader Granularity Gate

**Status:** Spike Implementation **Authorized** · Evidence **PASS**  
**Production Authorization:** **NOT granted**  
**Runtime Truth Gate:** A — Architecture Closure  
**Owner:** Architect · **Executor:** Cursor  
**Date:** 2026-08-19

---

## What

Isolated spike: after Discovery Propose, a **deterministic Granularity Gate** inspects Story/Frame topology (+ optional labeled plot turns) and returns machine-readable `PASS | FAIL` with auditable evidence.

Does **not** generate captions, repair Discovery, or wire into Propose / Review / Rollout / Reader.

## Why

Work `42c22be9-ac88-4407-90cf-19cf79847d07` produced:

```text
5 source headings
  → 5 Stories × 1 Frame
  → 5 isolated Reading Routes
```

Prompt patches cannot be the architecture constraint. The question is whether a **post-Propose gate** can catch the broken Reader progression topology without pretending semantic problems are string equality.

## How

```text
Discovery Output (stories + scene captions as Frames)
      ↓
Granularity Analysis (headings, singleton ratio, shared names, unit estimates)
      ↓
Deterministic Gate G1–G4
      ↓
PASS / FAIL + evidence[]
```

Allowlist:

| Path | Role |
| ---- | ---- |
| `scripts/granularity-gate-spike/**` | Gate, analysis, fixtures A–D, runner |
| `__tests__/spikes/granularity-gate-001.test.ts` | Evidence tests |
| `docs/spikes/granularity-gate-001.md` | This record |

Denylist honored: no Reader Runtime, no `story_images_v2` schema, no Scene Context, no ADR-011/012, no prompt rewrite, no Archive changes, no work-id branch, no production gate wiring.

---

## Validation

```bash
npx vitest run __tests__/spikes/granularity-gate-001.test.ts
npx tsx scripts/granularity-gate-spike/run.ts
```

Observations (2026-08-19):

| Fixture | Expected | Actual | Error invariants |
| ------- | -------- | ------ | ---------------- |
| A Known bad (primary Work snapshot) | FAIL | FAIL | G1, G4 |
| B 1 Story × 4 Frames | PASS | PASS | none |
| C 1 Story × 1 Frame | PASS | PASS | none |
| D labeled turn missing from caption | FAIL | FAIL | G3 |

Gate source does not contain `42c22be9`. Fixture A carries that id as **provenance only**.

---

## Gate invariants (implemented)

### G1 — Story should not mechanically mirror source outline

- **Signal:** numbered heading count ≈ Story count (`\|Δ\| ≤ 1`, both ≥ 3). **Not a FAIL by itself.**
- **Error** only when that signal **and** ≥80% Stories have exactly 1 Frame **and** ≥2 proper names are shared across Stories (same-arc fragment).
- Cross-script title matching (CJK heading vs English Story title) is **not** claimed.

### G2 — 1 Story × 1 Frame is legal unless multiple unmerged progression units

- Per Story with exactly 1 Frame: estimate units from Story.summary sentence count.
- ≥3 content sentences → **error**. 2 → **warning**. 1 → no G2.
- Extra unit test: four event sentences collapsed into one Frame → FAIL G2.

### G3 — Frame caption must carry Reader-necessary narrative

- **Error (deterministic / labeled):** zero Frames, empty captions, or `labels.requiredTurns` not lexically covered by any caption (Fixture D).
- **Warning only:** unlabeled Story.summary vs caption token coverage. Paraphrase (Fixture C) must not FAIL.
- Unlabeled Jaccard is **not** treated as semantic understanding.

### G4 — Route must allow sequential Frame progression on one Story

- **Error** when ≥3 Stories are mostly singletons, share arc names, and look outline-shaped (G1 error or heading≈story).
- Evidence names the `N Stories × 1 Frame` topology and that Reader cannot do Frame1 → Frame2 inside one Route.

---

## Answers (required)

### Q1 — Can the Gate stably catch `5 Story × 1 Frame`?

**Yes**, as G1+G4, on the captured Propose snapshot (Fixture A), without hardcoding Work id or `5 → 1`.

It catches **wrong topology** (outline → many singleton Stories). It does **not** assert the gold shape is exactly `1 × 5`.

### Q2 — Which of G1–G4 are purely deterministic?

| Invariant | Deterministic | Needs semantics / labels / LLM |
| --------- | ------------- | ------------------------------ |
| G1 count + singleton ratio + shared-name overlap | Yes (heuristic topology) | “Are these truly one arc?” in the limit |
| G2 sentence-count units | Weakly yes | True beat segmentation |
| G3 empty caption / missing Frames | Yes | |
| G3 labeled `requiredTurns` coverage | Lexical check of **human-specified** strings | Choosing the turns |
| G3 unlabeled summary↔caption overlap | **No** — warning only | Plot-turn identity |
| G4 singleton Routes + shared names + outline shape | Yes (follows G1) | |

Do not promote unlabeled G3 to error. That would fake semantics as string matching (Fixture C would die).

### Q3 — Gate duty vs other layers

```text
Discovery Propose     = emit candidates
Granularity Gate      = validate known structural invariants (+ labeled G3)
Human Review          = judge unlabeled semantic correctness; may edit caption
Reader Runtime        = consume approved Frame order
```

Gate MUST NOT: invent Stories/Frames, rewrite captions, or become Reader explanation.

### Q4 — After FAIL: REJECT / RE-PROPOSE / REPAIR?

**Recommendation: RE-PROPOSE (default), block Accept.**

| FAIL class | Next |
| ---------- | ---- |
| G1 / G4 (wrong Story cuts) | **RE-PROPOSE** Story+Scene. Automated merge/repair is a new architecture (not this spike). |
| G2 (under-framed Story) | **RE-PROPOSE** Scenes under the same Story. |
| G3-only (labeled turn missing) | Prefer caption **Human Review edit**; RE-PROPOSE if the beat was never a Scene. Not silent machine REPAIR. |

REJECT (discard session) is too destructive. REPAIR without a specified merge algebra would hide topology bugs.

---

## False positives / negatives

**False positives**

- G1 **warning** when heading count ≈ story count but names do not overlap (three unrelated numbered shorts — tested: no G1 error).
- G2 if a single beat is written as three ornate sentences.
- Shared-name G1/G4 if two genuinely separate arcs reuse the same hero names in one Propose batch.

**False negatives**

- Outline not numbered → G1/G4 may miss even if 5×1.
- Entire arc stuffed into **one** Story.summary sentence → G2 miss.
- Plot turn only in Story.summary, caption paraphrases it, **no labels** → G3 warning, not FAIL (by design).
- Gold `1 Story × 5 Frames` is **not** what G1 proves; G1 proves “this is outline-mirroring,” not “N must equal heading count.”

---

## Recommended Gate boundary

Insert **after Propose, before Human Review Accept**. FAIL ⇒ do not treat candidates as Review-complete for Rollout. Surface `violations[]` to the operator. Do not run in Reader. Do not change Frame schema.

## Next Authorization

Architect: accept or amend this boundary. **Production Implementation is not granted.** If granted later: wire Gate onto Propose response / Review panel as read-only evidence; keep repair out of scope until a Story-merge SPEC exists.

Do not draft an ADR from this spike until that authorization.

---

## Refs

- Grant: SPIKE-GRANULARITY-GATE-001 (this document)
- ADR-005 Story / Scene / ONE Rule (cite only)
- Reader Frame Narrative = `story_images_v2[].caption` (unchanged)

---

```text
SPIKE-GRANULARITY-GATE-001

Status:
PASS

Gate Capability:
Post-Propose analysis can FAIL outline-mirrored 5×1 topology (G1+G4) and labeled caption information loss (G3), while PASSing legal 1×N and legal 1×1. No Work-id special case. No production wiring.

Validated Invariants:
G1 PASS — heading≈story is a signal; FAIL only with singleton Frames + shared arc names. Fixture A error; unrelated numbered tales warning-only.
G2 PASS — 1×1 legal (Fixture C); multi-sentence collapse into one Frame is error (unit test). Not the primary miss on Fixture A (those Stories are already over-split).
G3 PASS — labeled uncovered turn = error (Fixture D); unlabeled paraphrase = warning (Fixture C). Empty caption / zero Frames = error.
G4 PASS — Fixture A FAIL: continuous beats cut into isolated single-Frame Stories / Route units.

False Positives:
G1 warning on coincidental heading/story counts; G2 on verbose single-beat summaries; G1/G4 if separate arcs share hero names.

False Negatives:
Unnumbered outlines; one-sentence mega-summaries (G2); unlabeled paraphrased plot loss (G3 by design).

Recommended Gate Boundary:
Discovery Propose → Granularity Gate → Human Review → Approved Runtime → Reader.
Gate validates structure (+ labeled G3). It does not propose, repair, or render.

Post-Gate Action:
RE-PROPOSE

Next Authorization:
Architecture closure on Gate-as-Review-blocker. Production Implementation NOT granted. No ADR in this spike.
```
