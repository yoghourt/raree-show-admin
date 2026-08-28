# Scene Frame Alignment V1 — Re-validation (Frames 0–4)

**Status:** COMPLETE  
**Date:** 2026-08-28  
**Policy:** `config/infra/scene-frame-alignment-v1-policy.md`  
**Sample:** Work `42c22be9-ac88-4407-90cf-19cf79847d07` · Route `scene_1787821760006`  
**Renderer:** Local · Z-Image-Turbo · 512×512  
**Jobs (initial batch):** `11cb864c…` `54e36adb…` `aad3e91e…` `192389e8…` `c35c4c35…`

---

## Method

Applied **V1 rules** (§2 of policy): same beat → no contradiction → useful cues.  
**Not** applied: full caption detail reproduction.

Captions taken from live `scenes.story_images_v2` (2026-08-28). Images from initial succeeded Local jobs (`.tmp-review/frames5/`).

---

## Summary table

| Frame | Caption beat (one line) | Capability | Contradiction? | Useful? | **V1 verdict** | Next action |
| ----- | ------------------------- | ---------- | -------------- | ------- | -------------- | ----------- |
| **0** | 腐败黄巾起 → 刘焉张榜募兵 | `LOCAL_SAFE` | No | Yes (黄巾色 + 官榜场景) | **ACCEPT** | Caption 仍多 beat，后续可拆；榜文「招聘术士」弱 cue，非反转叙事 |
| **1** | 大兴山战，关张斩将破黄巾 | `LOCAL_HARD` | Borderline | Partial | **DEFER** | 战场气氛有用；关张兵器与人错配，易误导身份；单帧 `missing_identity` 重试或靠 caption 兜底后再 Accept |
| **2** | 见榜 → 桃园结义 | `LOCAL_SAFE` | No | **Yes** | **ACCEPT** | **正向证据** — 可 Human Accept 写入 |
| **3** | 救董卓后董卓轻慢，张飞拔剑 | `LOCAL_HARD` | **Yes** (握手结盟) | No | **FAIL** | **停止同构 Local retry**；保留 boundary evidence |
| **4** | 商贾捐铁，铸剑刀矛 | `LOCAL_SAFE` | No | Yes (桌上兵器陈列) | **ACCEPT** | 缺炉火/商贾为 omission；可 Accept |

---

## Frame 2 — `LOCAL_SAFE` positive evidence

**Caption:** In Zhuo County, Liu Bei, Zhang Fei, and Guan Yu unite over a recruitment notice, retiring to a peach orchard the following day to swear a sacred brotherhood oath before Heaven and Earth to die together.

**Image:** Three figures in blooming peach orchard; Liu Bei (布衣), Guan Yu (长须铠甲), Zhang Fei (虬髯 + 蛇矛). Static solemn group — reads as **桃园兄弟 + 场景**.

**V1 checklist:**

- Same beat: visual subset (结义站姿；未画「见榜」) → OK  
- Contradiction: none  
- Useful: strong mental model for the oath trio and peach garden  

**Verdict:** Meets V1 North Star. Recommended **first Human Accept** on this route under new policy.

---

## Frame 3 — `LOCAL_HARD` boundary evidence

**Caption:** The brothers rescue Imperial Commander Dong Zhuo from rebel forces, but Dong Zhuo treats them with arrogant disdain upon learning Liu Bei holds no official title, provoking Zhang Fei to draw his sword in outrage.

**Image (initial + post-fix retries):** Recurring **handshake / clasped hands** in tent; at best four figures with handshake foreground; worst white character-sheet lineup.

**V1 checklist:**

- Same beat: **No** — alliance greeting vs outrage / draw sword  
- Contradiction: **Yes** — architect FAIL example  
- Useful: misleads relationship  

**Verdict:** **FAIL** under V1. Aligns with architect: stop same-template Local retry; tag `LOCAL_HARD`; fallback eligible in future, not auto.

**Note:** Pipeline bugs (Expression not enqueued, duplicate OVERRIDE) were fixed; later jobs **did** carry full Expression (Dong Zhuo, FORBIDDEN handshake). Failures persist → renderer prior / capability ceiling, not authoring.

---

## Frame 0 — detail

**Strengths:** Yellow headcloth rebel cue; weathered official notice board; town square / wall — supports「乱世 + 张榜」mental model.  
**Omissions (OK under V1):** 张角兄弟、刘焉未出镜、连续败仗未画。  
**Weak cue (not FAIL):** Board text「招聘术士」≠ 募义兵，但不构成相反叙事。  
**Structure debt:** Caption still packs corruption + rebellion + recruitment — split recommended for Reader, separate from V1 image gate.

---

## Frame 1 — detail

**Strengths:** Dusty field, two mounted warriors, combat march energy —「出战」可读。  
**Omissions (OK):** No explicit「斩将」瞬间；刘备几乎不可辨。  
**Risk:** Left rider holds green-tinted polearm (青龙偃月形态)；right long-beard rider holds straight spear — **关张兵器归属与常识对调**，读者若靠图认人可能建立错误 identity model → **DEFER** not automatic FAIL unless product treats weapon-owner as hard identity contract.

---

## Frame 4 — detail

**Strengths:** Three brothers + table of swords including green-blade weapon; courtyard workshop tone.  
**Omissions (OK):** No forge fire, no merchant figures, no horses.  
**Contradiction:** None —「获得/检视兵器」与 caption 不矛盾。

---

## Operator actions (immediate)

| Frame | Action |
| ----- | ------ |
| 2 | **Accept 写入** — V1 positive evidence |
| 3 | **Do not Accept**; **do not** same-template Local retry |
| 0, 4 | **Accept** if operator accepts weak board text / missing forge |
| 1 | **Defer** — one targeted `missing_identity` retry or Accept only if caption carries identity |

---

## References

- Architect feedback (2026-08-28) — ACCEPT V1 direction  
- `docs/decisions/scene-frame-alignment-architect-brief-001.md`  
- ADR-011 — Expression ⊥ Projection; frame-level Cloud not default
