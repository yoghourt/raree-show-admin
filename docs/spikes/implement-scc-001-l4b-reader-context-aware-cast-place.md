# IMPLEMENT-SCC-001-L4-B — Reader Scene Context-aware Cast · Place

**Status:** **EXECUTE GRANTED · Implemented** · 2026-08-12  
**Grant:** EXECUTE GRANTED — Reader Step-scoped cast / place / assistant from `scene_contexts_v1`  
**Human verification:** pending  
**Prerequisite:** L3 program **COMPLETE** (L3-A/B/C **PASS · Verified**) · L4-A **PASS · Verified** · S1 Context path available · RDX Scene Context-aware Reading authorized (SPEC-RDX-001 v1.5 / RC1)  
**Parent track:** Reader consumption after Route ownership sunset (ADR-012 / SPEC-SCC-001 / SPEC-RDX-001)  
**Primary repo:** `raree-show-web` (Reader UI + delivery read path)  
**Contract authority (admin):** ADR-012 · SPEC-SCC-001 · SPEC-RDX-001 · RC1  
**Does not authorize:** Reader URL redesign · Scene Context as page / routing identity · restoring Route membership columns · Admin IA rewrite · Work-wide archive as “current cast” substitute

---

## 1. Slice intent

```text
Reader right-rail cast / place MUST follow the current Reading Frame Step,
via the Scene Context that projects to that frame — not Route-scoped
legacy membership (character_ids / location_id) or Work-wide Archive lists.

current Reader Step (imageIndex)
  → Scene Context (projectsToFrameIndex === imageIndex)
    → characterAppearanceContext → CharacterCardRack
    → locationContext           → map focus / location label
    → same Context              → Assistant scene context (characters / location)
```

Product outcome (ADR-012 / RDX-RS-07):

> On each Step, the Reader surfaces who appears and where from Scene Context.
> Reading Route remains delivery only; Reading Frame remains visual only.

| Surface | Source of truth after L4-B |
| ------- | -------------------------- |
| 右侧人物列表 | Context `characterAppearanceContext` @ current frame index |
| 地点 / 地图焦点 | Context `locationContext` (Archive ref when present; else expression / name cue) |
| Assistant location · characters | Same Context slice as the rail (no Route membership fallback as authority) |
| Work Character / Location Archive | Identity + portrait / description only — not “who is on screen” |

---

## 2. Prior debt (resolved by this EXECUTE)

Web previously mapped Route membership into Reader presentation (`character_ids` / `location_id`) and did not rebind on `imageIndex`. L3-C dropped those columns; L4-B consumes `scene_contexts_v1` at Step scope instead.

---

## 3. Delivered (EXECUTE)

1. Parse — `src/lib/scene-context/parse.ts` (`scene_contexts_v1`)  
2. Bind — `resolveContextForStep` / `resolveStepCast` / `resolveStepPlace`  
3. Delivery — `data.ts` maps Contexts; stops membership→presentation  
4. UI — `ReadingRouteExperience` rebinds rack / map / assistant on `imageIndex`  
5. Gate — `scripts/verify-step-context-cast.ts` (`npm run verify-step-context-cast`)

---

## 4. Scope (authorized)

1. **Delivery read** — Load `scene_contexts_v1` with the Route row; stop treating `character_ids` / `location_id` as presentation authority (omit or ignore if still present in any env).
2. **Step → Context bind** — Pure helper: given `contexts[]` + `imageIndex`, return the Context with `projectsToFrameIndex === imageIndex` (or explicit empty when absent — RDX-RS-06).
3. **UI rebind** — `CharacterCardRack`, location name, map focus derive from that Context; update when Step changes within the same Route.
4. **Archive join** — Resolve `archiveTsid` against Work-scoped Character / Location Archive for portrait / description / map coords; name-only / expression-only cues remain displayable without Archive hit.
5. **Assistant alignment** — `sceneAssistantContext.characters` / `location` consume the same Step Context (not Route membership).
6. **Tests + copy** — Step A cast ↛ Step B-only appearance; missing Context → empty / unknown graceful path; locale if any copy still implies Route-owned cast.

---

## 5. Out of scope (this slice)

```text
❌ Reader URL / navigation redesign
❌ Scene Context as URL or page identity (ADR-012 Open Question remains deferred)
❌ Restoring scenes.character_ids / scenes.location_id
❌ Treating Work Archive full list as current-frame cast / place
❌ Blind Route-membership → Context backfill as ownership
❌ Admin Frame+Context edit changes (L4-A closed)
❌ Discovery / Propose / Rollout production path changes
❌ Making Scene Context a Reader Step substitute (Step atom unchanged)
```

