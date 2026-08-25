# RSD-001 — Creator Local Renderer Strategy

**Status:** ACCEPTED (Candidate entry; Default selection → RSD-002)  
**Type:** Renderer Strategy Decision  
**Parent:** SPIKE-RCS-001  
**Last Updated:** 2026-08-24  
**Owner:** Architect  
**Production:** NOT AUTHORIZED  
**EVG-001:** HOLD  
**Architecture:** NONE / FROZEN  

---

## Decision

```text
Should Z-Image-Turbo enter the Creator Local Renderer candidate set?

Decision:
ACCEPT

Rationale:
SPIKE-RCS-001 用同一份 EVG-001-R3 frozen prompt 证明：
Z-Image-Turbo 在 Character Identity、Named Prop、Location、Work Identity、
Cross-Work Separation 上明显优于当前 Local baseline SD3.5 Medium。
具名对象 Green Dragon Crescent Blade：
  SD3.5 → GENERIC 西式直剑
  Z-Image → CORRECT 青龙偃月刀
该差距由 renderer 能力决定，不能再归因于 Projection / Identity Slot / prompt omission。
未发现拒绝纳入候选的 blocker（license/runtime/deployment 本轮未构成否决）。
单 seed、两帧、Klein 无像素：不足以升为 Local Default 或 production。

Evidence:
docs/spikes/spike-rcs-001-local-renderer-capability.md
scripts/renderer-capability-spike/results/{sd35,z-image}/
scripts/renderer-capability-spike/frozen-inputs.json

Production Status:
NOT AUTHORIZED

Candidate
≠ Default
≠ Production
```

---

## Options evaluated

| Option | Meaning | Result |
| ------ | ------- | ------ |
| A Reject | 不纳入 candidate set | **Not selected.** 无不稳定否决、无不可接受 runtime 否决、无 license/deployment blocker 记录。 |
| B Candidate | `ACCEPT AS CREATOR LOCAL CANDIDATE` | **Selected.** 与当前 capability evidence 直接对齐。 |
| C Local Default Candidate | preferred local renderer candidate | **Not selected.** 缺少后续 runtime verification 与工程约束包；本轮禁止写成 production default。 |

---

## Input Evidence

```text
Input Evidence:
SPIKE-RCS-001

Current Baseline:
SD3.5 Medium (`sd-3.5-medium-ggml`)

Candidate:
Z-Image-Turbo (`Z-Image-Turbo` on LocalAI)

Capability Finding:
Z-Image > SD3.5 on observed cases

Named Object:
Green Dragon Crescent Blade
SD3.5 → generic sword
Z-Image → correct guandao

Cross-Work:
Z-Image preserves distinction between
Three Kingdoms and ASOIAF

Cultural Grounding:
Possible evidence
Not proven as sole cause
```

Klein (`flux.2-klein-4b`) = **NOT_OBSERVED**（LocalAI EOF，无像素）。  
Klein 不参与本轮正负能力结论，**不阻塞** Z-Image 的 candidate 决定。

---

## Capability delta (observed)

| Dimension | SD3.5 Medium | Z-Image-Turbo |
| --------- | ------------ | ------------- |
| Character Identity (三国 / Guanyu) | PARTIAL | PASS |
| Green Dragon Crescent Blade | GENERIC | CORRECT |
| Han military tent | PARTIAL | PASS |
| Campaign map | PASS | PASS |
| ASOIAF location (solar) | FAIL（雪林） | PASS（石室） |
| Work separation | PARTIAL | PASS |
| Map ≠ letter / tent ≠ Winterfell | PASS | PASS |

协议：同一 frozen Renderer Expression、同一 Local prompt、seed 42、512px、Local-only。

---

## Cultural grounding

记录为：

```text
Evidence supports possible cultural/domain grounding advantage.
```

不得升级为：

```text
Chinese model = inherently better for Chinese literature
```

Z-Image 同时改善了 ASOIAF location 与 work separation，因此更稳妥的结论是：

> Z-Image 具有更强的文化/领域对象 grounding **或**整体 renderer capability；现有证据不足以将优势单独归因于“中国模型”。

---

## What this decision does not do

未修改、也不得据此修改：

```text
IMAGE_CREATOR_ACCEPT_PROVIDER
IMAGE_CREATOR_ACCEPT_MODEL          (production binding)
sd-3.5-medium-ggml                   (not removed)
Renderer Expression
Projection
Identity slot ranking
Discovery
Character Archive
Scene Context
EVG-001 status
ADR-010 / Architecture
```

当前 Creator Local production binding 仍是 operator env 中的 `sd-3.5-medium-ggml`（或既有 Local 配置）。本决策只把它标为 **baseline**，把 `Z-Image-Turbo` 标为 **candidate**。

---

## Gate separation

```text
EVG Rule Layer
       │
       │ identity / semantic rules stable (R3 PARTIAL on pixels under SD3.5)
       ▼
Renderer Capability
       │
       ├── SD3.5  PARTIAL   (baseline, still installed)
       └── Z-Image PASS     (Creator Local Renderer Candidate)
```

EVG 验证的是跨作品视觉体验**规则**是否成立。  
RCS 验证的是 renderer 是否**有能力**实现这些规则。

`Z-Image successfully renders Guandao` ≠ `EVG PASS`。

```text
EVG-001 = HOLD
```

---

## Production boundary

```text
Creator Local Renderer Candidate
≠ Creator Deployment Default
≠ Production Authorization
```

RSD-001 只把 `Z-Image-Turbo` 纳入 **Candidate**。Creator Local **Default** 由 **RSD-002** 决定（`docs/decisions/rsd-002-z-image-default.md`）。QUAL-001 / BLOCKER-001 的可靠性门槛仍 **未过**；RSD-002 不把那些 findings 改写成 PASS。Creator Local Default Switch 已执行：`IMAGE_CREATOR_ACCEPT_MODEL=Z-Image-Turbo`；回滚 `sd-3.5-medium-ggml`。

---

## Klein follow-up (not in this decision)

若以后比较 Klein，必须单独执行 `RCS-KLEIN-COLDSTART`：

- 冷启动 LocalAI
- `scripts/renderer-capability-spike/frozen-inputs.json`
- 同一 frozen prompt
- Local-only，禁止 Cloud fallback
- 不修改 Projection / Expression / prompt

---

## Next Authorization

```text
Next:
none under RSD-001
See RSD-002 IMPLEMENT (done)

EVG-001:
HOLD

Architecture:
NONE
```

---

## Refs

- SPIKE-RCS-001: `docs/spikes/spike-rcs-001-local-renderer-capability.md`
- Frozen inputs: `scripts/renderer-capability-spike/frozen-inputs.json`
- EVG-001-R3: `docs/spikes/evg-001-r3-identity-slot-calibration.md`
- ADR-010: Local vs Cloud remains Deployment, not Architecture freeze
- Deployment defaults: `config/infra/deployment-defaults.md` (unchanged by this decision)
- QUAL-001: `docs/findings/creator-renderer-qualification.md`
- BLOCKER-001 close-out: `docs/decisions/z-image-blocker-check-001.md`
- RSD-002: `docs/decisions/rsd-002-z-image-default.md`
