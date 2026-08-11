# IMPLEMENT-SCC-001-L4-A — Admin Frame + Context Edit Surface

**Status:** **PASS · Verified** · 2026-08-11  
**Grant:** EXECUTE GRANTED — Story edit frame list + right drawer for Frame+Context  
**Prerequisite:** L3 program **COMPLETE** (L3-A/B/C **PASS · Verified**) · S1 Context path available  
**Parent track:** Admin / Creator IA after Route ownership sunset (ADR-012 / SPEC-SCC-001)  
**Does not authorize:** Reader URL redesign · Scene Context as page that replaces Reading Route · restoring Route membership columns · full Discovery IA rewrite · separate Frame edit route

---

## 1. Slice intent

```text
Split Admin editing so Story/Route metadata and Frame+Context detail
are separate *surfaces* on the same Story edit page.

Story edit page (host)
  → Route delivery metadata (title / chapter / summary)
  → Frame list: open drawer · reorder frames · add/remove

Frame+Context drawer (right sheet on Story edit)
  → one Reading Frame + its Scene Context
     (caption, image, character appearance, location context)
  → switch among frames of the same Story without leaving the page
```

| Field | Owner |
| ----- | ----- |
| caption · image url | Reading Frame (`story_images_v2[i]`) |
| 出场人物 · 地点 | Scene Context (`scene_contexts_v1`) |
| frame order | `story_images_v2` + Context `projectsToFrameIndex` alignment |

---

## 2. Delivered (EXECUTE)

1. Helpers — `lib/scene-context/frame-context-edit.ts` (swap / remove / ensure Context / appearance map)  
2. UI — `FrameListPanel` + `FrameContextDrawer` (Sheet)  
3. Wire — `ReadingRouteForm` replaces inline `MultiImageUploader` full edit  
4. Persist — `lib/scenes` create/update writes `story_images_v2` + `scene_contexts_v1`  
5. Tests — `__tests__/scene-context/frame-context-edit.test.ts`

---

## 3. Runtime Truth Gate (L4-A)

```text
1. Appearance / location edits MUST persist on Scene Context only
2. Caption / image edits MUST persist on Reading Frame only
3. Story/Route update MUST NOT write appearance/location or revive membership columns
4. Reorder MUST update Frame sequence and keep Context↔frameIndex association consistent
5. Identity freeze unchanged
6. Drawer is Admin surface on Story edit — not Context-as-page
7. L3 demotion / column drop remain in force
```

---

## 4. Architect Gate

```text
IMPLEMENT-SCC-001-L4-A

Status: PASS · Verified
Scope: Frame list/reorder on story edit; Frame+Context edit in right drawer
```

---

## 5. Implementation evidence

| Gate | Evidence |
| ---- | -------- |
| Reorder remaps Context indices | `frame-context-edit.test.ts` |
| Appearance from Archive → Context only | same |
| Persist hosts Contexts on Route row without membership columns | `toUpdateRowWithoutMembership` + L3-C test |
| Human verification | **PASS** · story list + drawer · 2026-08-11 |

---

## Refs

```text
components/reading-routes/FrameListPanel.tsx
components/reading-routes/FrameContextDrawer.tsx
components/reading-routes/ReadingRouteForm.tsx
lib/scene-context/frame-context-edit.ts
lib/scenes.ts
```
