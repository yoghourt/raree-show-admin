# IMPLEMENT-RIE-001 Result Review

**Status:** **PASS**  
**Date:** 2026-08-19  
**Parent Spike:** SPIKE-RIE-002 PASS  
**Related Boundary:** GRANULARITY-GATE-001 PASS / Closed  
**Production Authorization:** Granted (this implementation)

---

## Status

**PASS**

Architect Gate held:

1. A Granularity **PASS** Story with RIE-001 information loss (**B_LOSS**) cannot be accepted on the production Accept path (`INFORMATION_EQUIVALENCE_BLOCKED`).
2. A verified complete Candidate (**B_KEEP**) can be accepted. Reasonable compression is not killed. Entity-overlap-only is not treated as PRESENT.

---

## Architecture

```text
Propose
  ↓
Granularity Gate          topology invariants (G1–G4 unchanged)
  ↓ PASS
Information Equivalence   narrative information invariants
  ↓ PASS
Human Review / Accept
```

Candidate-level object only:

```text
Candidate = 1 Story + child Frame.caption sequence + claimed REQUIRED units
```

Reader narrative authority remains `story_images_v2[].caption` (Discovery scene `fields.summary`). `Story.summary` is not an IE input and cannot compensate missing captions.

Character / Location Archive Accept skip both Granularity and IE.

---

## IE Validator

Production module: `lib/discovery/information-equivalence/`

| Contract | Implementation |
| -------- | -------------- |
| Input | `frames[]` (caption only) + `claimedRequiredUnits[]` |
| Output | `status: PASS \| FAIL \| CONTEXT_REQUIRED` + `units[]` |
| Per unit | `unitId`, `kind`, `status` (PRESENT / PARTIAL / LOST), `supportingFrameIds`, `reason` |
| REQUIRED + PRESENT | PASS |
| REQUIRED + PARTIAL / LOST | FAIL |
| Compound `U-ATTEMPT-PREVENTED` | Two evidence groups (attempt AND prevent); both must hit captions |
| Entity names only | `ENTITY_OVERLAP_ONLY` → LOST → FAIL |
| Missing claims | `INFORMATION_EQUIVALENCE_CONTEXT_REQUIRED` — never silent PASS |
| Not implemented | caption generation, rewrite, repair, re-propose, LLM judge, Jaccard / similarity |

v1 matching is **fixture / explicit `relationEvidence` annotation**, not general NLU. That boundary is intentional.

---

## Accept Choke Point

Authoritative production choke point (same as Granularity Gate):

```text
prepareAcceptReview
prepareAcceptStoryWithChildScenes
        ↑
hooks/useDiscoverySession.acceptCandidate
```

Sequence inside `prepareAcceptReview` for Story/Scene:

1. Missing narrative → `GRANULARITY_GATE_CONTEXT_REQUIRED`
2. Granularity FAIL → `GRANULARITY_GATE_BLOCKED` (IE does not run)
3. Missing `claimedRequiredUnits` → `INFORMATION_EQUIVALENCE_CONTEXT_REQUIRED`
4. IE FAIL → `INFORMATION_EQUIVALENCE_BLOCKED`
5. Else Accept may continue

Child Scenes in the UI have no independent Accept button. Cascade Accept re-enters the same `prepareAcceptReview`.

---

## Granularity Interaction

G1–G4 were not modified. IE conditions were not folded into the Gate.

Granularity FAIL on 5×1 with IE claims still returns `GRANULARITY_GATE_BLOCKED`, not an IE code.

---

## Required Unit Contract

`claimedRequiredUnits` is caller-supplied. This implementation does **not** invent Canon Authority and does **not** select inventory by Work id.

`RIE_001_CLAIMED_REQUIRED_UNITS` is a test/caller catalog only. `app/works/[workId]/discovery/page.tsx` does not pass claims, so live Story Accept is `CONTEXT_REQUIRED` until a later grant names the production authority for claims.

Empty or omitted claims cannot PASS.

---

## Blocking Behavior

| Condition | Accept | UI |
| --------- | ------ | -- |
| Granularity FAIL | `GRANULARITY_GATE_BLOCKED` | existing Gate banner + RE-PROPOSE |
| IE FAIL | `INFORMATION_EQUIVALENCE_BLOCKED` | FAIL banner: unit, why, supporting frames + RE-PROPOSE |
| IE context missing | `INFORMATION_EQUIVALENCE_CONTEXT_REQUIRED` | context banner; Story Accept disabled |
| Character / Location | unaffected | Accept still enabled |

FAIL does not generate or repair captions. Existing edit / `全部重新提炼` remain the recovery paths.

---

## Runtime Evidence

Artifact: `scripts/information-equivalence/results/runtime-evidence.json`  
Generated: 2026-08-19T08:04:44.385Z  
Command: `npx tsx scripts/information-equivalence/runtime-evidence.ts`

