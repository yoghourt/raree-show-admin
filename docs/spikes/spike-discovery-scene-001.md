# SPIKE-DISCOVERY-SCENE-001 — Source → Discovery → Scene → Runtime Information Loss

**Status:** Spike Implementation **Authorized** · Evidence **PARTIAL**  
**Production Authorization:** **NOT granted**  
**Grant:** Locate Information Loss. Do **not** design a new Canon layer.  
**Serves:** A — Architecture Closure · D2 — AI-Assisted Content Pipeline  
**Constraint:** Runtime Truth v1 Freeze  
**Date:** 2026-08-20  
**Owner:** Architect · **Executor:** Cursor

---

## What

Locate **where, why, and which narrative information is lost** on:

```text
SOURCE CONTENT → DISCOVERY → ACCEPTED SCENE → RUNTIME FRAME / CAPTION
```

This spike does **not** create `work_canon`, atomic fact review, or a new Scene schema.

---

## Why

RIE-001/002 proved captions can drop REQUIRED turns even when topology is later fixed. Granularity Gate proved `5 Stories × 1 Frame` is a broken Reader progression. Neither spike answered:

> Is Discovery failing to extract, is the Scene contract unable to hold the information, or does Accept / Projection / Runtime mapping drop it?

Those three diagnoses authorize three different follow-ups.

---

## How

```text
Production Source excerpt
      ↓
Durable Discovery residual (Accept persist — session Propose is not durable)
      ↓
Accepted Story.summary + Scene staging fields
      ↓
Runtime: story_images_v2[].caption + scene_contexts_v1 + appearance
      ↓
Information Loss Ledger (annotated + lexical probe)
```

Allowlist:

| Path | Role |
| ---- | ---- |
| `scripts/discovery-scene-spike/**` | Read-only Runtime dump, frozen cases, ledger, runner |
| `__tests__/spikes/discovery-scene-001.test.ts` | Evidence |
| `docs/spikes/spike-discovery-scene-001.md` | This record |

Denylist honored: no `work_canon`, no Canon DB, no atomic-fact UI, no Human Authority change, no Character/Location/Story ownership change, no Scene schema expansion, no Prompt tuning, Discovery Candidate not treated as Runtime Truth.

### Runtime evidence source

Read-only dump `2026-08-20T10:01:08.250Z` (`SCENE_CONTEXT_PROJECTION_ENABLED=1`):

| Work | Scenes | Notes |
| ---- | ------ | ----- |
| Romance of the Three Kingdoms | 5 Reading Routes | Sole Work with Discovery → Frame persist |
| Harry Potter / Three-Body / GoT | 0 scenes | Not used |

Discovery Review snapshots live in **browser sessionStorage only**. There is no durable Propose JSON for the accepted batch. The first durable snapshot is Accept persist:

```text
Story.summary          → scenes.summary
Scene.summary          → story_images_v2[].caption
visualIntent           → frame_provenance_v1 + scene_contexts_v1.visualIntentAudit
rendererExpression     → frame_provenance_v1 + creationFacingVisualExpression
appearance             → scene_contexts_v1.characterAppearanceContext
                       (from Expression.characters, not from caption names)
```

A later Propose snapshot (SPIKE-GRANULARITY-GATE-001 Fixture A, `2026-08-19`) of the **same Source** is cited only as a second Discovery sample — not as this Work's Accepted Truth.

---

## Validation

```bash
npx tsx scripts/discovery-scene-spike/dump-runtime.ts
npx tsx scripts/discovery-scene-spike/run.ts
npx vitest run __tests__/spikes/discovery-scene-001.test.ts
```

---

# Findings

## Where is information lost?

**First durable loss is not a single stage.** Production evidence splits:

| First loss | Typical stage | Evidence |
| ---------- | ------------- | -------- |
| Never enters any durable field | Discovery extraction | Zou Jing's advice; 宦官/天灾 cause chain; Qingzhou; 次日; 结义排行 |
| Enters Story.summary, never Scene.summary/caption | Discovery Scene contract (one still = one caption) | Daxing slaying; Dong Zhuo rescue; Zou Jing on Daxing; enemy proper names |
| Enters Intent/Context, not Frame.caption | Projection / Runtime mapping | class-prejudice cause; sworn-brother relationship string |
| Enters caption, missing from Step appearance | Runtime mapping (appearance ← Expression.characters) | Liu Yan on the notice; Dong Zhuo in the tent |
| Story accepted, zero Frames | Projection persist incomplete | Merchant Patronage route |

Stage-by-stage (production path, not the SPEC narrative):

