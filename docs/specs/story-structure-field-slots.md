# Story Structure Field Slots

**Status:** Implementation checklist (repo-local)  
**Related:** [story-structure-exit-criteria.md](./story-structure-exit-criteria.md)

## Slot map (admin edit / write preview / web Reader)

| Field | Admin edit (`ReadingRouteForm`) | Write preview | Web Reader |
| ----- | ------------------------------- | ------------- | ---------- |
| `title` | 标题 | 标题 | TimeCard primary plaque |
| `summary` | 摘要 | 摘要 | Assistant context only — **not** caption panel |
| `chapter_number` / `chapter_title` | 章节元数据 | 章节元数据 | Optional chapter subtitle only |
| `story_images_v2[].caption` | 画面说明 | 画面说明（caption） | CaptionDisplay main text |
| `story_images_v2[].url` | 图片 | 可空 | ImageReel (placeholder if empty) |

## Forbidden

- Using Route `summary` as Frame `caption` fallback on Reader
- Showing Route `title` both on TimeCard and as CaptionDisplay main text
- Calling 故事「章节」except Chapter metadata field labels（章节序号 / 章节标题）
