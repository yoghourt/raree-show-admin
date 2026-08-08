# ADR-012 — Batch Attach Pollution Resolution (Long-term)

**Status:** Normative explanation · Product problem framed  
**Date:** 2026-08-08  
**Authority:** ADR-012 · SPEC-SCC-001  
**Rejected approach:** Accept/UI heuristic per-story filter while keeping Story/Route ownership (ADR-012 Alternatives)

---

## 1. Product problem

```text
Extraction: character → location → story → scene
Then: attach characters / locations / scenes under stories
Result: each Story appears to own the whole batch of characters/locations
Wanted: each Story only surfaces entities related to that Story
```

---

## 2. Root cause (wrong ownership layer)

```text
Work batch
  ├── all Characters
  ├── all Locations
  └── multiple Stories
        └── each Story/Reading Route gets character_ids / location_id
            = entire batch (Accept: buildStoryRelatedEntityRefs)
```

| Layer | Today | Problem |
| ----- | ----- | ------- |
| Accept | Work-batch refs copied onto every Story staging | Contamination source |
| Review UI | Renders full char/loc lists under every Story card | Amplifies wrong mental model |
| Persist | Writes staging into Route `character_ids` / `location_id` | Freezes pollution into Runtime |
| Scenes (画面) | `parentStoryCandidateId` | Usually correct — not the main pollution path |

**Wrong granularity:** appearance/location treated as Story/Route membership.  
ADR-012 names this **batch attach pollution** / Route-level ownership error.

---

## 3. How ADR-012 solves it (ownership change, not smarter attach)

### Wrong fix (Rejected)

```text
Compute a better subset → still attach to Story/Route as ownership
```

Rejected in ADR-012 Alternatives: Extraction-only fix leaves wrong ownership granularity.

### Correct fix

```text
Work
 ├── Character / Location Archive     ← identity only (reusable)
 └── Story
      └── Scene Context               ← who appears / where (this beat)
            └── projects → Reading Frame
Reading Route = delivery only
```

| Concern | Owner after ADR-012 |
| ------- | ------------------- |
| Character/Location **identity** | Work Archive |
| Character **appearance** / location **context** at a moment | Scene Context |
| Visual asset | Reading Frame |
| Delivery | Reading Route |
| Editorial progression unit | Editorial Scene (≠ Context) |

### User-facing reinterpretation

> 「一个故事下只出现这个故事相关的角色、地点、画面」

Means:

1. **Frames** under that Story’s delivery (via Context projection)  
2. **Characters/locations** = union of appearance/location refs on that Story’s Scene Contexts (aggregate view)  
3. **Not** a Story-owned copy of the whole Work-batch entity list  

Story B does not “own” Story A’s cast because Route is no longer the ownership layer.

---

## 4. End-to-end target path

```text
Propose (char → loc → story → scene; Archive candidates at Work scope)
        ↓
Editorial hierarchy (Scene → parent Story)
        ↓
Human Accept
        ↓
Runtime-authoritative Scene Context
  (appearance / location / narrative on the beat)
        ↓
Projection → Reading Frame
        ↓
Reading Route delivers Frames only
```

Discovery Character/Location candidates = **Work Archive candidates**, not Story membership tables.

---

## 5. Capability status

| Capability | Status |
| ---------- | ------ |
| ADR-012 / SPEC-SCC-001 | Done |
| SCC-S1 Context write on Projection | Done (`scene_contexts_v1`) |
| Stop Accept batch-write as Route authority | **Not done** → L2-A |
| Review/Rollout UI aggregate from Context/child scenes | **Not done** → L2-B |
| Propose signals for Context (not Story membership) | Optional → L2-C |
| Delete Route `character_ids` / `location_id` | Level 3 · **Not authorized** |

---

## 6. Explicit non-goals of this document

* Does not authorize Accept heuristic filtering as the fix  
* Does not authorize Level 3 column deletion  
* Does not change Runtime Truth v1 Reader URL topology  

---

## Refs

```text
docs/adr/012-scene-context-runtime-boundary.md
docs/specs/spec-scc-001-scene-context-contract.md
docs/spikes/implement-scc-001-s1-context-aware-projection.md
docs/spikes/implement-scc-001-l2a-context-ownership-authority.md
lib/discovery/review-state.ts          # contamination source (to be demoted)
lib/scene-context/                     # S1 write path
```