```text
Source
  ✓  locked excerpt (five numbered beats)
Discovery extraction
  ✗  omits some causal agents and time/order clauses
  ✓  usually gets the headline event into Story.summary
Candidate schema
  ✗  Scene.summary is dual-use: Reader caption AND still description
  ✗  no first-class time / causality / prevented-action / sequence
  ✓  visualIntent.relationship/emotion/purpose exist — but they are not Reader authority
Human Accept/Edit
  ≈  copies Candidate fields; does not systematically add missing Source turns
  ✗  Peach Garden Story.summary ships typo "Zhang Feng" (caption is correct)
Approved Story/Scene
  ✗  5 Stories × 1 Frame (known-bad Granularity topology is in production)
  ✗  Merchant Story has no child Frame
Projection
  ✓  caption := Scene.summary (faithful)
  ✗  therefore a still-shaped Scene.summary becomes Reader Truth
  ✗  Context.chapter_number copies Scene staging (often 1), not Route.chapter_number
Reading Frame / caption
  =  Reader narrative authority (RIE-001). Context extras are not caption.
```

## Why is it lost?

Three different mechanisms — **do not merge**:

### A. Discovery extraction problem

The model never wrote the fact into **any** Candidate field that survived persist.

Examples: Zou Jing advising Liu Yan; 宦官专权 / 天灾; Qingzhou; peach-garden birth order; “次日”.

Schema **had room in prose** (`Story.summary` / `Scene.summary`). This is not “no column”.

### B. Discovery → Scene contract problem

**Primary finding of this spike.**

`Scene.fields.summary` is the Reader caption (`captionFromStaging` / `from-candidates.frameNode`). The same string is authored next to Canonical Visual Expression, whose rules prefer a **static still** (Rule 3: prefer 2 figures; static geometry; no physics). Production Scene summaries are still-shaped even though the Propose prompt says not to shorten reader prose for the image model.

Consequence:

```text
Story.summary  = editorial compression of the Source beat (often keeps outcome)
Scene.summary  = one still
Frame.caption  = Scene.summary
Reader         = the still, not the Story
```

Daxing is the proof: Story.summary has “Zhang Fei and Guan Yu **slay** Deng Mao and Cheng Yuanzhi”; caption is “**confront** the Yellow Turban commanders on horseback”. Accept did not delete the kills — they were never in the Scene caption field.

The 5×1 topology makes this worse: one Frame cannot carry an ordered pair of duels except as prose, and the prose chose the still.

`visualIntent.relationship` **can** hold relationship language. It is audit / Context only (SPEC-DVE-001). It is not Reader reconstruction.

There is **no** first-class field for Time, Causality, Prevented action, or Sequence. Those survive **only if** Scene.summary prose includes them. Dong Zhuo **prevention** survived in this production caption (`restrain`) for that reason — not because a fact model exists. RIE Fixture A’s later Propose of the same Source dropped prevention. Candidate output is unstable; it is not Canon.

### C. Projection / Runtime mapping problem

1. **Appearance is not projected from caption names.** `associateStagingToSceneContext` builds `characterAppearanceContext` from `rendererExpression.characters` (Intent names as join). Dong Zhuo is in the caption as “arrogant Dong Zhuo” but Expression lists only the three brothers; action calls him “elevated seated officer”. L4-B Reader Step cast therefore omits Dong Zhuo. Liu Yan is in the notice caption; Expression.characters is `[]`.

2. **Context extras are not Reader caption.** `readerFacingNarrativeContext.relationship/emotion/purpose` persist. L4-B consumes appearance + place. Frame remains `{url, caption}`. Class-prejudice **cause** sits on Story.summary + Intent.purpose and never becomes caption.

3. **Incomplete Frame persist.** Merchant route: Story.summary present, `story_images_v2=[]`, empty provenance, empty Contexts. A Scene that never projects a Frame is not in Runtime Reading.

4. **Chapter identity split.** Routes are chapter 1, 2, 4, 6, 7 (`nextChapterNumber` at Story persist; Story Candidate has no sequence field). Context `narrativeMoment.chapter_number` is `1` on Daxing and Dong Zhuo. Sequence is persist order, not Source order.

5. **Place archive unbound.** Context has `environmentFromExpression`; this Work has **zero** Location archive rows. Step place cannot join Archive.

Creator Expression weakening (`gesturing` vs caption `restrain`) is **not** Reader loss. ADR-011: Expression is Creator still; caption is Reader prose. Do not “fix” this by stuffing caption into Local prompts.

---

## What information is actually required?

A Scene may enter Runtime when **all** of the following hold. Only items proven on this dump:

1. **At least one Reading Frame** whose `caption` is non-empty. Merchant fails.
2. **Caption carries every Reader-required turn of this Scene** — including outcome, attempted action, and prevented action when those are the beat. Daxing fails (kills only on Story.summary). Dong Zhuo prevention **passes** because caption has `restrain`.
3. **Caption, not Story.summary, is Reader narrative authority.** Story.summary may be richer; it does not reconstruct the Step (RIE-001, confirmed here).
4. **Every named agent the Step must show appears in `characterAppearanceContext`.** Caption-only names are insufficient (Dong Zhuo, Liu Yan).
5. **Place cue exists** as `locationContext.environmentFromExpression` (Archive join is optional; unbound archive is a catalog gap, not a Scene-field gap).
6. **1 Story × 1 Frame is not sufficient** when Source has multiple Reader-required turns inside that Story. Production is 5×1. Granularity Gate already FAILs this; this spike shows the information loss that follows.

## What is NOT required?

Proven discardable without blocking Reader reconstruction of the beat’s REQUIRED turn:

| Not required | Evidence |
| ------------ | -------- |
| Exact counts (五百乡勇、数万敌军、五十匹马…) | Absent everywhere; RIE DISCARDABLE |
| Verbatim oath text | Peach Garden caption still conveys sworn brotherhood |
| Weapon proper names in caption | Optional; may live on Expression.visual |
| Qingzhou as prior campaign | Never extracted; OPTIONAL in RIE-001 |
| Narrator foreshadowing of Dong Zhuo’s later tyranny | Intent.purpose has prejudice, not the prophecy |
| `visualIntent` as Reader input | Audit / Context only |
| Expression lighting / atmosphere / Local prompt caps | Creator path, not Reader caption |
| Work Canon / atomic facts / per-fact Human review | Out of grant; not needed to locate loss |

---

# Information Loss Ledger

Source = production Three Kingdoms excerpt (heading 1 / 4 / 5).  
Discovery / Accepted = durable persist residual (not live Propose JSON).  
Runtime = `story_images_v2[].caption` + Context.

Presence: **Y** present · **P** partial · **N** absent.

### Case 1 — Simple: recruitment notice  
Route `scene_1787049985248` · caption: *Prefect Liu Yan posts the official recruitment notice in Zhuozhou…*

| Source information | Discovery | Accepted | Runtime caption | Context | Appearance | Loss point | Cause |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 刘焉发榜 | Y | Y | Y | Y | N | Runtime mapping | appearance ← Expression.characters `[]` |
| 张角黄巾起义 | Y | Y | P | P | N | Semantic compression | Story has Zhang Jue; caption only “Yellow Turbans” |
| 刘焉采纳邹靖建议 | N | N | N | N | N | Extraction | never written |
| 宦官专权 / 天灾 | N | N | N | N | N | Extraction | never written |
| 涿郡地点 | Y | Y | Y | Y | — | Runtime mapping | environment string only; no Location archive |

### Case 2 — Dense: Mount Daxing  
Route `scene_1787050009691` · Story.summary has slaying · caption: *Guan Yu and Zhang Fei confront the Yellow Turban commanders…*

| Source information | Discovery | Accepted | Runtime caption | Context | Appearance | Loss point | Cause |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 阵前对峙 / 大兴山 | Y | Y | Y | Y | N | none (control) | still survives |
| 张飞杀邓茂、关羽斩程远志 | Y | Y | **N** | N | N | Semantic compression | **B: Scene.summary is the still** |
| 刘备率军 / 邹靖 | Y | Y | N | N | N | Semantic compression | in Story.summary only |
| 敌将具名 | Y | Y | N | N | N | Semantic compression | caption says “commanders” |
| 两场单挑的顺序 | N | N | N | N | N | Schema | 1 Frame, no sequence field |
| 兵力数字 | N | N | N | N | N | Extraction | not required |
| Source 第 4 拍 vs Context chapter 1 | P | P | N | P | N | Projection | Context.chapter_number=1; Route=4 |

### Case 3 — Causal / relationship: Dong Zhuo  
Route `scene_1787050018425` · caption: *Zhang Fei reaches for his sword … Liu Bei and Guan Yu restrain him before an arrogant Dong Zhuo.*

| Source information | Discovery | Accepted | Runtime caption | Context | Appearance | Loss point | Cause |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 救出董卓 | Y | Y | **N** | N | N | Semantic compression | B: caption is tent still |
| 因无官职门第而轻视 | Y | Y | N | N | N | Runtime mapping | in Story.summary + Intent.purpose; not caption |
| 张飞欲杀 | Y | Y | Y | Y | N | none | caption saved it |
| 刘备关羽劝阻（未杀成） | Y | Y | **Y** | Y | N | none | **caption prose, not a fact field** |
| 董卓在场 | Y | Y | Y | Y | **N** | Runtime mapping | C: omitted from Expression.characters |
| 结义兄弟关系 | Y | Y | N | Y | N | Runtime mapping | C: Context.relationship not caption |
| 青州解围 | N | N | N | N | N | Extraction | not required |
| 预示日后专权 | P | P | N | P | N | Semantic compression | OPTIONAL |

