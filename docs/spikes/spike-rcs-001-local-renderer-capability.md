# SPIKE-RCS-001 — Local Renderer Capability Comparison

**Status:** COMPLETE  
**Parent:** EVG-001 HOLD  
**Type:** Renderer Capability Spike  
**Production:** NOT AUTHORIZED  
**EVG Re-validation:** NOT AUTHORIZED  
**Last Updated:** 2026-08-22  

---

## What

用 **同一份** EVG-001-R3 Local Renderer Expression / prompt，在 LocalAI 上对照三个模型的 **pixel realization**：

| Slot | LocalAI model id |
| ---- | ---------------- |
| M1 Baseline | `sd-3.5-medium-ggml` |
| M2 Candidate A | `Z-Image-Turbo` |
| M3 Candidate B | `flux.2-klein-4b` |

Cases：`tk-campaign-document`（关羽吸烟枪）+ `as-indoor-counsel`（ASOIAF 密信）。

未修改 Projection、identity slot ranking、Work rules、Renderer Expression，也没有按模型改 prompt。

## Why

EVG-001-R3 已证明身份槽位规则成立，但 Local SD3.5 把青龙偃月刀画成直剑。问题可能是 renderer capability，而不是再打一轮 prompt。

## How

```text
Frozen R3 Local prompt
        ↓
LocalAI only (fallback pinned, never Cloud)
        ↓
sd35 / z-image / flux2-klein
```

- Seed 42、512px、同一 negative（`buildFrameNegativePrompt` dual-cast）。
- SD3.5 像素复用 R3 原图（同一 prompt / 同一模型），不覆盖 `scripts/evg-001-cross-work-visual/results/r3/`。
- 白图或 runtime 失败记 `Generation Status = FAIL`，不用 Cloud 替代。
- Klein 失败后 **没有** 为出图重试。

```bash
npx tsx scripts/renderer-capability-spike/run.ts
```

Evidence: `scripts/renderer-capability-spike/results/{sd35,z-image,flux2-klein}/`

---

## Validation

Executed:

```bash
npx tsx scripts/renderer-capability-spike/run.ts
```

| Arm | Case | Generation |
| --- | --- | --- |
| sd-3.5-medium-ggml | both | OK（复用 R3 PNG） |
| Z-Image-Turbo | both | OK（LocalAI，~192s / ~232s） |
| flux.2-klein-4b | both | FAIL — LocalAI backend EOF / connection refused after model switch |

Klein `tk-campaign-document` failure reason:

```text
HTTP 500 rpc error: Unavailable: error reading from server: EOF
```

该失败是 evidence，不是漏测。像素层标 `NOT_OBSERVED`。

---

## Smoking-gun: Green Dragon Crescent Blade

同一 prompt：

```text
Guan Yu: Green Dragon Crescent Blade, red face, long beard, green robe
Composition: identity weapons in frame
```

| Model | Representation | Realization | Object correctness |
| ----- | -------------- | ----------- | ------------------ |
| SD3.5 Medium | PASS | FAIL | GENERIC（直剑 / 西式阔剑） |
| Z-Image-Turbo | PASS | PASS | CORRECT（绿色新月形大刀在画面中） |
| FLUX.2 Klein 4B | PASS | NOT_OBSERVED | 生成 FAIL |

---

## Case A — Three Kingdoms / Guanyu

| Capability | SD3.5 Medium | Z-Image-Turbo | FLUX.2 Klein 4B |
| ---------- | ------------ | ------------- | --------------- |
| Character Identity | PARTIAL | PASS | NOT_OBSERVED |
| Red Face | FAIL | PASS | NOT_OBSERVED |
| Long Beard | PARTIAL | PASS | NOT_OBSERVED |
| Green Robe | PARTIAL | PASS | NOT_OBSERVED |
| Green Dragon Crescent Blade | GENERIC | CORRECT | NOT_OBSERVED |
| Campaign Map | PASS | PASS | NOT_OBSERVED |
| Han Military Tent | PARTIAL | PASS | NOT_OBSERVED |
| Location Preservation | PASS（tent≠Winterfell） | PASS | NOT_OBSERVED |
| Prop Preservation | PASS（map≠letter） | PASS | NOT_OBSERVED |
| Work Identity | PARTIAL（西化甲胄） | PASS（汉袍/幞头/毡帐） | NOT_OBSERVED |
| Narrative Comprehension | PASS | PASS | NOT_OBSERVED |
| Multi-character Composition | PASS | PASS | NOT_OBSERVED |
| Identity Weapon in Frame | FAIL | PASS | NOT_OBSERVED |

C3 cultural grounding（三国对象）:

| Object | SD3.5 | Z-Image |
| ------ | ----- | ------- |
| Han military tent | genericize / westernize | preserve |
| campaign map | preserve | preserve |
| Green Dragon Crescent Blade | westernize → generic sword | preserve |
| costume | westernize → plate/scale armor | preserve → Han robe |

未出现 R1 类 `tent → stone chamber` 或 `map → letter`。

---

## Case B — ASOIAF indoor letter

同一 frozen prompt（Winterfell solar、sealed letter、auburn hair、fur cloak、Ice）。

