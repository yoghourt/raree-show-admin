# Story Structure Exit Criteria

**Status:** Implementation checklist (repo-local)  
**Authority:** Raree Show Constitution — Appendix A · Story Structure  
**Scope:** Discovery → Rollout write path and Reader presentation  
**Does not amend:** Constitution.md, ADR-005/007

## Constitutional evidence (quote)

> The reader can naturally explain the main storyline from beginning to end.

Until that evidence is observable in Runtime, do **not** claim「提炼与写入闭环」.

## Minimum Runtime evidence (must pass)

1. **Title visible** — 故事 `title` appears on the Reader plaque (TimeCard), not only in admin.
2. **Progression text visible** — each written Reading Frame exposes a non-empty `caption` on the Reader caption panel, in order; never substitute Route `summary` for caption.
3. **Characters are auxiliary** — character rail must not replace missing title/caption as the primary narrative surface.

## Write completion gate (admin)

A Story write is **complete** only when:

1. Parent 故事 persisted with non-empty `title`
2. Each intended child frame persisted into `story_images_v2` with non-empty `caption` (url may be empty until images are uploaded)
3. Post-write **read-back** (`POST /api/admin/rollout/reader-evidence`) succeeds for that route

If frames fail mid-loop, treat the write as **incomplete** (surface `actionError`); do not present “saved” as success.

## Field contract (Story / Scene / Frame)

| Layer | Fields | Reader surface |
| ----- | ------ | -------------- |
| Story（操作侧称「故事」） | `title`, `summary`, `chapter_*` | TimeCard shows `title`; `summary` is assistant/context only; `chapter_*` is Chapter metadata |
| Scene → Reading Frame | `caption` (from Scene title, optional Scene summary append) | Caption panel main text |
| Forbidden | Route `summary` as Frame `caption` fallback | — |

## PR self-check

- [ ] Manual Reader check: title + captions visible after write
- [ ] Empty-url frames still present captions in web `story_images_v2` parse
- [ ] No new knowledge-catalog features blocking Story Structure evidence
- [ ] Operator copy does not call Story「章节」except Chapter metadata labels