Production functions (same as Review Accept):

```text
Propose-shaped Candidate
  → runGranularityGate
  → evaluateInformationEquivalence (captions only)
  → prepareAcceptStoryWithChildScenes
```

| Candidate | Granularity | IE | Accept |
| --------- | ----------- | -- | ------ |
| **B_KEEP** | PASS | PASS (no failed units) | **allowed** (4 scenes) |
| **B_LOSS** | PASS | FAIL `U-ATTEMPT` / `U-PREVENT` / `U-ATTEMPT-PREVENTED` `ENTITY_OVERLAP_ONLY` | **blocked** `INFORMATION_EQUIVALENCE_BLOCKED` |

Architect Gate flags in the artifact:

```json
{
  "passCanAccept": true,
  "lossCannotAccept": true,
  "granularityDidNotBlockLoss": true
}
```

B_LOSS `Story.summary` contains “attempted to kill … prevented”; captions do not. IE still FAIL — summary cannot satisfy the validator.

---

## Tests

```bash
npx vitest run __tests__/spikes/rie-002.test.ts
npx vitest run __tests__/discovery/information-equivalence-accept.test.ts
npx vitest run __tests__/discovery/granularity-gate-accept.test.ts
npx vitest run __tests__/discovery/review-state.test.ts
npx vitest run __tests__/discovery/discovery-session.test.ts
npx vitest run __tests__/api/discovery-propose-route.test.ts
npx vitest run __tests__/spikes/granularity-gate-001.test.ts
```

**88 passed** (7 files).

Production coverage:

1. IE PASS → Story Accept allowed  
2. IE FAIL → Story Accept blocked  
3. IE CONTEXT_REQUIRED → Story Accept blocked  
4. Granularity FAIL → IE does not bypass Granularity  
5. Granularity PASS + IE FAIL → blocked  
6. B_KEEP → PASS  
7. B_LOSS → FAIL  
8. Reasonable compression → PASS  
9. Entity overlap only → FAIL (`ENTITY_OVERLAP_ONLY`)  
10. Character Accept unaffected  
11. Location Accept unaffected  
12. No ungated Story/Frame Accept path  

Plus: Story.summary-only cannot satisfy IE; mixed batch is candidate-level (intact Story not blocked by another Story’s captions).

---

## Regression

- Granularity Gate Accept tests updated only to supply fixture-local IE claims on topology **PASS** cases. FAIL cases still assert `GRANULARITY_GATE_BLOCKED` first.
- Review-state cascade tests supply a test-only caption-presence claim so they exercise Accept, not IE semantics.
- Propose route still returns Granularity diagnostics only (IE is Accept-time, not Propose-time).
- Character / Location Accept paths unchanged.

---

## Bypass Audit

| Surface | Result |
| ------- | ------ |
| `prepareAcceptReview` Story/Scene | Granularity then IE; omit either → block |
| `prepareAcceptStoryWithChildScenes` | Forwards `ie` into `prepareAcceptReview` |
| `useDiscoverySession.acceptCandidate` | Passes `{ narrative }` then `{ claimedRequiredUnits }` (or `undefined` → CONTEXT_REQUIRED) |
| Discovery Review UI Story Accept | Disabled on Gate FAIL, IE CONTEXT_REQUIRED, or that Story’s IE FAIL |
| Child Scene Accept button | Still hidden (`showAccept={false}`) |
| Character / Location | Skip both validators |
| Work-id branch | None (`42c22be9` not in production IE/hook) |

`markReviewAccepted` is only invoked after a successful `prepareAccept*` result.

---

## Known Limitations

1. **`claimedRequiredUnits` production authority is unset.** Live Discovery does not attach claims; Story Accept is `CONTEXT_REQUIRED` until a later grant names who authors claims.
2. v1 evidence matching is **annotated phrase groups**, not general semantics. Paraphrases outside the annotation set will not be recognized as PRESENT.
3. Session-level claims (not a per-Story map). After Granularity PASS the intended object is **one Story**. Applying a full-arc inventory to a partial-arc Story would over-block.
4. Supporting-frame ids include frames that mention naive entity names, not only relation evidence.

---

## Architecture Drift

**NO**

- Granularity Gate algorithm unchanged.
- Propose / Reader / schema / caption generation unchanged.
- IE is a separate validator after Gate PASS, before Accept.
- No LLM judge, no auto-repair, no Route-level Accept blocking.

---

## Next Authorization

Recommended, not executed:

1. Name the production **Canon / claim authority** for `claimedRequiredUnits` (still missing after RIE-002).
2. Optional: per-Story claim attachment if multi-Story batches remain after Gate PASS.
3. Do **not** authorize caption rewrite, auto-repair, or folding IE into G1–G4.
