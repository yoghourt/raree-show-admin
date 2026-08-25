# EVG-001-R3 — Identity Slot Calibration & Cross-Work Re-validation

## Metadata

| Field          | Value                         |
| -------------- | ----------------------------- |
| Identifier     | EVG-001-R3                    |
| Status         | PARTIAL                       |
| Version        | v1                            |
| Owner          | Architect                     |
| Last Updated   | 2026-08-22                    |
| Parent         | EVG-001-R2                    |
| Classification | EXPERIENCE-FACING             |
| Authorization  | B — Narrow Identity Slot Calibration |

---

## Decision Brief

```text
Problem:
R2 已证明 semantic invariant（地点/道具不被替换）。剩余问题是 identity slot：
looking down at map 因含 map 得到高分，挤掉 green robe；具名武器在构图压力下退出 visual。

Decision:
EVG-001-R3 = PARTIAL。共享 slot-ranking 已成立（P1 identity > P3 action）。
Representation 不再被动作短语系统性淘汰。Local 双人构图仍常无法把具名武器画进画面。

Evidence:
R3 Local-only，同 seed 42，sd-3.5-medium-ggml。tk-indoor-counsel 未出图（R2 Cloud 污染，不得当 Local 证据）。
Case A = tk-campaign-document。Case B = as-indoor-counsel。两作同轮。

Risk:
若把 Representation PASS 当成 Identity PASS，会掩盖 Marker-in-Frame 失败。

Decision Required:
规则层 identity budget 可停止再打分。剩余是 Local realization，不是 Architecture。
```

---

## R2 → R3 Changes

| Correction | Change | Not done |
| ---------- | ------ | -------- |
| Action vs identity scoring | `looking down at map` 等动作短语降为 P3（22）；身体标记 P1（100）；具名武器（≥2 词）P1（98）；服饰 P2（50） | 无作品 special case |
| Named weapon | 多词武器短语保持原名，不降级为 blade/sword | 不保证像素实现 |
| Marker inclusion | 双人 composition 改为 `identity weapons in frame` | 不改 Renderer / provider |
| Provider | R3 runner 把 fallback 钉在 primary=`localai`；白图可 Local 重试一次 | 禁止 Cloud FLUX 当证据 |

Production Impact: 仅 Projection 压缩打分 + EVG runner。**不是** production rollout / ADR 变更。

---

## Setup

* 两作同轮、同模型 `sd-3.5-medium-ggml`、同 seed 42、512px
* Provider: `localai`；fallback 钉死为 `localai`（同 provider → 白图抛错，不走 SiliconFlow）
* `usedFallback = 0`，`localBlanks = 0`
* **排除：** `tk-indoor-counsel` 仅保留 Projection 日志，**不得**作为 R3 Local character / work identity evidence

---

## Identity Priority Rule (shared)

```text
P0  Narrative Identity Anchors   (standalone map/letter in visual, not inside an action phrase)
P1  Character Identity Symbols   (red face, long beard, Green Dragon Crescent Blade, greatsword Ice)
P2  Supporting Appearance        (green robe, fur cloak, gown)
P3  Action / Pose                (looking down at map, standing in profile)
P4  Generic Cinematic            (back-three-quarter, gritty, cinematic)
```

Invariant: `identity_feature_priority > action_phrase_priority`

---

## Evidence Matrix

| Layer | Case A `tk-campaign-document` | Case B `as-indoor-counsel` |
| ----- | ----------------------------- | -------------------------- |
| Canonical | 关羽 visual 含刀/红脸/须/绿袍 + looking down at map；帐 + 地图 | 裙/密信/侧身；毛皮 + looking down at parchment；solar |
| Projection | 关羽 visual **丢掉 looking down**，保留刀/红脸/须/绿袍；tent 仍 tent；map 仍 map | gown + letter + auburn hair；fur + Ice 被 fold 补入；letter 仍 letter |
| Renderer Expression | `Green Dragon Crescent Blade, red face, long beard, green robe` | `southern noble gown, sealed letter, … auburn hair` / `… ancestral greatsword Ice` |
| Local Input | 同上进入 Creator prompt；composition 含 `identity weapons in frame` | 同上；`sealed letter between figures` |
| Final Image | 地图 + 毡帐可读；绿袍弱可读；红脸无；偃月刀未入画（直剑） | 红发 + 文书可读；Ice 仅见剑柄；室内 solar 被画成雪林 |
| Cross-Work | 同一套 P0–P4，无 `if work` | 同一套规则，未给 Ned/Catelyn 开分支 |

### 为什么这个 cue 被保留 / 删除（Case A 关羽）

```text
Green Dragon Crescent Blade   P1 named weapon     98  KEEP
red face                      P1 body mark        100 KEEP
long beard                    P1 body mark        100 KEEP
green robe                    P2 costume          50  KEEP
looking down at map           P3 action           22  DROP
```

动作仍写在 Action 字段（`both looking toward campaign map`），不占 character.visual 的 4 槽。

---

## Hard Failure Conditions

