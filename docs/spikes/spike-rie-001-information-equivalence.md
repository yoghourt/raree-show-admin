# SPIKE-RIE-001 — Discovery → Reader Information Equivalence

**Status:** Spike Implementation **Authorized** · Evidence **PASS**  
**Production Authorization:** **NOT granted**  
**Runtime Truth Gate:** A — Architecture Closure  
**Owner:** Architect · **Executor:** Cursor  
**Date:** 2026-08-19  
**Parent:** Discovery → Reader 画面推进信息损失 · SPIKE-GRANULARITY-GATE-001

---

## What

Isolated spike: after Discovery Propose, do **Frame captions** still drop Source narrative units that a Reader must have, **even when Story/Frame topology is correct** (`1 Story × N Frames`, Granularity Gate PASS)?

Reader-visible narrative authority is **only** `story_images_v2[].caption` (here: Frame.caption). `Story.summary` is a Discovery intermediate. It is traced, **never counted as Reader reconstruction**.

Does **not** modify production code, Granularity Gate, prompts, Accept path, Reader Runtime, or schema.

## Why

Granularity Gate already catches `5 Stories × 1 Frame`. The remaining question is whether **topology correctness ⇒ information equivalence**. If a Gate-PASS `1 × N` still loses “张飞欲杀董卓，但刘备和关羽阻止了他”, then a second validation boundary is a candidate — not a production Gate in this spike.

## How

```text
Source excerpt
      ↓
Narrative Unit inventory (REQUIRED / OPTIONAL / DISCARDABLE)
      ↓
Trace: Story.summary  vs  Frame.caption  vs  Reader (captions only)
      ↓
Human annotation PRESENT | PARTIAL | LOST
      + lexical/entity probe (candidate finder only)
```

Allowlist:

| Path | Role |
| ---- | ---- |
| `scripts/rie-spike/**` | Inventory, fixtures A / B_LOSS / B_KEEP, evaluator, runner |
| `__tests__/spikes/rie-001.test.ts` | Evidence tests |
| `docs/spikes/spike-rie-001-information-equivalence.md` | This record |

Denylist honored: no Reader Runtime, no `story_images_v2` schema change, no Scene Context, no Granularity Gate edits, no Discovery Prompt, no production Accept, no new production Gate, no Work-id branch in evaluators.

Judgment authority is **annotation fixtures**, not keyword / entity / Jaccard overlap.

---

## Validation

```bash
npx vitest run __tests__/spikes/rie-001.test.ts
```

Optional runner (evidence JSON, gitignored):

```bash
npx tsx scripts/rie-spike/run.ts
```

Observations (2026-08-19):

| Fixture | Topology (Gate) | Information Equivalence | Distinctive loss |
| ------- | --------------- | ----------------------- | ---------------- |
| A Actual Propose `5×1` | FAIL (G1+G4) | FAIL | `U-PREVENT` LOST; compound turn PARTIAL |
| B_LOSS `1 Story × 4 Frames` | PASS | FAIL | Attempt + prevention LOST in captions; present in Story.summary |
| B_KEEP `1 Story × 4 Frames` | PASS | PASS | Same topology; captions carry the prevented killing |

Evaluator source does not contain `42c22be9`. Fixture A carries that id as **provenance only**.

---

## Narrative unit inventory (Source)

Source = Three Kingdoms excerpt used by Granularity Fixture A (numbered beats 1–5). Not every token is REQUIRED.

| ID | Kind | Necessity | Source unit |
| -- | ---- | --------- | ----------- |
| U-REBELLION | Event | REQUIRED | 黄巾起义爆发 |
| U-NOTICE | Event | REQUIRED | 发布招兵榜文 |
| U-MEET-OATH | Relationship change | REQUIRED | 刘关张相遇并桃园结义 |
| U-ARMS | Event | REQUIRED | 商人资助、铸兵、起乡勇 |
| U-DAXING | Event | REQUIRED | 大兴山首胜 |
| U-RESCUE | Event | REQUIRED | 救出董卓 |
| U-SCORN | Causal turn | REQUIRED | 董卓因无官职门第而轻视 |
| U-ATTEMPT | Attempted action | REQUIRED | 张飞欲入帐斩董卓 |
| U-PREVENT | Prevented action | REQUIRED | 刘备、关羽劝阻 |
| U-ATTEMPT-PREVENTED | Causal turn | REQUIRED | 欲杀 **但被阻止**（不可降成“张飞、董卓在场”） |
| U-OATH-TEXT | Relationship | OPTIONAL | 结义誓词原文 |
| U-WEAPON-NAMES | Proper-noun grounding | OPTIONAL | 双股剑 / 青龙刀 / 点钢矛 |
| U-QINGZHOU | Event | OPTIONAL | 青州解围 |
| U-THEME | Consequence | OPTIONAL | 门阀偏见与董卓后患的叙述评论 |
| U-COUNTS | Event | DISCARDABLE | 马匹、金银、镔铁、兵力数字 |