| Capability | SD3.5 Medium | Z-Image-Turbo | FLUX.2 Klein 4B |
| ---------- | ------------ | ------------- | --------------- |
| Character Identity | PARTIAL（红发可读；裙被毛皮替代） | PARTIAL（红金长发+裙；非标准 Catelyn 像） | NOT_OBSERVED |
| Narrative Prop (sealed letter) | PARTIAL（展开羊皮纸，非封印信） | PARTIAL（信封+钥匙；桌上另有文书） | NOT_OBSERVED |
| Location | FAIL（雪林，不是 solar） | PASS（花岗石拱室 / 室内） | NOT_OBSERVED |
| Work Identity | PARTIAL（北境可读，但地点错） | PASS（石室+毛皮+蜡烛） | NOT_OBSERVED |
| Named weapon Ice | GENERIC / 几乎 ABSENT | GENERIC（靠墙十字剑，非手中 Ice） | NOT_OBSERVED |
| Action vs identity | 动作成立 | 动作成立，未毁掉身份 | NOT_OBSERVED |

Z-Image 在 ASOIAF **没有**把场景画成汉营；反向污染未观察到。

---

## Hypothesis

- **A Cultural advantage：** 吸烟枪上 Z-Image ≫ SD3.5（红脸、长须、绿袍、偃月刀、毡帐同时成立）。
- **B General capability：** ASOIAF 地点 realization 也明显优于 SD3.5（石室 vs 雪林）。更像整体 grounding 提升，外加对中国具名对象特别强。
- **C New family：** Klein 无像素，**不能**判断 Z-Image ≈ Klein。
- **D Named-object ceiling：** **不成立**。至少有一个 Local 模型把青龙偃月刀画成正确对象。

---

## Findings

### Finding A — Renderer replacement candidate

`Z-Image-Turbo` 在本 Spike 的核心 benchmark 上明显优于 SD3.5 Medium。  
这是 **renderer replacement candidate**，不是 production 决定。

### Finding B — Domain evidence (secondary)

中国文学具名对象的差距大于 ASOIAF 具名武器（Ice 两边都 GENERIC）。与 cultural/domain grounding 相容，但不能单独归因“中国模型”，因为缺少 Klein 像素对照。

### Finding C — not selected

并非所有模型都无法实现 named prop。

### Finding D — not selected

Z-Image 有实质改善。

### Klein runtime

LocalAI 在 Z-Image 之后切到 `flux.2-klein-4b` 出现 backend EOF。这是 **host/runtime 稳定性** 问题，不是“Klein 把刀画错”的像素结论。

---

## Goal / Decision

本 Spike **不产生 EVG PASS**，不重开 EVG-001 Architecture。

```text
SPIKE-RCS-001 Result:

Status:
COMPLETE

Models:
- SD3.5 Medium
- Z-Image-Turbo
- FLUX.2 Klein 4B

Cases:
- Three Kingdoms / Guanyu
- ASOIAF

Character Identity:
SD3.5 PARTIAL · Z-Image PASS (TK) / PARTIAL (ASOIAF) · Klein NOT_OBSERVED

Named Prop Realization:
SD3.5 GENERIC straight sword · Z-Image CORRECT crescent blade · Klein generation FAIL

Location Realization:
SD3.5 TK tent PARTIAL/western · ASOIAF solar FAIL (snow forest)
Z-Image TK tent PASS · ASOIAF solar PASS
Klein NOT_OBSERVED

Work Identity:
SD3.5 TK westernized · Z-Image TK Han-readable, ASOIAF northern stone
No reverse 三国←ASOIAF leakage on Z-Image

Narrative Comprehension:
Both successful models keep map vs letter semantics. PASS where generated.

Cross-Work Capability:
Z-Image realizes both works as different visual worlds on the same prompt pair.

Primary Smoking-Gun:
Green Dragon Crescent Blade

SD3.5:
GENERIC_SIMILAR_OBJECT (straight western sword). Red face FAIL.

Z-Image:
CORRECT_NAMED_OBJECT in frame. Red face + long beard + green robe PASS.

FLUX.2 Klein:
Generation FAIL (LocalAI EOF). No Cloud substitute.

Cultural Grounding Finding:
Consistent with domain advantage on Chinese named objects; ASOIAF location also improved (not TK-only).

General Capability Finding:
Z-Image > SD3.5 on both works. Klein pixels unavailable.

Named-Object Capability:
Not a universal T2I ceiling for this object — Z-Image realized it.

Renderer Recommendation:
Z-Image-Turbo is a Local renderer replacement CANDIDATE only.
Not production. Not EVG PASS. Klein requires a cold LocalAI session before pixel comparison.

EVG-001 Impact:
HOLD unchanged. Do not reopen Architecture because a model drew the blade.

Architecture Impact:
NONE

Next Authorization:
B
```

**B** = Renderer Strategy Decision（是否把 Z-Image-Turbo 列为 Creator Local 候选）。  
**不是** EVG 重开，**不是** production，**不是**再改 Projection。

## Risks

- Klein 未出像素；不能排除“新模型家族普遍强于 SD3.5”。
- 单 seed protocol，不做 cherry-pick；Z-Image 这一次成功不等于永远稳定。
- Ice 仍 GENERIC：具名西式武器不是本轮吸烟枪。
- LocalAI 多模型热切换会打崩 backend。

## Refs

- Parent: `docs/spikes/evg-001-r3-identity-slot-calibration.md`
- Frozen inputs: `scripts/renderer-capability-spike/frozen-inputs.json`
- Governance: `governance/templates/SPIKE_TEMPLATE.md`
- EVG-001: HOLD
