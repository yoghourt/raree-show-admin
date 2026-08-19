# IMPLEMENT-RIE-002 Result Review

**Date:** 2026-08-19  
**Parent:** SPIKE-RIE-003 PASS  
**Prerequisites:** GRANULARITY-GATE-001 Closed · IMPLEMENT-RIE-001 PASS

---

## IMPLEMENT-RIE-002 Result Review

### Status

**PARTIAL**

D 接线（Canon → Story Bind → `claimedRequiredUnits` → 现有 IE → Accept）已进入生产 Accept choke point，并且 **fail closed**。

**BLOCKER:**

```text
Production Work Canon authority unavailable.
```

产品中不存在可维护的 Work Canon / Story Bind 权威源。本次 **没有** 把 `RIE_001` spike catalog 或 Propose 输出装进 `page.tsx`。线上 Discovery 故事确认因此保持 `INFORMATION_EQUIVALENCE_CONTEXT_REQUIRED`。

Architect Gate 在 **有 caller 提供的 Canon + Bind** 时成立（测试 / runtime evidence）。在 **真实 Discovery 页** 上尚未成立，因为权威数据源不存在。

---

### Production Authority

固定分层：

```text
Source
  → Work Canon          (caller-supplied; not invented here)
  → Story Bind          (per Story; no 1×N default inherit)
  → claimedRequiredUnits[]   (this Story only)
  → existing IE Validator
  → Review / Accept
```

禁止项已守住：

- Propose claims 不是 Accept 字段（hook 已删除 `claimedRequiredUnits`）
- `Story.summary` 不是 authority
- 未从 caption 反推 REQUIRED
- 未 LLM 生成 Canon
- 未把整表 Canon 套到每个 Story
- 未做 Route-level caption 拼接

---

### Work Canon

生产 contract：`lib/discovery/required-unit-authority/`

```text
WorkCanon.units[]  { unitId, necessity, claim? }
```

REQUIRED 才进入 IE。OPTIONAL/DISCARDABLE 不能被 Bind。

**不是** 生产 Canon 实例。`RIE_001_CLAIMED_REQUIRED_UNITS` 仅作测试 / claim 短语合同。`app/works/[workId]/discovery/page.tsx` 不加载它。

---

### Story Bind

```text
StoryBind { storyCandidateId, unitIds[] }
```

规则（无 1×N 默选）：

- 每个 REQUIRED 必须恰好属于一个活跃 Story
- 空 bind / 未绑定 / 重复归属 / 绑定未知或 OPTIONAL → `AUTHORITY_BIND_INCOMPLETE`
- 无 Canon → `INFORMATION_EQUIVALENCE_CONTEXT_REQUIRED`

UI **没有** Story Bind 控件。这是产品缺口，不是偷偷用 Propose 填上的。

---

### claimedRequiredUnits

由 `resolveStoryClaimedUnits(canon, binds, thisStoryId, batchStoryIds)` 生成，只含 **本 Story** 的 REQUIRED claim contract，再交给未改动的 `evaluateInformationEquivalence`。

---

### Accept Choke Point

```text
Review
  → useDiscoverySession.acceptCandidate
  → prepareAcceptStoryWithChildScenes / prepareAcceptReview
  → Granularity Gate
  → resolveStoryClaimedUnits (Canon + Bind)
  → existing IE Validator
  → markReviewAccepted
```

没有第二套 Accept path。Character / Location 不进入该链。

---

### Failure Codes

| 条件 | 错误码 |
| --- | --- |
| Granularity FAIL | `GRANULARITY_GATE_BLOCKED` |
| 无 Canon | `INFORMATION_EQUIVALENCE_CONTEXT_REQUIRED` |
| Canon/Bind 不完整 | `AUTHORITY_BIND_INCOMPLETE` |
| Bind 完整但 caption 丢失 REQUIRED | `INFORMATION_EQUIVALENCE_BLOCKED` |

缺权威 **不会** skip IE 后放行 Accept。

Review UI：Authority COMPLETE / INCOMPLETE；IE PASS / FAIL；失败 unit + reason + frames。

---

### Runtime Evidence

Caller-supplied Canon+Bind（测试与 `scripts/information-equivalence/runtime-evidence.ts`）证明：

| Candidate | Granularity | Authority | IE | Accept |
| --- | --- | --- | --- | --- |
| B_KEEP | PASS | complete | PASS | allowed |
| B_LOSS | PASS | complete | FAIL `U-ATTEMPT-PREVENTED` | blocked |
| Missing Bind | PASS | incomplete | not run | `AUTHORITY_BIND_INCOMPLETE` |
| Missing Canon | PASS | absent | not run | `CONTEXT_REQUIRED` |
| Cross-Story mix | PASS | partitioned bind | A PASS / B FAIL | A allowed, B blocked |

Story A 的 unit 不会因为出现在 Story B caption 而被满足（candidate-level frames + per-Story claims）。

线上 page **未** 传入 authority，操作员无法完成故事确认——这是 BLOCKER 的可见后果，不是 IE 误杀。

---

### Tests

```bash
npx vitest run __tests__/discovery/required-unit-authority.test.ts
npx vitest run __tests__/discovery/information-equivalence-accept.test.ts
npx vitest run __tests__/discovery/granularity-gate-accept.test.ts
npx vitest run __tests__/discovery/review-state.test.ts
```

覆盖授权 1–12：完整 bind → PASS；B_LOSS → FAIL；缺 bind → 阻断；跨 Story 不满足；compound 保留；entity overlap FAIL；OPTIONAL 省略 PASS；summary 不能补偿；Propose 单独不能立权；Character/Location 不受影响；无 ungated Story/Frame Accept。

`npx vitest run`：Discovery / RIE 相关全部通过。套件中 `suggest-service` / `rollout-routes` 失败与本次接线无关（LLM mock / persist 500）。

---

### Regression

- IE Validator（PRESENT/PARTIAL/LOST、compound、entity-overlap）未改算法
- G1–G4 未改
- Propose 仍不写 Accept claims
- Character / Location Accept 仍跳过 Gate+IE+Authority

---

### Bypass Audit

| 表面 | 结果 |
| --- | --- |
| hook `claimedRequiredUnits` | **已删除** |
| page 传入 Canon | **否** |
| Work-id 选 catalog | **否** |
| 1×N 默选全部 REQUIRED | **否** |
| `markReviewAccepted` | 仅在 `prepareAccept*` 成功之后 |

---

### Known Limitations

1. 生产没有 Work Canon 维护面 → 故事 Accept fail closed。
2. 没有 Story Bind UI。
3. IE 短语匹配仍是 fixture annotation（IMPLEMENT-RIE-001）。
4. `workCanonFromRequiredClaims` 是结构适配器；误用它包装 Propose 输出仍是调用方错误。生产路径未调用它。

---

### Unresolved Product Decisions

1. **谁维护生产 Work Canon** — 未猜。BLOCKER。
2. **`1×N` 是否默认继承全部 REQUIRED 再人工确认** — 未实现默认行为。
3. Canon 编辑器 / 多作品复用 / 自动抽取 — 明确不在本次范围。

---

### Architecture Drift

**NO**

IE 仍是 caption vs claimed REQUIRED。权威在 IE 之外。Granularity 与 IE 仍分离。

---

### Next Authorization

1. 指定生产 Work Canon 的编辑权威与存储位置（不要让实现层猜）。
2. Review 上的 Story Bind 确认（清单，不是新编辑器），再决定是否 1×N 默选。
3. 在权威数据接通之前，不要把 `CONTEXT_REQUIRED` 改成静默放行。
