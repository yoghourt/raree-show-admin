# EVG-001-R2 — Cross-Work Rule Correction & Re-validation

## Metadata

| Field          | Value                         |
| -------------- | ----------------------------- |
| Identifier     | EVG-001-R2                    |
| Status         | PARTIAL                       |
| Version        | v1                            |
| Owner          | Architect                     |
| Last Updated   | 2026-08-22                    |
| Parent         | EVG-001                       |
| Classification | EXPERIENCE-FACING             |

---

## Decision Brief

```text
Problem:
R1 的共享 Projection 会发明地点/替换道具，并把作品身份丢在 styleHints 里。

Decision:
EVG-001-R2 = PARTIAL。共享规则层的 semantic substitution 已消除（tent 不再变 Winterfell，map 不再变 letter）。Local 成图仍会丢掉部分 Tier-1 武器/汉装，室内三国仍可能被画成北境质感。

Evidence:
R1 原样 + R2 同 seed 对照。Projection 日志 0 location/prop substitution。tk-campaign-document（Local）地图还在，但关羽红脸/青龙刀/绿袍未入画。tk-indoor-counsel Local 白图后 Cloud fallback，不得计入同模型像素对照。

Risk:
若把当前规则当成已固化的 Creator 体验，室内帧仍可能跨作品同质化。

Decision Required:
规则层 semantic invariant 可进入下一阶段；身份槽位（visual 里的动作短语挤掉服饰）与“武器必须在画面内”需要再一轮 Representation Calibration（Next = B 的窄范围），或把剩余问题交给 Renderer capability 验证（非 Architecture）。
```

---

## R1 → R2 Changes

| Correction | Change | Special-case removed |
| ---------- | ------ | -------------------- |
| A Location | `sharpenExpressionAnchors` 只允许缩短 environment，禁止换成另一个地点 | Winterfell / weirwood 改写 |
| B Prop | 删除 `map`→`letter`；hand-transfer 保留原物件 | sealed parchment 作为万能文书 |
| C Identity | Archive `identityCues`（≤3）+ visual 压缩优先身体标记/具名武器 | 2-slot Ice/letter/raven 词典 |
| D Work identity | Local prompt 消费 environment 材料 + `visualEmphasis`；仍不把 styleHints 当身份 | cinematic/gritty 堆砌 |
| E Leakage | 删除 Ned/Catelyn costume mutex；dual-cast 不再发明 pool-with-sword | 角色名分支 |

Production Impact: 规则在 Creator Projection 路径落地，**不是** production rollout / ADR 变更。

---

## Setup (unchanged except one recorded exception)

* 两作同轮、同模型 `sd-3.5-medium-ggml`、同 seed 42、同评估协议
* **Exception:** `tk-indoor-counsel` Local 出近白图，Capability 走了 SiliconFlow FLUX。该帧 **不得** 作为同模型像素证据。Case A 的 Local 证据改用 `tk-campaign-document`。

---

## Evaluation (Q1–Q7)

| Q | Question | Projection | Local image |
| - | -------- | ---------- | ----------- |
| 1 | Location kept? | PASS（帐仍是 tent） | PARTIAL（军帐地图帧看不出毡帐） |
| 2 | Narrative prop kept? | PASS（map≠letter） | PASS（地图仍是地图；刀常被裁掉） |
| 3 | Identity symbols kept? | PASS（红脸+长须+青龙刀在 prompt） | PARTIAL（侧身帧有红脸长须无刀；地图帧三者皆弱） |
| 4 | Work identity executable? | PASS（材料 + visualEmphasis 进 Local） | PARTIAL |
| 5 | Two works different? | PASS | PARTIAL（户外可分；室内 Local 三国偏北境质感） |
| 6 | Reverse pollution? | PASS（ASOIAF 未被拉成三国） | PASS |
| 7 | Cross-work rules? | PASS（Projection 无作品分支） | n/a；propose few-shot 仍偏 ASOIAF |

---

## Hard Failure Conditions

