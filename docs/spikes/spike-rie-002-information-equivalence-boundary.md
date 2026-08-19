# SPIKE-RIE-002 — Information Equivalence Minimal Production Boundary

**Status:** Spike Implementation **Authorized** · Evidence **PASS**  
**Production Authorization:** **NOT granted**  
**Parent Evidence:** SPIKE-RIE-001 PASS  
**Architect Decision (input):** Granularity 与 Information Equivalence **分离建模**  
**Date:** 2026-08-19

---

## What

Spike-only validator contract: after Granularity Gate PASS, can a **deterministic, fixture-driven** check prove that a Discovery **Story + Frame.caption sequence** preserves Source units marked REQUIRED — without treating entity overlap as PRESENT, without counting `Story.summary`, and without generating/repairing captions?

Does **not** modify production Runtime, Granularity Gate, Prompt, Accept, Reader, schema, or write ADR/SPEC.

## Why

RIE-001 proved: `1 Story × N Frames` + Gate PASS can still lose “张飞欲杀董卓，但刘备和关羽阻止了他”. This spike asks **what the smallest validation object / input / output is** that would block that loss before Accept.

## How

```text
Granularity Gate PASS
        ↓
Information Equivalence Validator (spike)
  input:  one Story candidate + child Frame.captions
          + claimed REQUIRED unit ids
          + human observations (PRESENT | PARTIAL | LOST)
  output: PASS | FAIL
          + per-unit { status, supportingFrameIds, reason, expected, observed }
```

Allowlist:

| Path | Role |
| ---- | ---- |
| `scripts/rie-002-spike/**` | Candidate/route validator, fixtures A–D + mix |
| `__tests__/spikes/rie-002.test.ts` | Evidence |
| `docs/spikes/spike-rie-002-information-equivalence-boundary.md` | This record |
| Reuse `scripts/rie-spike` inventory + B_KEEP / B_LOSS | RIE-001 fixtures |

Denylist honored: no production Gate/Accept/Prompt/caption generator/repair/LLM judge; caption remains Reader authority.

---

## Validation

```bash
npx vitest run __tests__/spikes/rie-002.test.ts
```

| Experiment | Granularity | IE | Notes |
| ---------- | ----------- | -- | ----- |
| A `B_KEEP` | PASS | **PASS** | Full preservation of claimed REQUIRED units |
| B `B_LOSS` | PASS | **FAIL** | `U-ATTEMPT`, `U-PREVENT`, `U-ATTEMPT-PREVENTED` LOST |
| C compression | PASS | **PASS** | Counts / oath text / weapon names / Qingzhou dropped |
| D entity-overlap trap | PASS | **FAIL** | All four names present; compound turn LOST |
| Mix: early candidate | — | **PASS** | Candidate-level does not punish the intact Story |
| Mix: trap candidate | — | **FAIL** | Blocks only the broken Story |
| Mix: route-level concat | — | **FAIL** | Whole-batch FAIL — too coarse for Accept |

---

## Findings table

| Question | Result |
| -------- | ------ |
| REQUIRED units 是否稳定可标注 | **Yes** for Event, Causal Turn, Attempted Action, Prevented Action, Relationship Change, and the **compound** Attempted+Prevented. OPTIONAL proper-noun / counts / narrator consequence are stable as *non-blocking*. PARTIAL on REQUIRED is treated as FAIL (not “good enough”). |
| Candidate-level 是否足够 | **Yes, and it is the minimum.** Object = one Story + its Frames (the Accept cascade unit / one Reader Route after Granularity PASS). |
| Route-level 是否必要 | **Not required to catch RIE-001 loss.** Useful as diagnostics. On a mixed batch it FAILs the whole Propose, blocking an intact Story. Too coarse. |
| 合理压缩能否区分 | **Yes.** Experiment C drops numbers, weapon names, oath wording, Qingzhou; REQUIRED events/turns stay PRESENT → PASS. |
| Entity overlap trap 是否能拦截 | **Yes.** Experiment D (and B_LOSS): 张飞/刘备/关羽/董卓 all in captions → still FAIL with `ENTITY_OVERLAP_ONLY`. |
| Validator 是否可 deterministic / fixture-driven | **Yes.** Verdict is claimed-unit observations, not Jaccard/LLM. Same fixtures replay. |
| 最小生产边界 | After Granularity PASS, **before Accept**, validate each Story candidate: every **claimed REQUIRED** unit must be **PRESENT** in that Story’s **Frame.caption sequence**. Story.summary is not an input to the verdict. FAIL → block Accept / Human caption edit or RE-PROPOSE. No auto-repair. |

---

## Q1 — Can REQUIRED units be a stable validation object?

