# Scene Frame 图文对齐 — 架构师简报（证据 + 待决）

**Status:** CLOSED — Architect ACCEPT (2026-08-28)  
**Follow-up:** `config/infra/scene-frame-alignment-v1-policy.md` · `docs/decisions/scene-frame-alignment-v1-revalidation-001.md`  
**Type:** Evidence brief · Deployment / Product policy question（非 Implementation PR）  
**Date:** 2026-08-28  
**Branch / 实现:** `feat/scene-frame-alignment`（commit `f2e1f77a` 及后续 Local 重试证据）  
**Authority:** ADR-010（A3/A4）· ADR-011（A3–A5）· `config/infra/deployment-defaults.md`  
**North Star:** `.cursor/plans/scene_frame_alignment_3d759233.plan.md` — Reader caption 与 Creator frame 须传达**同一 single beat**

---

## 1. 我们在问什么（不是「放弃对齐」）

**问题：** 在 Creator **Deployment Default = Local**（Z-Image-Turbo · 512² · 零 Cloud API 费）下，Scene Frame「图文一致」应如何定义**可验收边界**？难 beat 走哪条合法路径（Deployment 分层 · Expression 策略 · 产品让步）？

**不是问：** 是否推翻 Caption + Expression + Human Accept + Image Port 架构（本轮实现与 ADR-011 一致）。

---

## 2. 本轮已落地的结构对齐（管线已通）

| 能力 | 状态 |
| ---- | ---- |
| Propose 同次产出 `rendererExpression`（非 stub） | ✅ |
| Human 拆 Scene + LLM 补全每 beat Expression | ✅ |
| Discovery / FrameContextDrawer / CPP 可编辑 Expression | ✅ |
| 生成任务可「查看输入」；重试前保存 Expression + 结构化 `operator_revision` | ✅（含 requeue 自动 patch provenance） |
| Prompt 侧去掉重复 OPERATOR OVERRIDE | ✅ |

**结论：** Expression **能**进入 `input_json` / Local prompt；帧 3 反复失败**不是**「Discovery 没写对」或「Admin 没传对」的单一 bug。

---

## 3. 验收样本（三国演义 · 桃园弧 · `scene_1787821760006`）

**Work:** `42c22be9-ac88-4407-90cf-19cf79847d07`  
**Local:** `npx tsx scripts/local-generate-worker.ts` · Z-Image-Turbo · 512×512

| Frame | Caption beat（摘要） | Local 对齐感 | 备注 |
| ----- | ------------------- | ------------ | ---- |
| 0 | 吏治腐败 → 黄巾 → 刘焉募兵 | 部分 | 黄巾色、榜文有；caption 仍多 beat；榜文文字错 |
| 1 | 大兴山战、关张斩将 | 弱 | 战场气氛有；兵器/人物错配；无「斩将」瞬间 |
| 2 | 桃园结义 | **较好** | 三人桃园；关羽兵器略偏 |
| 3 | 董卓轻慢 → 张飞拔剑 → 刘备制止 | **反复失败** | 见 §4 |
| 4 | 商人捐铁、打造兵器 | 部分 | 桌上兵器有；缺锻造/商人 |

**粗结论：** 静态站位、环境+道具、少社会关系动作的 beat，Local 可部分对齐；**多角色社会关系 + 制止/拔剑/对峙** 在当前 Local 上稳定跑偏。

---

## 4. 帧 3 专项证据（N 次重试后的能力天花板）

**目标 beat：** 帐内董卓端坐轻慢；张飞欲拔剑；刘备挡在中间制止；**禁止**握手/结盟构图。

**观测（修复 prompt 管线之后）：**

1. 多次出现 **双人握手 / 结盟**（模型强先验），与 Expression 中 `FORBIDDEN` 矛盾。  
2. 强调 hand / wrist / 拔剑 / 制止 → 握手、畸形手，或 **白底三人立绘拼贴**（叙事场景坍缩为 character sheet）。  
3. 改为「身体挡位、矛尖对准董卓、不写手部词汇」后，仍出现握手、或丢失董卓/帐内/看戏式围观构图。  
4. 最新 job（`d12123b1…`）：白底角色 lineup，无帐、无董卓叙事位 — **最差坍缩**。

**与既有 Spike / ADR 的呼应：**