| Id | Result | Notes |
| -- | ------ | ----- |
| F1 Location substitution | **not triggered** at Projection | R1 的 tent→Winterfell 未再现 |
| F2 Prop substitution | **not triggered** at Projection | R1 的 map→letter 未再现 |
| F3 Identity collapse | **not at Projection**; **partial at Local pixels** | prompt 有符号，成图常丢刀/绿袍 |
| F4 Work identity collapse | **partial at Local indoor** | 户外桃花 vs 雪林仍可分 |
| F5 Reverse bias | **not triggered** | ASOIAF 仍是北境，没有被画成汉营 |
| F6 Work-specific branch | **not triggered** in Projection | mutex / Winterfell rewrite 已删 |
| F7 Soft-style dependency | **not triggered** | 身份走材料与 visualEmphasis |

R1 明确禁止用 tent→stone / map→letter 判 PARTIAL。这两类 **没有** 在 Projection 再现，因此本轮可以是 PARTIAL，不能是 FAIL。

---

## Observable pixels (Local unless noted)

| Frame | Observation |
| ----- | ----------- |
| tk-symbol-profile | 红脸 + 长须 + 绿衣可指关羽；青龙刀未入画；近半身像 |
| as-symbol-profile | 毛皮 + 冰晶巨剑 + 雪林，北境可读 |
| tk-sacred-place | 桃花 + 三人结义可读；刀非偃月；红脸弱 |
| as-sacred-place | 雪林双人；Catelyn 仍是毛皮而非南境裙（Projection 有 gown，成图丢掉） |
| tk-campaign-document | **地图还在**；毡帐不可读；两人北境草纤维披肩，关羽符号弱 |
| as-indoor-counsel | 烛光 + 文书 + 红发/胡须，密信可读 |
| tk-indoor-counsel | Cloud fallback：汉装/地图/木构更像三国，**排除同模型对照** |

---

## Remaining Failures

```text
Observed Failure: Guan Yu visual 含 "looking down at map"，该分句因含 map 得到高 salience，挤掉 green robe
→ Stage: Projection compression (identity slot scoring)
→ Category: Rule-Level (narrow)
→ Do not 三国-special-case. Score action-in-visual below costume.

Observed Failure: Local 常把标志武器裁出画面 / 室内三国披成北境纤维
→ Stage: Local Execution
→ Category: Renderer capability + composition not forcing weapon-in-frame
→ Not solved by style adjectives.

Observed Failure: 3-cast 帐中 Local 白图
→ Stage: Local Execution
→ Category: capability blank, not semantic substitution
```

---

## Decision

```text
EVG-001-R2 Result:

Status:
PARTIAL

Cross-Work Stability:
PARTIAL

Character Recognition:
PARTIAL

Work Identity:
PARTIAL

Narrative Comprehension:
PARTIAL

Location Semantic Preservation:
PASS

Prop Semantic Preservation:
PASS

Character Identity Preservation:
PARTIAL

Creator Work-Identity Representation:
PASS

Primary Evidence:
scripts/evg-001-cross-work-visual/results/r1/ 与 results/r2/
docs/spikes/evg-001-cross-work-visual-experience.md（R1）

R1 → R2 Changes:
见上表。核心是 Projection 不再发明地点/替换文书，Local 开始消费材料与 visualEmphasis。

Remaining Failures:
身份槽位被动作短语挤占；Local 丢刀/室内汉装；3-cast 白图。

Rule-Level Findings:
Semantic invariant 已成立。剩余规则级问题只剩 visual-part 打分（动作≠身份）。

Work-Specific Findings:
无新的反向三国污染。ASOIAF 密信/神木仍稳，不是因为 special case，而是 Canonical 本身就是北境。

Architecture Impact:
NONE

Next Authorization:
B
```

**B 的范围必须很窄：** 只校准 identity salience（动作短语不得优于服饰/具名武器）以及是否要用 composition 保证标志物在画面内。然后同轮两作重验。

**不是 HOLD：** 没有架构阻塞。  
**不是 A：** 还不能把当前 Creator 像素体验当成已固化成功。  
**不是 production implementation。**

---

## Production Impact

```text
NONE as rollout
```

Projection / Archive 规则已在 `lib/discovery/*` 修正以便本轮可执行验证。不构成 production grant、不改 ADR-011。

---

## Refs

- Parent: `docs/spikes/evg-001-cross-work-visual-experience.md`
- Governance: `governance/EVG-001.md`
- Experiment: `scripts/evg-001-cross-work-visual/`
