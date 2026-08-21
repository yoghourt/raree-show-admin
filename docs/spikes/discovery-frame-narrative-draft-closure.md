# Discovery Frame Narrative Draft Authority — Architecture Closure

**Status:** **PASS** — Architecture closed · Implementation authorized by product grant 2026-08-20  
**Date:** 2026-08-20  
**Supersedes (partial):** `reading-frame-narrative-authority-closure.md` §8 Option A rejection **only insofar as Discovery was forbidden to draft Reader Frame text**  
**Does not supersede:** `caption` remains the Runtime Reader Narrative Authority; no Work Canon; Human Confirm remains ADR-004  

**Primary capability:** D1 Complete Reading Experience  
**Secondary:** D2 AI-Assisted Content Pipeline  

---

## 1. Problem

RFN-001 correctly froze:

```text
story_images_v2[].caption = Reader Narrative Authority
```

It incorrectly assumed the **authoring workflow** was: Discovery proposes stills / empty slots; Human writes Frame text after Accept.

Product requirement:

```text
Source → Discovery organizes into confirmable candidates → Human confirms (edit allowed) → caption
```

Human is **not** the primary writer of Reader prose. Empty or still-only Scene candidates are **deficient proposals**, not a valid handoff.

---

## 2. Runtime Evidence

- Propose typical counts (`scene 1-4`) + Expression Rule 3 stills → few static Scene.summary strings.
- Granularity G1+G4 FAILs outline-mirrored `N Stories × 1 Frame` but does not generate `1 Story × N` narrative Frames.
- RFN-001 persist wrote `{caption:""}` on first projection → Confirm produced no Reader text.
- SPIKE-DISCOVERY-SCENE-001: Story.summary kept outcomes; Scene/caption was a still.

---

## 3. Authority Boundary

```text
Source Content                         original narrative
        ↓  Discovery Propose
Frame Narrative DRAFT                  Scene.fields.summary (one Reader step)
        ↓  Human Confirm / Edit
Approved Frame Narrative               story_images_v2[].caption
        ↓  Reading Runtime
Reader
```

| Artifact | Authority for | Not authority for |
| -------- | ------------- | ----------------- |
| Source | What happened | Runtime Truth |
| Discovery Scene.summary | **Draft** Reader step text for Human to confirm | Runtime until Confirm; not Expression |
| Human Confirm | Approval / edit of that draft | Blank authorship as the happy path |
| `caption` | **Runtime** Reader text | Discovery identity |
| `Story.summary` | Editorial Story compression | Reader reconstruction |
| `rendererExpression` | Creator still | Reader prose |

**Discovery drafts. Human confirms. Caption holds.**

---

## 4. Story → Frame Contract

- One continuous reading arc → **one Story**.
- Each Reader-required turn of that Story → **one Scene candidate** (one Frame draft) under the same `parentStoryCandidateId`.
- `1 Story × 1 Frame` is legal only for a single-turn Story.
- `N Stories × 1 Frame` that slices one arc remains Granularity FAIL.
- Draft text MUST carry the turn (outcome, attempt, prevention, cause) when that is the beat — not only still geometry (“confront on horseback”).
- Expression remains a **separate** field. Still rules MUST NOT rewrite Scene.summary.

---

## 5. Discovery Boundary

Discovery **owns**:

- Extraction and structuring of Source into Character, Location, Story, and **Frame Narrative drafts** (Scene.summary).
- Emitting **enough** Scene candidates under one Story to cover that Story’s Reader steps (hard cap remains `MAX_CANDIDATES_PER_TYPE`).
- Handoff to Human Review.

Discovery **must not**:

- Skip Human Confirm.
- Treat Expression / Visual Intent as Reader text.
- Invent Work Canon.
- Use `Story.summary` as the Reader sequence.

---

## 6. Runtime Mapping

On **first** persist of an accepted Scene staging:

```text
confirmed Scene.summary (else title) → story_images_v2[].caption
```

This is Confirm writing the **draft**, not Scene.summary remaining Runtime authority.

On **re-project** of an existing Frame: preserve Human-edited `caption` and `url`. Do not copy Story.summary. Do not overwrite.

Zero Frames / empty captions remain **not** Reader-complete.

---

## 7. RIE / Granularity

Unchanged: Granularity is the topology gate (G1–G4). Work Canon is not a production Accept prerequisite (RFN-001).

IE, if a caller supplies Canon+Bind, still judges **Frame captions** (Discovery draft = Gate’s FrameNode.caption = Scene.summary).

---

## 8. Decision

**Accepted:** Discovery is the Frame Narrative **draft** author. Human Confirm is the **approval** gate. Runtime authority remains `caption`.

Previous Option A rejection applied to “Discovery owns Runtime without Confirm” and “Discovery is the Reader app.” It does **not** apply to “Discovery organizes Source into N confirmable Frame texts.”

```text
PASS
→ Implementation: Propose contract + first-persist copy of confirmed draft + preserve edits
```

---

## 9. Required Implementation

1. Propose: Scene.summary is required Frame Narrative draft; one Scene per Reader step under one Story; do not use “scene 1–4” as a compression strategy; Expression rules must not shape summary.
2. Validate: Scene without summary is not a candidate.
3. Persist: new Frame slot caption := confirmed draft; existing slot preserved.
4. Review UI: Scene summary labeled as Reader 文案草稿（确认后写入画面说明）.

Out of scope: auto-split algorithm beyond Propose instructions; Canon; new schema column; Expression redesign.

---

## 10. Open Questions

- Hard cap 10 Scenes per Propose may still clip very dense excerpts (existing D3 cap, not this grant).
- Existing production Routes with still captions / empty captions are not auto-rewritten.