- ADR-011：`renderer-boundary-validation-spike` — Local 强环境/动作，弱抽象/精确多角色几何。  
- ADR-011：`capability-adaptation-v2-spike` — 静态可见几何可改善；复杂物理/社会关系 cues 恶化 blank/跑偏率。  
- ADR-011 表：Frame-level Cloud fallback → 单帧 fidelity 升、**跨帧视觉一致性风险**；Local-shaped Expression 喂 Cloud → **叙事对齐上限**。  
- `docs/decisions/z-image-blocker-check-001.md`：Z-Image-Turbo 定性未达标（道具稳定性等）— 与 Scene Frame 观测一致，但 **Deployment 仍标为 Creator Default**（`deployment-defaults.md` · RSD-002）。

---

## 5. 我们当前的判断（供架构师反驳或确认）

1. **图文一致在架构上可行** — Caption/Expression 分工 + Human Accept 是正确的 North Star。  
2. **「零 Cloud 费」≠「每一帧都自动像素级对齐」** — 难 beat 需要 Deployment 或产品策略，不能仅靠 Operator 无限改 prompt。  
3. **帧 3 类 beat 不应继续 Local 同模板重试** — 已证明是 renderer prior，不是再写一版 OVERRIDE 能稳过。  
4. **Expression 不应为 Local 削成「握手安全版」** — ADR-011 A5：Canonical Expression 是 provider-independent；能力约束应在 **Execution Projection / Deployment**，而非 Discovery 写假 beat。

---

## 6. 请架构师裁决或指引的方向（五选一或组合）

### A. Beat 分级 Policy（推荐优先讨论）

正式区分 **Local-safe** vs **Local-hard** beat 类型（例：环境陈列 / 结义站姿 vs 多角色制止/拔剑/羞辱对峙），并绑定默认验收标准。

### B. Deployment 分层（不改 Port · ADR-010 A3 F 已预留）

- 默认 Local；**按帧或按 beat 类型** opt-in `creator_accept_fallback`（SiliconFlow 等）。  
- 与 ADR-011「拒绝 frame-level Cloud-by-default」如何共存？是否改为 **typed fallback**（仅 Local-hard）而非 operator 手动开关？

### C. 对齐验收标准（Product）

- **A 级：** 图独立讲清 caption 全转折（帧 3 级）— Local 可能不达标。  
- **B 级：** 图承担身份/道具/气氛，细转折由 caption 兜底（桃园级可 Accept）。  
- 桃园弧 V1 公开 showcase 接受哪一级？

### D. Expression / 拆 beat 产品策略

难关系戏默认：**更少人 · 更静 · 更 icon**（例：只画董卓轻慢侧写），把「拔剑制止」留给 caption；是否与「一 beat 一图」冲突？若冲突，是否允许 **caption 单 beat 但图只覆盖 beat 的可视子集**（需权威定义）。

### E. 新 Spike 授权

「Local 多角色社会动作」是否值得单独 Spike（换模型/分辨率/参考图），还是 Policy 直接标为 Cloud-only beat？

**明确不请求（除非架构师另授）：** Reader 热路径出图 · 自动 Accept · Discovery 第二套 LLM Planner · 持久化 `executionProjection` 双写。

---

## 7. 实现方短期建议（待架构师批复前）

| 动作 | 说明 |
| ---- | ---- |
| 暂停帧 3 Local 同构图重试 | 避免假阴性消耗运营信心 |
| 帧 2 等 Local-safe 帧可 Accept | 验证「结构对齐 + 部分像素对齐」路径 |
| 帧 0/1/4 | 拆 caption / 收紧 Expression / 选择性重试（非帧 3 模板） |
| 不在 Discovery 为 Local 写 stub Expression | 保持 Canonical Expression 诚实 |

---

## 8. 引用

- ADR-010 A3 Constraint F · A4 Scene Frame draft  
- ADR-011 A3–A5 · `rich-expression-projection-spike`  
- `config/infra/deployment-defaults.md` §1a（`creator_accept_fallback` 默认 unset）  
- Implementation: `lib/prompts/frame-draft.ts` · `BatchFrameCompletion.tsx` · `lib/discovery/split-scene-expressions.ts`

---

**联系人 / 证据：** Admin CPP 本地批跑 + `generate_jobs.input_json` 可追溯；需要时可导出帧 3 全 job 列表与 Cloudinary URL。
