# IMPLEMENT-SCC-001-S1 — Context-aware projection path

**Status:** Implementation Authorization **GRANTED** (scoped First Slice) · 2026-08-08  
**Production Authorization scope:** Minimal Production Enablement Level 2 — **S1 only**  
**Not granted:** Level 3 Full Migration · URL/page identity · Route field removal · Admin redesign

---

## Slice

```text
Add Context-aware projection path behind existing Reader delivery
```

```text
Editorial Scene staging
        → association → Scene Context (scene_contexts_v1)
        → projection → Reading Frame (story_images_v2 {url,caption})
```

---

## Allowlist

| Path | Purpose |
| ---- | ------- |
| `lib/scene-context/**` | Associate / parse / feature flag / Runtime Truth Gate |
| `lib/rollout/reading-frame-persist.ts` | Context path behind flag |
| `lib/rollout/scenes-server.ts` | Additive `scene_contexts_v1` read/write |
| `lib/rollout/projection-engine.ts` · `reading-route-projection.ts` | Surface `contextId` |
| `app/api/admin/rollout/reading-route-projection/route.ts` | Return `contextId` / `contextPath` |
| `docs/supabase/migrations/20260808000000_scene_contexts_v1.sql` | Additive column |
| `config/infra/scene-context-defaults.md` | Deployment knobs |
| `__tests__/scene-context/**` | Gate + associate tests |

---

## Denylist (still)

* Route `character_ids` / `location_id` removal
* Bulk historical migration
* Reader URL / navigation change
* Scene Context page identity
* Admin IA redesign
* Restoring `SceneProjectionLink` as authority

---

## Enablement

1. Apply SQL migration `20260808000000_scene_contexts_v1.sql`
2. Set `SCENE_CONTEXT_PROJECTION_ENABLED=1`
3. Optional: `SCENE_CONTEXT_WORK_ALLOWLIST=<workUuid>`

Rollback: unset flag → legacy path.

---

## Runtime Truth Gate

On Context path, persist aborts unless:

* Context owns narrative / appearance / location / Expression (as available)
* Frame is `{url, caption}` only
* Route character/location fields unchanged by Context path