### Appendix (same Work, not a fourth required case)

| Artifact | Evidence |
| -------- | -------- |
| Merchant Patronage `scene_1787050035308` | Story.summary has funding + forging; **0 Frames**, empty Context. Projection hole. |
| Peach Garden caption | Oath still present. Story.summary typo **Zhang Feng**. Wine-shop meeting, 次日, birth order, oath wording not in caption. |
| Granularity Fixture A (later Propose) | Same Source; Dong Zhuo caption **lacks** prevention. Accepted production caption **has** it. Discovery is not a stable Truth. |

---

# Minimal Scene Information Contract

Only fields/relations **this dump proved stable and necessary**. Not a full Scene schema.

```text
SceneAdmission (Runtime-safe)

MUST
  1. projectedFrames.length >= 1
  2. each Frame.caption === Scene.summary (current persist law)
  3. Frame.caption contains every Reader-required turn of THIS scene
     (event / outcome / attempt / prevention when they are the beat)
  4. Story.summary MUST NOT be counted as Reader reconstruction
  5. characterAppearanceContext names every agent the Step must show
     (join key: Expression.characters ∪ caption-named agents)
  6. locationContext.environmentFromExpression is non-empty when the beat is placed
  7. if Source turns > 1 inside the parent Story, Frame count > 1
     (1×1 is not sufficient — Granularity + this ledger)

MUST NOT treat as Reader authority
  - visualIntent
  - rendererExpression
  - readerFacingNarrativeContext.relationship / emotion / purpose
  - Story.summary

MAY (Creator / audit)
  - visualIntent, rendererExpression, lighting/atmosphere
  - Location archiveTsid when catalog has a match

NOT in this contract
  - counts, oath wording, weapon proper names, narrator prophecy
  - Work Canon units
  - per-fact Human review
```

Human review workload is **not** increased: admission is deterministic against caption + appearance + frame count, using the same Story/Frame object RIE already validates when Canon/Bind exist. This spike does **not** wire that gate.

---

# Architecture Recommendation

**Split. Do not merge into “Discovery is bad.”**

### B — Discovery → Scene contract  *(primary)*

Scene.summary is contracted as **Reader caption** and authored as **still description**. Production Daxing / Dong Zhuo rescue / 5×1 topology are this problem. Prompt already forbids shortening captions; the field dual-use + Expression still-rules still win.

Follow-up is **contract**, not prompt tuning: either Scene gains a Reader-caption field distinct from still-facing summary (schema change — **not authorized here**), or admission requires caption to carry Story-required turns of that scene (RIE already states this; production 5×1 still ships still-captions).

### C — Projection / Runtime mapping  *(confirmed, separate)*

- Appearance ← Expression.characters, not caption-named agents (Dong Zhuo, Liu Yan).
- Context.relationship/purpose persist but are not Reader caption.
- Merchant: Story persist without Frame.
- Chapter numbers: Story has no sequence; Context copies staging `1`.

### A — Discovery extraction  *(real, narrower)*

Facts that never entered any field: Zou Jing→notice causality, 宦官/天灾, Qingzhou, 次日, birth order. Do **not** treat Daxing’s missing kills as A — those kills **were** extracted into Story.summary.

---

# Next Authorization

```text
PARTIAL
→ Targeted follow-up spike
```

**Not PASS → Implement:** wiring a new Scene schema or fact-review UI would violate this grant. RIE Accept is already **fail-closed** on missing Work Canon (`INFORMATION_EQUIVALENCE_CONTEXT_REQUIRED`); do not silently reopen Accept.

**Not BLOCKED:** loss locations are evidenced. No new Canon layer is required to proceed.

Targeted follow-ups (separate grants):

1. **SPIKE-DISCOVERY-SCENE-002 (contract)** — Can Scene admission distinguish Reader caption from still Expression without a new Canon / fact model? Reuse RIE caption authority. No prompt rewrite as the fix.
2. **SPIKE-DISCOVERY-SCENE-003 (mapping)** — Appearance join: caption-named agents vs Expression.characters. Prove Step cast for Dong Zhuo / Liu Yan without changing ownership.
3. **Projection completeness** — Story persist with 0 Frames is not Runtime-sufficient (Merchant). Operational, not a new ontology.

Do **not** authorize: `work_canon` from this spike, atomic narrative facts, Prompt-only repair, treating Fixture A / Propose JSON as Production Canon.
