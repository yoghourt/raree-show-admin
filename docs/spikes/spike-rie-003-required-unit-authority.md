# SPIKE-RIE-003 — Required Unit Authority

**Status:** Spike Implementation **Authorized** · Evidence **PASS**  
**Production Authorization:** **NOT granted**  
**Parent:** IMPLEMENT-RIE-001 PASS  
**Date:** 2026-08-19

---

## SPIKE-RIE-003

### Status

**PASS**

Who declares REQUIRED units, how they bind to a Story, how Propose omission is prevented, and what IE must do when authority is incomplete are answered below. Production Runtime (IE Validator, Granularity Gate, Accept, Reader, captions) was not changed.

Allowlist:

| Path | Role |
| ---- | ---- |
| `scripts/rie-003-spike/**` | Canon wrapper, A–D resolvers, annotated fixtures |
| `__tests__/spikes/rie-003.test.ts` | E1–E5 evidence (17 tests) |
| `docs/spikes/spike-rie-003-required-unit-authority.md` | This record |
| Reuse `scripts/rie-spike/inventory.ts` | Source-annotated REQUIRED/OPTIONAL (RIE-001 fact) |
| Read-only `evaluateInformationEquivalence` | Existing production IE as consumer |

Denylist honored: no production edits, no ADR/SPEC, no caption generation/repair, no LLM judge.

```bash
npx vitest run __tests__/spikes/rie-003.test.ts
```

**17 passed.**

---

### Authority Candidates

| Candidate | Authority | Completeness | Story ownership | Human cost | Drift risk |
| --------- | --------- | ------------ | --------------- | ---------- | ---------- |
| **A Human annotation** | Operator invents `claimedRequiredUnits` per Story | **Fail-open.** Unaudited human can omit the compound turn. E3: sparse human + scorn caption → IE **PASS** = `AUTHORITY_COMPLETENESS_FAILURE`. | Yes, if they bind per Story. | High: invent units from source with no checklist. | High: no canon audit; Review becomes the only completeness layer. |
| **B Work canon** | Source-derived REQUIRED set (RIE-001 inventory) | **Strong at Work level.** Includes `U-ATTEMPT-PREVENTED`; OPTIONAL counts/weapons/oath/Qingzhou stay out. Completeness is a **human annotation fact**, not extraction. | **Fail.** Copying all REQUIRED onto every Story over-blocks Story A (E1 `OWNERSHIP_OVERBLOCK`). Canon does not know which Story owns which unit. | Low at Review (no bind), high up-front (inventory). | Low vs Propose; **high false-FAIL** on multi-Story batches. |
| **C Propose output** | “Propose said these units exist on this Story” | **Fail.** Grant failure case: Propose claims only 董卓被轻视; caption is four people + scorn; IE **PASS**. Recorded as `AUTHORITY_COMPLETENESS_FAILURE`. | Natural (per Candidate). | Lowest. | **Self-certification** (E5): generator decides what matters, writes captions, then IE checks the generator’s claims. |
| **D Hybrid** | Work canon = completeness; Story-level human confirmation = ownership | **Catchable.** Sparse bind → `BIND_INCOMPLETE` **before** IE. Complete bind + scorn caption → IE **FAIL** (correct). | Yes: `Story A → Units A[]`, `Story B → Units B[]` (E1). | Medium: confirm a canon checklist, not invent units. After Granularity `1 Story × N`, bind is “confirm all REQUIRED”. | Canon drift if inventory is not maintained; bind drift if operator unchecks a REQUIRED unit. Both are **authority** failures, not IE failures. |

`Story.summary` is not a candidate. Fixtures give Story B a summary that names the compound turn; `resolveStoryClaims` never reads it.

---

### E1 Per-Story Ownership

**Result:** Candidate-level claims + D bind satisfy ownership. Work-canon-on-every-Story does not.

Fixture: Story A captions = early arc only. Story B captions = rescue/scorn/four names. D bind = `EARLY_REQUIRED_IDS` vs `DONG_REQUIRED_IDS` (disjoint).

