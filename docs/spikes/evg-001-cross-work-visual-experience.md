# EVG — Cross-Work Visual Experience (First Round)

## Metadata

| Field          | Value                                      |
| -------------- | ------------------------------------------ |
| Identifier     | EVG-XWV-001 (Grant: EVG-001 first round)   |
| Status         | FAIL                                       |
| Version        | v1                                         |
| Owner          | Architect                                  |
| Last Updated   | 2026-08-22                                 |
| Classification | EXPERIENCE-FACING                          |

Allowed Status values: `Draft` · `PASS` · `FAIL` · `INCONCLUSIVE`

---

## Decision Brief

```text
Problem:
同一套视觉体验规则，换作品后是否仍能支撑角色识别与作品身份。

Decision:
EVG-001 first round = FAIL（跨作品稳定性）。户外符号识别部分成立，但 Local Execution Projection 对 ASOIAF 形成隐式绑定；三国帐中被改写为 Winterfell；两个作品被压成同一套 cinematic grit。

Evidence:
同轮 6 张对照图（seed 42，无挑图）+ 投影日志。三国帐中 environment → "Winterfell stone chamber"；styleHints 8/8 被 Local 丢弃；关羽 visual 中 red face 被 salience 裁掉，成图再丢掉青龙偃月刀。

Risk:
若在修正规则前固化当前 Projection，第二个作品会继续被第一个作品的视觉套路吞掉。

Decision Required:
授权规则修正后的 EVG 重验（Next Authorization = B）。本轮不授权 production-wide 实现。
```

---

## Problem

当前视觉体验规则是否只在单一作品（主要是 ASOIAF 校准路径）上成立，换到另一套角色符号与视觉语义后是否崩溃。

---

## Current Experience

Creator 路径：

```text
Character Archive
    → fold into Visual Expression
    → Local Execution Projection
    → Image Port (sd-3.5-medium-ggml)
    → Candidate
```

读者看到的是投影后的单帧，而不是 Canonical Expression。

Face Safety 默认非正脸。角色识别被假设可以由服饰 / 武器 / 须发等主识别特征承担。

---

## Desired Experience

同一套体验规则下：

* 三国角色仍像三国，ASOIAF 角色仍像 ASOIAF；
* 角色不依赖正脸即可识别；
* 主识别特征能承担身份；
* 单帧仍能传达关系 / 行动 / 环境；
* 换作品后不必重写一套规则。

---

## Success Criteria

| Criterion | Required Result | Result |
| --------- | --------------- | ------ |
| EVG-S1 Character Recognition | 两作均能靠主识别特征识别，不依赖正脸 | PARTIAL |
| EVG-S2 Work Visual Identity | 隐藏作品名后仍能区分两个世界 | PARTIAL |
| EVG-S3 Identity survives style | 风格变化不抹平角色身份与作品身份 | FAIL |
| EVG-S4 Scene-level recognition | 单帧传达人物 + 符号 + 关系 + 行动 + 环境 | PARTIAL |
| EVG-S5 Cross-work transfer | 规则不绑定单一作品；换作后仍成立 | FAIL |

---

## Experiment

Disposable runner: `scripts/evg-001-cross-work-visual/`.

同一轮、同一套生产规则、同一 Local 模型、同一 seed（42）：

| Pair | 三国 | ASOIAF |
| ---- | ---- | ------ |
| 强符号 / 非正脸 | 关羽侧身 | Ned 侧身拭剑 |
| 圣所 / 结义 | 桃园结义 | 神木林密谈 |
| 室内张力 | 帐中劝阻 | 密信 |
| 投影对照（未出图） | 军帐地图 | 墙外对峙 |

未对任一作品做风格调参。未人工挑图。

---

## Observable Result

### Projection (rule-level, before pixels)

1. **ASOIAF landmark 注入三国。**  
   Canonical: `Han military tent, campaign table, hanging maps`  
   Local projected environment: `Winterfell stone chamber, wooden table`  
   Local prompt 同时含 `Setting: Han command tent` 与 `Environment: Winterfell stone chamber`。

2. **作品 styleHints 在 Local 路径被全部丢弃。**  
   8/8 frames authored styleHints；0/8 进入 Local prompt。  
   三国（Han mineral-pigment）与 ASOIAF（desaturated northern chronicle）在 Creator Default 上被压成同一套模型默认画风。

3. **主识别特征被 2-slot western salience 裁掉。**  
   关羽 Canonical visual: `Green Dragon Crescent Blade, red face, long beard, green robe`  
   Local visual: `green robe, Green Dragon Crescent Blade`  
   `red face` 消失。Archive 预算 costume≤1 + prop≤1 从不选择红脸 / 长须。

4. **ASOIAF 文书套路改写三国军情。**  
   Canonical action 含 `campaign map`  
   Local action: `sealed parchment letter on table, Liu left, Guan right, both looking down`

5. **ASOIAF 侧规则在本作品内有效。**  
   Godswood environment 被收成 exclusive weirwood landmark；Ned visual 保留 `greatsword Ice, northern fur cloak`。同一套代码对 ASOIAF 是校准，对三国是污染。

### Rendered frames (seed 42, localai / sd-3.5-medium-ggml)

