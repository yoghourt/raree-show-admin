# Scene Frame Alignment — V1 Product Policy

**Status:** ACCEPTED (Architect, 2026-08-28)  
**Layer:** Product / Deployment policy — **not** Architecture or Runtime Contract  
**Authority:** ADR-010 · ADR-011 · `docs/decisions/scene-frame-alignment-architect-brief-001.md`  
**Supersedes (V1 scope only):**「每一帧必须完整视觉复述 Caption 全部叙事转折」作为 **当前 V1 验收目标**

Architecture unchanged. Canonical Expression unchanged. Creator Deployment Default = Local.

---

## 1. V1 North Star

Every Reading Frame MUST have a Frame image that:

```text
Caption → single narrative beat → Frame
  ├── same beat (may be visual subset)
  ├── no contradictory narrative
  └── useful visual cues for reader understanding
```

**Optimizing for:** narrative consistency + visual usefulness + no misleading story.  
**Not optimizing for:** full cinematic reproduction of every caption detail.

---

## 2. Executable acceptance rules (Human Accept gate)

Operator reviews **Caption beat** + **Candidate image** before「写入作品」.

### Step A — Beat scope

| Check | Pass | Fail |
| ----- | ---- | ---- |
| Caption is one beat (or operator accepts scope) | Continue | Split Scene / fix caption first |
| Frame addresses the **same beat** as caption (not a different scene event) | Continue | **FAIL** — wrong beat |

### Step B — Contradiction (hard gate)

Ask: *Does the image tell a story that conflicts with the caption?*

| Pass | **FAIL** (must not Accept) |
| ---- | -------------------------- |
| Omitted details (no draw-sword moment, no forge fire, no merchants) | Opposite or incompatible event (e.g. caption: restrain / outrage → image: handshake alliance) |
| Generic mood without wrong event | Identity swap that reverses who did what when caption names actors + actions |
| Wrong prop text on sign (weak cue) without reversing narrative | Clear reversal of relationship (saviors ↔ allies greeting when caption says humiliation) |

**Rule:** Partial realization → OK. Contradictory realization → FAIL.

### Step C — Usefulness (soft gate for V1 Accept)

| Pass | Defer (requeue / fallback later) |
| ---- | ---------------------------------- |
| Reader can form mental model: who / where / what objects / rough relationship | Cannot tell who is who; random genre scene unrelated to beat |
| Environment or iconic props support caption | White character sheet / unrelated stock scene |

### Step D — Capability label (metadata only; Phase 1)

Manually tag provenance or job notes when known:

| Label | Meaning | Deployment hint |
| ----- | ------- | ----------------- |
| `LOCAL_SAFE` | Environment, presence, static pose, clear props, simple visible action | Local first; suitable positive evidence |
| `LOCAL_HARD` | Multi-role spatial relations, restraint, draw-without-strike, disdain, complex social action | Local first; **fallback eligible** — no auto fallback in Phase 1 |

Phase 1: **no auto-classifier, no auto Cloud fallback.** Labels are for evidence and future Deployment policy.

---

## 3. Canonical Expression (protected)

- Discovery / provenance `rendererExpression` MUST stay **honest** to the real narrative beat.
- Do **not** rewrite complex beats into simpler fake beats for Local.
- Local constraints belong in **Execution Projection / Deployment**, not Discovery authorship.

---

## 4. Deployment (direction only)

```text
LOCAL_SAFE     → Local
LOCAL_HARD     → Local first → fallback eligible (operator / future policy)
```

Default remains Local. Cloud is capability compensation for known-hard beats, not Creator Default.

Env (existing): `IMAGE_CREATOR_ACCEPT_FALLBACK` — unset = no silent Cloud.

---

## 5. Explicit non-goals (this policy)

- No new Discovery Planner
- No persistent `executionProjection` dual-write
- No Model Candidate Discovery Spike for this direction
- No pipeline redesign in Phase 1

---

## 6. Evidence anchors (桃园弧 `scene_1787821760006`)

| Frame | Capability | V1 revalidation |
| ----- | ---------- | ----------------- |
| 2 | `LOCAL_SAFE` | Positive — see `docs/decisions/scene-frame-alignment-v1-revalidation-001.md` |
| 3 | `LOCAL_HARD` | Boundary FAIL — stop same-template Local retry |