| Check | Evidence |
| ----- | -------- |
| D emits per-Story maps | `claimedUnitIds` A ≠ B; no overlap |
| A’s units vs B’s captions | IE **FAIL** |
| A’s units vs A’s captions | IE **PASS** |
| Route concat leak | `U-SCORN` vs A captions **FAIL**; vs A+B captions **PASS** — Accept must not use route hay |
| B Work canon on Story A | All REQUIRED vs A captions → IE **FAIL** → `OWNERSHIP_OVERBLOCK` |

Story A must not be credited because a unit appears in Story B’s caption. That is an ownership + candidate-scope property, not something IE can infer from a flat Work list.

---

### E2 Compound Unit

**Result:** Authority must be able to claim `U-ATTEMPT-PREVENTED` as **one** REQUIRED causal turn.

| Check | Evidence |
| ----- | -------- |
| Canon | Inventory marks it REQUIRED `causal_turn`; production claim contract has **two** `relationEvidence` groups (attempt AND prevent) |
| Entity-only substitute | Four name groups on the failure caption → IE **PASS** |
| Compound claim | Same caption → IE **FAIL** `ENTITY_OVERLAP_ONLY` |

Splitting into independent “张飞 / 刘备 / 关羽 / 董卓 appeared” claims is an authority defect. A and C can emit that defect. B and D include the compound in the REQUIRED set; D still needs the bind to attach it to Story B.

---

### E3 Missing Claim

**Grant failure case (annotated, not inferred):**

```text
Source:  张飞欲杀董卓，但刘备、关羽阻止
Propose: only claim U-SCORN
Caption: 四人在营中……董卓轻视
IE:      PASS
```

| Authority | Does IE see the hole? | Who is responsible for completeness? |
| --------- | --------------------- | ------------------------------------ |
| **C** | **No.** IE PASSes. `AUTHORITY_COMPLETENESS_FAILURE`. | Propose. Unfit. |
| **A** | **No**, if the operator also only marks scorn. Same IE PASS. | Operator with no checklist. Unfit as sole completeness layer. |
| **B** | IE FAILs on Story B (compound is in the global set) but **over-blocks Story A**. Completeness without ownership. | Canon vs Source (inventory fact). Ownership unresolved. |
| **D** | Sparse bind → `BIND_INCOMPLETE` even though IE would PASS if bind were ignored. Complete bind → IE FAIL on this caption. | **Canon vs Source** (must list the compound). **Bind vs Canon** (every REQUIRED owned by exactly one Story). **IE vs captions** (only after bind is complete). |

IE cannot invent missing claims. IMPLEMENT-RIE-001 `CONTEXT_REQUIRED` covers **empty** claims. Partial claims that omit a REQUIRED canon unit are a **different** hole: C/A false-PASS; D must refuse bind-incomplete **before** IE.

Empty claims remain `INFORMATION_EQUIVALENCE_CONTEXT_REQUIRED`. Incomplete bind should be a distinct authority error in a later implementation (`AUTHORITY_BIND_INCOMPLETE`). Not implemented here.

---

### E4 Compression

**Result:** Canon REQUIRED set does not promote 数量 / 兵器名 / 誓词细节 / 青州.

| Id | Necessity (RIE-001 annotation) | In D/B claimed REQUIRED? |
| -- | ------------------------------ | ------------------------ |
| `U-COUNTS` | DISCARDABLE | No |
| `U-WEAPON-NAMES` | OPTIONAL | No |
| `U-OATH-TEXT` | OPTIONAL | No |
| `U-QINGZHOU` | OPTIONAL | No |
| `U-THEME` | OPTIONAL | No |

Compression captions omit `fifty horses`, `Green Dragon`, `same day`, `Qingzhou` and still IE **PASS** against the full REQUIRED set.

C could mark those OPTIONAL items REQUIRED (over-claim) or drop the compound (under-claim). Necessity lives in canon, not in Propose.

---

### E5 Independence

**Result:** C is self-certification. B/D are not.

```text
C: Propose decides what matters → writes caption → IE checks Propose’s claims
   Failure case IE PASS.
D/B: Inventory is imported from scripts/rie-spike/inventory.ts
     canon.ts does not read Propose output, captions, or Story.summary.
```

