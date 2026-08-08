# IMPLEMENT-SCC-001-L2-C — Propose Signals for Scene Context Candidates

**Status:** **PASS · Verified** · 2026-08-08  
**Grant:** EXECUTE GRANTED → implemented → human verification PASS  
**Scope:** Level 2 Controlled Expansion — Propose → Context candidate quality  
**Parent grant:** Level 2 Controlled Expansion (Option A)  
**Prerequisite:** L2-A **PASS · Verified** · L2-B **PASS · Verified**  
**Does not authorize:** Level 3 · Reader identity redesign · full Admin IA redesign · D1 heuristic-as-ownership · Story-batch attach revival

---

## 1. Slice intent

```text
Improve Discovery Propose so Editorial Scene candidates carry
appearance / location / narrative cues that serve Scene Context materialization.

MUST NOT invent Story/Route membership tables or revive Work-batch attach.
```

Product outcome (ADR-012 / SPEC-SCC-001 §5.1–5.2):

> Discovery MAY produce Scene Context **candidate** information  
> (narrative moment cues, appearance/location candidate references, creation-facing Expression).  
> It MUST NOT establish Runtime Truth or Story ownership of cast/place.

L2-A stopped **write** pollution. L2-B aligned **display**.  
L2-C improves **Propose signal quality** feeding Context (via existing Accept → associate / Projection path).

---

## 2. Problem this slice addresses

Today Propose already emits `visualIntent` + `rendererExpression` on Scene candidates, but quality is uneven:

* Intent `characters[].name` often missing → L2-B aggregate falls back to role-only cues  
* Environment / location cues may be generic or not name-aligned with Work Archive locations  
* No explicit “Context candidate” framing in prompts — model may still think in Story-cast bags  
* Character/Location propose remains Work Archive candidates (correct) — Scene propose must **reference** them by appearance, not attach them to Story

L2-C tightens Propose **scene** (and only as needed, prompt/validation around Context cues) so downstream Context enrichment + aggregate are denser — without changing ownership layers.

---

## 3. In scope (EXECUTE — delivered)

1. **Propose prompt / schema guidance (Scene)** — `SCENE_CONTEXT_CANDIDATE_PROPOSE_RULES` + hierarchy-only wording  
2. **Additive normalize** — seed Intent cast from Expression; fill names from Work character candidates when grounded in Expression.visual / role  
3. **Soft assess warnings** — `assessSceneContextCandidateSignals` (non-blocking)  
4. **Reuse** `visualIntent` / `rendererExpression` only (no new ownership fields)  
5. **Tests** — prompt, normalize, reject `characterIds`/`locationId`, aggregate sees densified names  

---

## 4. Out of scope (this slice)

```text
❌ Revive Accept/UI Work-batch attach to Story/Route (rejected D1 / undone by L2-A)
❌ Delete Route character_ids / location_id (Level 3)
❌ Historical migration / Context backfill of old Works
❌ Reader URL / Scene Context page identity
❌ Full Admin IA redesign
❌ Replace Human Accept as Runtime Truth gate
❌ Unbounded “rewrite all Propose” without allowlisted files
❌ Freeze Propose schema as Architecture forever
```

---

## 5. Allowlist (delivered)

| Path | Role |
| ---- | ---- |
| `lib/discovery/scene-context-candidate-signals.ts` | Prompt rules · assess · normalize |
| `lib/discovery/propose-service.ts` | Scene prompt + example named Intent cast |
| `lib/discovery/candidate-validate.ts` | Normalize on scene validate + archive post-step |
| `__tests__/discovery/scene-context-candidate-signals.test.ts` | Signal quality + non-membership |
| `docs/spikes/*` · status rows | Grant + evidence |

---

## 6. Runtime Truth Gate (L2-C)

```text
1. Propose Scene candidates MAY carry appearance/location/narrative cues for Context
2. Those cues MUST NOT be treated as Story/Route ownership or batch membership
3. L2-A: Accept MUST NOT batch-fill character_ids / location_id
4. L2-B: Story A display ⊆ union(child Scenes/Contexts of A); A ↛ B-only cues
5. Identity freeze: Editorial Scene ≠ Scene Context ≠ Frame ≠ Route ≠ Story
6. Discovery still MUST NOT unilaterally establish Runtime-authoritative Scene Context
```

---

## 7. Architect Gate

```text
IMPLEMENT-SCC-001-L2-C

Status: EXECUTE GRANTED → Implemented
Scope: Propose → Scene Context Candidate Signals

Allowed: Scene Propose prompt · Context-candidate wording ·
         additive validation/normalization · reuse Intent/Expression ·
         signal quality + non-membership tests · evidence update
Forbidden: Story/Route membership generation · Accept batch attach revival ·
           automatic Runtime Truth · Level 3 · historical migration ·
           Reader identity redesign · full Admin IA redesign
```

---

## 8. Implementation evidence

| Gate | Evidence |
| ---- | -------- |
| Scene Propose denser named appearance / location cues | `scene-context-candidate-signals.ts` + prompt rules; post-step name fill |
| No Story/Route membership revival from Propose | `normalizeRawCandidate` rejects `characterIds`/`locationId`; tests |
| L2-A / L2-B invariants still green | discovery + scene-context vitest suites |
| Human verification | **PASS** · 2026-08-08 |

---

## Refs

```text
docs/spikes/adr-012-batch-attach-pollution-resolution.md
docs/spikes/implement-scc-001-level2-controlled-expansion.md
docs/spikes/implement-scc-001-l2a-context-ownership-authority.md
docs/spikes/implement-scc-001-l2b-ui-context-aggregate.md
docs/adr/012-scene-context-runtime-boundary.md
docs/specs/spec-scc-001-scene-context-contract.md
lib/discovery/propose-service.ts
lib/discovery/scene-context-candidate-signals.ts
```