---

## Trace tables

Reader Can Recover? = Frame.caption coverage. Story.summary is shown for drop diagnosis only.

### Fixture A — actual Propose (`5×1`)

Topology: **FAIL**. Information: **FAIL** (independent of topology: prevention never reaches any caption).

| Source Unit | Story.summary | Frame.caption | Reader Can Recover? | Classification |
| ----------- | ------------- | ------------- | ------------------- | -------------- |
| U-REBELLION | PRESENT | PRESENT | PRESENT | PRESENT |
| U-NOTICE | PARTIAL | PRESENT | PRESENT | PRESENT |
| U-MEET-OATH | PRESENT | PRESENT | PRESENT | PRESENT |
| U-ARMS | PRESENT | PRESENT | PRESENT | PRESENT |
| U-DAXING | PRESENT | PRESENT | PRESENT | PRESENT |
| U-RESCUE | PRESENT | PRESENT | PRESENT | PRESENT |
| U-SCORN | PRESENT | PRESENT | PRESENT | PRESENT |
| U-ATTEMPT | LOST | PRESENT | PRESENT | PRESENT |
| **U-PREVENT** | LOST | **LOST** | **NO** | **LOST** |
| **U-ATTEMPT-PREVENTED** | LOST | **PARTIAL** | **PARTIAL** | **PARTIAL** |
| U-OATH-TEXT | LOST | LOST | LOST | OPTIONAL |
| U-WEAPON-NAMES | LOST | PRESENT | PRESENT | OPTIONAL |
| U-QINGZHOU | LOST | LOST | LOST | OPTIONAL |
| U-THEME | LOST | LOST | LOST | OPTIONAL |
| U-COUNTS | LOST | LOST | LOST | DISCARDABLE |

Caption 5 (actual Propose): *“nearly provoking Zhang Fei into executing him on the spot.”* Names Zhang Fei + attempt. Does **not** say Liu Bei and Guan Yu restrained him. Entity presence ≠ interruption.

### Fixture B_LOSS — correct topology, dropped intervention

Topology: **PASS** (`1×4`: setup / conflict / attempt / consequence). Information: **FAIL**.

| Source Unit | Story.summary | Frame.caption | Reader Can Recover? | Classification |
| ----------- | ------------- | ------------- | ------------------- | -------------- |
| U-REBELLION | LOST | PRESENT | PRESENT | PRESENT |
| U-NOTICE | PARTIAL | PRESENT | PRESENT | PRESENT |
| U-MEET-OATH | PRESENT | PRESENT | PRESENT | PRESENT |
| U-ARMS | LOST | PRESENT | PRESENT | PRESENT |
| U-DAXING | PRESENT | PRESENT | PRESENT | PRESENT |
| U-RESCUE | PRESENT | PRESENT | PRESENT | PRESENT |
| U-SCORN | LOST | PRESENT | PRESENT | PRESENT |
| **U-ATTEMPT** | **PRESENT** | **LOST** | **NO** | **LOST** |
| **U-PREVENT** | **PRESENT** | **LOST** | **NO** | **LOST** |
| **U-ATTEMPT-PREVENTED** | **PRESENT** | **LOST** | **NO** | **LOST** |

Frame 3: *“Liu Bei, Guan Yu, Zhang Fei, and Dong Zhuo are together in the camp. Dong Zhuo treats the brothers with contempt.”*

Naive entity overlap for `U-ATTEMPT-PREVENTED` is **true**. Annotation is **LOST**.

This is the critical evidence: **Granularity PASS ≠ Information Equivalence.**

### Fixture B_KEEP — control

Same `1×4` topology. Frame 3 states the attempt **and** the restraint. Required caption coverage all PRESENT → Information **PASS**. Method can distinguish LOSS vs KEEP without Work id.

---

## Losses classified

**Destroys Reader understanding (must sink to Frame.caption)**

- `U-PREVENT` / `U-ATTEMPT-PREVENTED`: interruption of an attempted killing. Without it, Reader only sees scorn + Zhang Fei nearby, not the plot turn.
- On B_LOSS, these units sit in **Story.summary only** — exactly the forbidden “authority leak.”

**Reasonable compression (OPTIONAL / DISCARDABLE)**