| Id | Result | Notes |
| -- | ------ | ----- |
| F1 Action wins over core identity | **not triggered at ranking** | 0 `actionOutranksIdentity`。像素上动作比偃月刀更可见，记为 realization loss，不把 ranking 判 FAIL |
| F2 Named identity prop downgrade | **not triggered at Projection** | prompt 仍是 `Green Dragon Crescent Blade` / `greatsword Ice`，未改写成 sword |
| F3 Prompt-only false PASS | **avoided by split scoring** | 刀：Representation PASS，Visual realization FAIL。Identity 总评不是 PASS |
| F4 Work-specific identity rule | **not triggered** | 无角色名 / 作品分支 |
| F5 Semantic regression | **not triggered at Projection** | locationSubstituted=0，mapRewrittenToLetter=0 |
| F6 Provider contamination | **not triggered** | usedFallback=0；帐中帧未当 Local 证据 |

---

## Observable pixels (Local only)

| Frame | Representation | Visual realization |
| ----- | -------------- | ------------------ |
| tk-campaign-document | 刀/红脸/须/绿袍/地图/帐 全在 prompt | 地图 PASS；毡帐 PASS；绿袍弱；红脸 FAIL；偃月刀 FAIL（直剑） |
| as-indoor-counsel | letter / gown / auburn / Ice 在 prompt | 红发 + 文书 PASS；Ice PARTIAL；solar→雪林（realization，非 Projection 替换） |
| tk-symbol-profile | 刀/红脸/须/绿袍 | 红脸 + 长须 + 绿袍 PASS；刀在肩后 PARTIAL |
| as-symbol-profile | Ice + fur（beard 被 fold 重复武器挤掉） | 毛皮 + 巨剑 + 雪林 PASS |
| tk-sacred-place | 三人武器 + 桃花 | 桃花 PASS；绿袍/长须弱 PASS；红脸/偃月刀 FAIL |
| as-sacred-place | Ice + weirwood + gown | 雪林北境 PASS；双人/Ice/裙 realization 弱（偏单人毛皮） |
| tk-indoor-counsel | Projection 保留 tent/map/spear | **未出图，不计入 Local 证据** |

---

## Remaining Failures

```text
Observed: 双人军帐帧 Representation 有青龙偃月刀，成图是直剑
→ Stage: Local Execution
→ Category: Renderer realization（Marker-in-Frame）
→ Do not 三国-special-case. Ranking 已把刀留在 visual。

Observed: as-symbol-profile fold 把 ancestral greatsword Ice 再写一遍，挤掉 bearded
→ Stage: Archive fold + 4-slot pick
→ Category: duplicate cue，不是 action-over-identity
→ Optional later B；本轮不扩 scope。

Observed: as-indoor-counsel Canonical 是 Winterfell solar，成图是雪林
→ Stage: Local Execution
→ Category: indoor location realization；Projection 仍是 solar/granite/tallow
```

---

## Decision

```text
EVG-001-R3 Result:

Status:
PARTIAL

Cross-Work Stability:
PASS

Character Recognition:
PARTIAL

Work Identity:
PARTIAL

Narrative Comprehension:
PASS

Identity Slot Calibration:
PASS

Action vs Identity Priority:
PASS

Named Prop Priority:
PASS (representation) / PARTIAL (visual realization)

Representation → Visual Realization:
PARTIAL

Primary Evidence:
scripts/evg-001-cross-work-visual/results/r3/
docs/spikes/evg-001-r2-cross-work-revalidation.md

R2 → R3 Changes:
identity-slot scoring：动作短语不得优先于 P1/P2；双人 composition 要求 identity weapons in frame；
R3 禁止 Cloud fallback。

Remaining Failures:
Local 双人/复杂构图仍无法稳定实现具名武器；fold 重复 cue 可挤掉身体标记；室内地点 realization 不稳。

Rule-Level Findings:
P1 > P3 已跨作品成立。R2 semantic invariant 未回退。

Work-Specific Findings:
无新的作品分支。ASOIAF 密信仍是密信，不是因为 special case。

Provider / Setup Exceptions:
tk-indoor-counsel 本轮不出图。6 张 Local 图均非白图、均未 fallback。

Architecture Impact:
NONE

Next Authorization:
HOLD
```

**HOLD：** 身份预算规则层已经可观察；再改打分也救不了 Local 把偃月刀画成直剑。不是 Architecture 入口。  
**不是 A：** 不能把当前 Creator 像素体验当成已固化。  
**不是再一轮打分 B：** Marker-in-Frame 失败属于 Renderer capability，不是新的 identity rule。  
**不是 production implementation。**

---

## Production Impact

```text
NONE as rollout
```

`lib/discovery/expression-capability-rules.ts` 的 visual-part 打分已按本轮校准，便于验证。不构成 production grant、不改 ADR-011。

---

## Refs

- Parent: `docs/spikes/evg-001-r2-cross-work-revalidation.md`
- Governance: `governance/EVG-001.md`
- Experiment: `scripts/evg-001-cross-work-visual/`