Authority ≠ caption generator. Using Propose (or Story.summary, or the caption model) as the claim author recreates the hole IMPLEMENT-RIE-001 cannot close.

---

### Recommended Authority

**D — Hybrid**

```text
Source excerpt
    ↓  (human inventory — completeness fact)
Work Canon     REQUIRED[] / OPTIONAL[]   includes compound units
    ↓  (human confirmation — ownership)
Story Bind     claimedRequiredUnits[]    per Story
    ↓
IE Validator   captions vs claimed REQUIRED   (already in production)
```

After Granularity PASS, the usual object is **one Story covering the excerpt**: bind confirmation is “these REQUIRED units apply to this Story”, not a new authorship surface.

---

### Why

1. Only D both **expresses compound REQUIRED units from Source** and **binds them per Story**.
2. C fails the mandated completeness case: Propose omits the turn, IE PASSes.
3. A can punch the same hole and costs more (invent vs confirm).
4. B has the right inventory but the wrong ownership model (every Story inherits every unit).
5. IE stays a validator. Completeness and ownership stay **outside** the caption generator.

Human cost is a checklist against an existing canon, which fits Discovery Review. It does not ask operators to design narrative units from a blank field.

---

### Rejected Alternatives

| Rejected | Reason |
| -------- | ------ |
| **C Propose** | Authority completeness failure + self-certification. Explicitly forbidden as “Propose 说有，所以就算有”. |
| **A Human only** | Ownership OK; completeness unaudited; too much Discovery labor; same E3 hole. |
| **B Work canon only** | Completeness OK; E1 ownership overblock on any Story that does not carry the whole excerpt. |
| **Story.summary as authority** | Not Reader-visible; fixture summary already contains the compound while captions do not. Would mint false claims. |
| **Caption-derived claims** | Same self-certification as C. |
| **LLM-extracted canon** | Not evidenced. Would move completeness into an unverified model. Out of scope. |

---

### Production Contract

Not implemented. Recommended input to IE (unchanged validator):

```text
WorkCanon.required[]                 // source-annotated; includes compounds
  + StoryBind.confirmedUnitIds[]     // subset owned by this Story
  → claimedRequiredUnits[]           // IE input
```

Runtime rules:

| Condition | Handling |
| --------- | -------- |
| `claimedRequiredUnits` empty | Existing `INFORMATION_EQUIVALENCE_CONTEXT_REQUIRED` |
| Bind omits a WorkCanon REQUIRED id that no Story owns | **New** `AUTHORITY_BIND_INCOMPLETE` — block Accept **before** IE |
| Bind complete, caption misses a claimed unit | Existing `INFORMATION_EQUIVALENCE_BLOCKED` |
| OPTIONAL canon units | Never sent to IE as REQUIRED |
| Propose `claimedUnitIds` | **Not authority.** Diagnostic only, if present |
| `Story.summary` | Never a claim source |

Propose may still *display* a guess. It must not author the Accept-time claim set.

---

### Unresolved Questions

1. **Who maintains Work Canon in production?** This spike treats it as an editorial inventory against Source (same class of fact as RIE-001). Tooling to draft it is not authorized.
2. **Default bind after `1 Story × N` Gate PASS:** auto-select all REQUIRED then require one human confirm? Not proven in UI.
3. **Multi-Work / multi-excerpt canon reuse** — not studied.
4. **`AUTHORITY_BIND_INCOMPLETE` vs `CONTEXT_REQUIRED`** naming in production — not implemented.
5. Relation-evidence phrases remain fixture annotations (IMPLEMENT-RIE-001 limitation). Authority does not solve general paraphrase.

Items 1–2 are **human-annotation facts / product choices**, not model inferences.

---

### Next Authorization

Implement **D wiring only**: attach Work Canon + per-Story bind to Discovery Review, feed `claimedRequiredUnits` into the existing IE Accept choke point.

Do **not** authorize: Propose-as-authority, summary-as-authority, caption rewrite, auto-repair, folding IE into G1–G4, or silently skipping CONTEXT_REQUIRED.