- Exact oath text, troop/fund counts, Qingzhou beat, narrator moralizing, named weapons (A keeps weapons in captions; B compresses them).

**Actual Propose (A) vs B_LOSS**

- A is a **topology failure** *and* an information failure (prevention absent from every caption).
- B_LOSS is **topology success** and **information failure**. Topology is therefore **not sufficient**.

**Story-only vs Frame-only**

- B_LOSS Story-only REQUIRED: `U-ATTEMPT`, `U-PREVENT`, `U-ATTEMPT-PREVENTED`.
- A Frame-only: `U-ATTEMPT` (caption has attempt; Story.summary of that singleton does not). Direction of drop is not always Story⊃Caption; Reader still only sees captions.

---

## Answers (required)

### Q1 — After Granularity Gate PASS, is there still Reader information loss?

**Yes, it can.** Fixture B_LOSS: Gate PASS, REQUIRED attempt/prevention LOST from captions.

Fixture A also loses prevention, but Gate already FAILs for topology. A does not isolate the two failures. B_LOSS does.

### Q2 — Is Story.summary → Frame.caption a systematic drop?

**Observed pattern, not a proof of every Propose.** When the model treats Story as the “plot container” and Scene as “who is on stage,” attempted **actions** and **interruptions** fall out of captions while names remain. B_LOSS is constructed to that pattern; A shows a milder live instance (attempt kept, prevention dropped).

Not every unit drops: rebellion, oath, Daxing, rescue, scorn can survive in captions even when Story.summary is thinner.

### Q3 — Is caption still the correct Reader narrative authority?

**Yes.** Changing authority to Story.summary would let Reader skip Frames and would hide the B_LOSS bug by reading the wrong layer. The defect is **caption authorship / validation**, not the Frame-as-authority rule.

### Q4 — Does Information Equivalence need a boundary independent of Granularity Gate?

**Candidate: yes.** Granularity Gate validates Story/Frame **cardinality and route continuity**. It explicitly refuses unlabeled semantic G3 as error (SPIKE-GRANULARITY-GATE-001). Information Equivalence is a different invariant: REQUIRED narrative units must be recoverable from **caption sequence**.

Collapsing both into one Gate would either (a) fake semantics as string match, or (b) miss B_LOSS because topology is legal.

### Q5 — If needed, what is the minimal correct boundary? (not an implementation)

Invariant candidate (not wired):

```text
For each REQUIRED narrative unit U (human- or spec-labeled):
  Reader reconstruction = concat(Frame.caption in Route order)
  U must be PRESENT in that reconstruction
  Story.summary MUST NOT satisfy U
```

Minimal next step if authorized later: labeled-unit check **after** Granularity PASS, **before** Accept — still a validator, not a caption generator, not an LLM judge in v1 (labels like existing G3 `requiredTurns`, but judged as **narrative coverage**, not token overlap). Unlabeled paraphrase remains Human Review.

Unresolved: who authors the REQUIRED inventory (operator vs frozen Work canon); how PARTIAL is treated (this spike FAILs REQUIRED PARTIAL); whether OPTIONAL proper-noun grounding ever becomes REQUIRED for a given Work.

---

## False positives / negatives (method)

- Annotation is the verdict; a different annotator might call A’s “nearly provoking … on the spot” PARTIAL prevention. Spike treats prevention as LOST unless the **interrupters and the interruption** are recoverable.
- B_LOSS is a constructed Propose-shaped fixture, not a new live LLM sample. It proves **possibility independent of topology**, not frequency.
- Naive entity overlap **false-PASS** on B_LOSS is demonstrated on purpose.

---

## Recommended boundary (not implemented)

Keep:

```text
Propose → Granularity Gate → Human Review → Accept
```

Candidate addition (authorization required):

```text
Granularity PASS
      ↓
Information Equivalence (labeled REQUIRED units vs captions)
      ↓
PASS → Accept may proceed
FAIL → block Accept / RE-PROPOSE or Human caption edit
```

Do **not**: write Story.summary into Reader; auto-repair captions; fold this into G1–G4.

---

## Next Authorization

Architect: accept or amend. **Production Implementation is not granted.** If granted: specify label source + PARTIAL policy; do not start from keyword matching.

Do not draft an ADR from this spike until that authorization.

---

## Refs

- Grant: SPIKE-RIE-001 (this document)
- SPIKE-GRANULARITY-GATE-001
- Reader Frame Narrative = `story_images_v2[].caption` (unchanged)
- Caption persist today: Scene staging `summary` → Frame.caption (`captionFromStaging`) — cited only