| Frame | Reader observation |
| ----- | ------------------ |
| tk-symbol-profile | 绿袍 + 腰际长须可指向关羽；青龙偃月刀未入画；近于半身肖像而非武器可读的中全景；肤色非戏文红脸 |
| as-symbol-profile | 毛皮 + 长剑 + 雪可指向北境；神木 / 水潭 / 坐姿拭 Ice 未成立 |
| tk-sacred-place | 桃花 + 三人 + 香火可指向桃园结义；三人外貌趋同；关羽无长须；三件标志兵器不可分 |
| as-sacred-place | 雪林 + 毛皮 + 长剑像北境；无 weirwood 脸；Catelyn 未着南境裙装，与 Ned 同质毛皮 |
| tk-indoor-counsel | 汉装痕迹还在（锥帽 / 须），但是石室围桌议事，不是帐中劝阻；Winterfell 环境改写进入画面 |
| as-indoor-counsel | 烛光 + 文书 + 毛皮石室可读“密谈”；Catelyn 被画成披毛皮的幼女，costume mutex 失败 |

隐藏作品名后：户外两对仍能区分（桃花 / 绿袍 vs 雪 / 毛皮）。室内两对落入同一套 grimdark 石室围桌，作品身份弱。

---

## Evidence

* Runner + fixtures: `scripts/evg-001-cross-work-visual/`
* Projection + prompts: `scripts/evg-001-cross-work-visual/results/summary.json`
* Frames: `scripts/evg-001-cross-work-visual/results/{tk,as}-*.png`
* Binding source (not changed this round):
  * `lib/discovery/expression-capability-rules.ts` (`sharpenExpressionAnchors`, Ned/Catelyn mutex, `map`→`letter`)
  * `lib/discovery/execution-projection.ts` (Local 丢弃 `styleHints`)
  * `lib/discovery/character-archive.ts` (cue budget + ASOIAF fold copy)

---

## What Was NOT Proven

* Cloud / 高能力 Renderer 是否能在不改规则的情况下保住作品身份（Local 是 Creator Default，本轮测的是默认体验）。
* Discovery LLM 现场 propose 三国 Archive 的质量（本轮用同一 Archive schema 的夹具，避免把模型幻觉算进规则）。
* 读者侧正式阅读 UI 排版。
* 架构层（Canon / Scene Context / Renderer 边界）——未重开。

---

## Observed Failures

```text
Observed Failure: 三国帐中 environment 被改写为 Winterfell stone chamber
→ Failure Category: Work-identity contamination / story-meaning invention
→ Rule-Level or Work-Specific: Rule-Level (Execution Projection)
→ Proposed Change: Projection MUST NOT inject franchise landmarks. Landmark exclusivity belongs to the work's authored environment, not a Winterfell/weirwood rewrite.

Observed Failure: Local prompt 丢弃全部 styleHints；两作成图同为 cinematic grit
→ Failure Category: Work visual identity stripped at Creator Default
→ Rule-Level: Rule-Level
→ Proposed Change: Work visual identity needs a projection-surviving carrier (or Local must pass styleHints / work palette). Do not retune one work's style.

Observed Failure: 关羽 red face / 长须被 2-slot salience 丢掉；成图再丢掉青龙刀
→ Failure Category: Symbolic identity budget too narrow + western prop dictionary
→ Rule-Level: Rule-Level
→ Proposed Change: Body features (beard, face color, hair) are first-class identity, not leftover after Ice/letter/cloak. Prop salience MUST NOT be Ice/letter/raven-specific.

Observed Failure: campaign map → sealed parchment letter
→ Failure Category: Scene-type rewrite bound to ASOIAF letter beats
→ Rule-Level: Rule-Level
→ Proposed Change: Remove map→letter. Document type is authored meaning.

Observed Failure: 帐中劝阻画成围桌议事；神木林无 weirwood；桃园三人不可分
→ Failure Category: Narrative comprehension drop on multi-figure beats
→ Rule-Level: Rule-Level (geometry + identity cues), not a 三国-only style knob
→ Proposed Change: Re-validate after identity/projection fix; do not 三国-special-case prompts.
```

---

## Decision

```text
EVG-001 Result:

Status:
FAIL

Cross-Work Stability:
FAIL

Character Recognition:
PARTIAL

Work Identity:
PARTIAL

Narrative Comprehension:
PARTIAL

Primary Evidence:
同轮 6 帧 + summary.json。户外可分；室内同质化；三国帐中被写入 Winterfell。

Observed Failures:
见上。核心失败是规则隐式绑定 ASOIAF，而不是“三国生成得不好所以要调参”。

Rule-Level Findings:
Execution Projection 发明地点；styleHints 在 Local 被丢弃；身份预算 / 道具词典西化；map→letter；few-shot 与 mutex 写死 Ned/Catelyn。

Work-Specific Findings:
ASOIAF 神木 / Ice / 密信路径与当前规则同构，所以看起来更稳。这不是跨作品成功，而是校准作品偏置。

Next Authorization:
B
```

**A** = 体验规则可进入下一阶段验证/固化  
**B** = 需要修正规则后重新验证  
**HOLD** = 发现架构级阻塞

B 而非 HOLD：ADR-011 已禁止 Projection 发明故事意义。本轮暴露的是该边界被 ASOIAF 校准残留违反，不是要重开 Architecture / Canon / Renderer 边界。

---

## Production Impact

```text
NONE
```

本 Grant 只授权第一轮 Experience Validation。Implementation / production-wide changes 不因本结果自动获准。规则修正需要单独授权后再做 EVG 重验。

---

## Refs

- Governance: `governance/EVG-001.md`
- Related: ADR-011 · SPEC-DVE-001 · SPEC-CHAR-001
- Experiment: `scripts/evg-001-cross-work-visual/`