**Yes, if scoped.**

Stable kinds (RIE-001 inventory, replayed here):

| Kind | Stable? | Note |
| ---- | ------- | ---- |
| Event | Yes | “起义 / 榜文 / 首胜 / 救援” |
| Causal turn | Yes | Scorn *because* no rank |
| Attempted action | Yes | 欲杀 — must not collapse to “张飞在场” |
| Prevented action | Yes | 劝阻 — must name interrupters + interruption |
| Compound causal (`U-ATTEMPT-PREVENTED`) | **Required as its own unit** | Attempt PRESENT + Prevent LOST = compound PARTIAL/LOST |
| Relationship change | Yes | 结义 |
| Proper-noun grounding | Annotate OPTIONAL unless Work canon says otherwise | Compression-safe |
| Consequence (theme) | OPTIONAL | Narrator, not Reader-required |

Unstable without a rule: treating “nearly executing” as prevention. This spike: prevention is PRESENT only if **who stopped it** and **that it was stopped** are recoverable from captions.

**Claimed units:** a Story is not responsible for the entire Source. Candidate input includes `claimedUnitIds` (in production: units the Story summary/labels commit to). That is what keeps candidate-level from demanding the whole book inside one Scene.

---

## Q2 — Minimal validator boundary

```text
A. Candidate-level  Story + its Frames     ← recommended minimum
B. Route-level      all Stories’ captions  ← diagnostic only
```

RIE-001 loss lives **inside one Story’s caption sequence**. After Granularity PASS, that Story *is* the Reader Route. Validating that candidate is necessary and sufficient to block Accept of the broken Route.

Route-level concat:

- Still sees the trap (FAIL) — so it *can* detect the unit.
- Mix experiment: early Story PASS + trap Story FAIL, but route FAIL would block **both**. Wrong Accept granularity.

Do **not** wait for a Work-wide Route validator to ship this boundary.

---

## Q3 — Validator output

```ts
{
  status: "PASS" | "FAIL"
  scope: "candidate"
  units: [{
    unitId, kind, necessity,
    status: "PRESENT" | "PARTIAL" | "LOST",
    supportingFrameIds,
    reason,   // PRESERVED | ENTITY_OVERLAP_ONLY | ...
    expected, // source unit
    observed  // caption(s)
  }]
}
```

Example (Experiment B / D):

```text
U-ATTEMPT-PREVENTED
Status: LOST
Expected: 张飞欲杀董卓，但刘备和关羽阻止了他
Observed Frame f3/t2: “Liu Bei, Guan Yu, Zhang Fei, and Dong Zhuo are together… contempt.”
Reason: ENTITY_OVERLAP_ONLY
Result: FAIL — causal compound not recoverable
```

Policy: REQUIRED + LOST or PARTIAL → candidate **FAIL**. OPTIONAL never blocks.

---

## Compression vs loss

| | Compression (C) | Loss (B/D) |
| --- | --- | --- |
| Dropped | 五十匹、金银、镔铁、誓词原文、青龙刀名、青州、主题评论 | 欲杀、劝阻、欲杀但被阻止 |
| Reader still knows | 起义、榜文、结义、起兵、大兴山、救董卓、轻视、被拦住 | 只知道四人在场 + 轻视 |
| IE | PASS | FAIL |

---

## Recommended production boundary (not implemented)

```text
Propose
  ↓
Granularity Gate
  PASS → Information Equivalence (candidate: Story + Frame.captions + claimed REQUIRED units)
           PASS → Human Review / Accept
           FAIL → block Story/Frame Accept; RE-PROPOSE or Human caption edit
  FAIL → existing RE-PROPOSE (topology)
```

- Validator only. No caption generator, no repair, no LLM judge, no Story.summary as Reader authority.
- Labels / claimed units are the semantic authority (same class as Granularity G3 `requiredTurns`, but judged as **narrative recoverability**, not token overlap).

---

## Unresolved questions

1. Who authors `claimedUnitIds` in production (operator labels vs frozen Work canon vs Propose-emitted unit list)?
2. Cross-language paraphrase of “restrain/prevent/劝阻” without labels — still Human Review.
3. Should REQUIRED PARTIAL ever be warning-only? This spike: no (Reader-breaking).
4. Frequency of B_LOSS-shaped Propose in the wild — not measured here.

---

## Next Authorization

Implementation of the candidate-level validator on **Propose → Review Accept** (after Granularity), if granted. Do not fold into G1–G4. Do not draft ADR until Implementation authorization.

---

## Refs

- SPIKE-RIE-001
- SPIKE-GRANULARITY-GATE-001
- Reader authority: `story_images_v2[].caption`