---

## 6. Allowlist (EXECUTE paths)

### raree-show-web

| Path | Role |
| ---- | ---- |
| `src/lib/data.ts` | Select / parse `scene_contexts_v1`; drop membership→presentation mapping |
| `src/lib/types.ts` | Route / Context types for Reader consumption |
| `src/lib/scene-context/**` (or equivalent) | Step→Context resolve + Archive join helpers |
| `src/components/raree/ReadingRouteExperience.tsx` | Rebind cast / place / assistant on `imageIndex` |
| `src/components/raree/CharacterCardRack.tsx` | Consume Step-scoped items (no behavior ownership change required) |
| `src/lib/assistant-system-prompt.ts` · Assistant wiring | Same Context slice |
| `src/lib/locale/*` | Non-Route-membership wording if needed |
| tests under web as applicable | Step isolation + graceful absence |

### raree-show-admin (docs / index only unless contract gap found)

| Path | Role |
| ---- | ---- |
| `docs/spikes/implement-scc-001-l4b-reader-context-aware-cast-place.md` | Grant + evidence |
| `docs/spikes/implement-scc-001-level2-controlled-expansion.md` | Named slice status row |
| `docs/specs/story-structure-field-slots.md` | Optional slot-map note for Reader cast/place |

Cross-repo code changes in admin runtime are **not** required for the happy path (Contexts already hosted on Route row).

---

## 7. Runtime Truth Gate (L4-B)

Must prove after implementation:

```text
1. Cast / place on Step i ⊆ Context(projectsToFrameIndex === i) appearance / location refs
2. Step i MUST NOT show Step j-only appearance / location from the same Route
3. Reader MUST NOT use character_ids / location_id as ownership or primary presentation authority
4. Missing Context at index i → graceful empty / unknown (RDX-RS-06); MUST NOT invent Work-wide cast
5. Assistant characters / location match the same Step Context as the rail
6. Identity freeze: Editorial Scene ≠ Scene Context ≠ Frame ≠ Route ≠ Story ≠ Reader Step
7. URL / page topology unchanged (Work → Reading Route → Reading Frame)
8. L3 demotion / column drop remain in force
```

---

## 8. Architect Gate

```text
IMPLEMENT-SCC-001-L4-B

Status: EXECUTE GRANTED
Scope: Reader Step-scoped cast / place / assistant
       from scene_contexts_v1 @ projectsToFrameIndex

Allowed:
  raree-show-web delivery parse · Step→Context bind ·
  CharacterCardRack / map / assistant rebind · Archive join ·
  graceful absence · regression tests · slot-map doc note

Forbidden:
  Reader URL / Scene Context page identity ·
  Route membership column restore ·
  Work Archive as current-frame ownership ·
  Admin / Discovery / Propose production rewrites ·
  Scene Context as Reader Step substitute
```

---

## 9. Implementation evidence (post-coding)

| Gate | Evidence |
| ---- | -------- |
| Step i cast ⊆ Context i | `raree-show-web/scripts/verify-step-context-cast.ts` |
| Step isolation (i ↛ j-only) | same |
| No membership authority | `data.ts` omits `character_ids` / `location_id`; Experience uses Context only |
| Assistant alignment | same Step Context names as rail (`ReadingRouteExperience` + verify script) |
| Human verification | _pending_ |

---

## 10. Follow-on (not this grant)

| Item | Note |
| ---- | ---- |
| Scene Context addressing / URL | Still deferred (ADR-012 Open Question) |
| Deeper Reader narrative beat UI | Separate RDX / web slice if needed |
| Admin-only polish | L4-A closed; reopen only with new grant |

---

## Refs

```text
docs/adr/012-scene-context-runtime-boundary.md
docs/specs/spec-scc-001-scene-context-contract.md
docs/specs/spec-rdx-001-runtime-reading-experience.md  (RDX-RS-06 / RDX-RS-07)
docs/specs/runtime-reading-governance-rc1.md
docs/spikes/implement-scc-001-l4a-admin-frame-context-edit.md
docs/spikes/implement-scc-001-l3c-schema-sunset.md
raree-show-web: src/lib/data.ts
raree-show-web: src/components/raree/ReadingRouteExperience.tsx
raree-show-web: docs/specs/w-01-visibility-synchronized-navigation.md (cite only)
```
