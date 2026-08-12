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
| `scene_contexts_v1[].characterAppearanceContext` | Frame+Context drawer 出场人物 | Context aggregate cues | CharacterCardRack @ current Step (`projectsToFrameIndex`) |
| `scene_contexts_v1[].locationContext` | Frame+Context drawer 地点 | Context aggregate cues | MiniMap / Assistant location @ current Step |

## Forbidden

- Using Route `summary` as Frame `caption` fallback on Reader
- Showing Route `title` both on TimeCard and as CaptionDisplay main text
- Calling 故事「章节」except Chapter metadata field labels（章节序号 / 章节标题）
- Using Route `character_ids` / `location_id` (sunset) as Reader cast / place authority
- Showing Work Archive full list as current-frame cast / place