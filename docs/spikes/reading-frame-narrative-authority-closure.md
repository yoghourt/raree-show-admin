# Reading Frame Narrative Authority — Architecture Closure

**Status:** **PASS** — Architecture closed · Implementation scope may be defined  
**Date:** 2026-08-20  
**Grant:** Architecture Closure — Reading Frame Narrative Authority  
**Primary capability:** D1 Complete Reading Experience  
**Architecture dependency:** A Architecture Closure  
**Secondary impact:** D2 AI-Assisted Content Pipeline  
**Baseline evidence:** `docs/spikes/spike-discovery-scene-001.md`  
**ADR/SPEC:** none in this closure. Write ADR/SPEC only after this boundary is accepted.

This document contains only the ten required sections.

---

## 1. Problem

Two responsibilities are collapsed in production:

```text
Story.summary     = editorial / semantic summary of an approved Story
Reading Frame     = Reader-facing narrative (Frame Narrative + optional image)
```

Runtime Hot Path currently does:

```text
Discovery Scene.summary
      ↓
captionFromStaging
      ↓
story_images_v2[].caption
      ↓
Reader
```

SPIKE-DISCOVERY-SCENE-001 showed the loss: approved `Story.summary` often still holds the beat (Daxing slaying; Dong Zhuo rescue); Frame text is a **still**. Accept did not delete those turns. The mapping did.

The architectural question is therefore not “how does Discovery extract more facts?” It is:

> **Who owns the transformation from a human-approved Story into Reader-facing Reading Frame narrative, and what contract governs that transformation?**

Discovery currently feeds the Frame because its Editorial Scene candidate is copied into `caption`. That is misuse of an upstream proposal, not proof that Discovery owns Reader narrative.

---

## 2. Runtime Evidence

Frozen production dump `2026-08-20T10:01:08.250Z`, Work *Romance of the Three Kingdoms*, five Reading Routes. `SCENE_CONTEXT_PROJECTION_ENABLED=1`.

| Fact | Evidence |
| ---- | -------- |
| Reader-facing text is `story_images_v2[].caption` | `ReadingFrame = { url, caption }`; RIE-001/002; Admin Frame drawer requires caption |
| `caption := Scene.summary` (else title) | `lib/rollout/reading-frame-persist.ts` `captionFromStaging` |
| `Story.summary` is richer than Frame and is not what the Reader reads | Daxing Route summary contains “slay Deng Mao and Cheng Yuanzhi”; caption is “confront … on horseback” |
| One still-shaped Frame under-carries a Story | Same Route; Granularity Gate G1+G4 on the sibling 5×1 topology |
| Frame *can* carry a required turn when the prose is written as narrative | Dong Zhuo caption contains “restrain”; Story.summary does not |
| 0 Frames is not a Reading experience | Merchant Patronage: Story.summary present; `story_images_v2=[]` |
| Image / Expression / Scene Context do not replace Frame text | Expression action weakens “restrain” to “gesturing”; Context.relationship holds “brother” while caption does not; L4-B consumes appearance/place, not caption |
| Discovery Candidate is not durable Truth | Review is sessionStorage; later Propose of the same Source dropped prevention that production caption kept |
| Frame Narrative already exists as a Runtime field | SPEC-CORE-001: `story_images_v2[]` = Reading Frame + Frame Narrative; ADR-008: `caption` aliases Frame Narrative |
| An existing Production surface already edits Frame text | `components/reading-routes/FrameContextDrawer.tsx` — caption required |

CORE-001 also names Route `summary` as **Route Synopsis** (container prose). It is not Reader Step text. That matches constraint 6: `Story.summary` / Route synopsis MUST NOT substitute Frame Narrative.

---

## 3. Authority Boundary

No new authority layer is required. Existing artifacts already express the chain:

```text
Source Content                         original narrative (not Runtime Truth)
        ↓  Human Acceptance (ADR-004)
Approved Story / Character / Location  approved product content
        ↓  governed projection + Production persist (ADR-007)
Reading Frame Narrative                text the Reader reads
        ↓  Reading Runtime consumption (SPEC-RDX-001)
Reader
```

| Artifact | Authority for | Not authority for |
| -------- | ------------- | ----------------- |
| Source Content | What the work originally says | Reader Step text; approved product |
| Approved Story unit | What this Story is allowed to mean (editorial object, **not** the `summary` field) | Reader Step text |
| `Story.summary` / Route Synopsis | Editorial / container compression | Reader reconstruction |
| **Reading Frame Narrative** (`caption`) | **The text the Reader reads** | Image generation; appearance ownership |
| Reading Frame `url` / Expression | Creator still | Reader story understanding |
| Scene Context | Supporting moment context (who / where / beat metadata) | Replacement for Frame Narrative |
| Discovery Candidate | Proposal only | Runtime Truth |

**Authoring vs consumption (do not collapse Option C’s diagram):**

- **Authoritative artifact:** Reading Frame Narrative.
- **Authoring home (already exists):** Production persist of Frames on a Reading Route — Rollout Projection Accept and Admin Frame CRUD.
- **Consumption home:** Reading Runtime (RDX) reads persisted Frames. RDX MUST NOT invent Frame text at read time from `Story.summary`.

RDX v1.5 language “Frame provides visual representation; Scene Context provides narrative context” describes **moment-context ownership** (ADR-012: who appears, where). It MUST NOT be read as “the Reader’s story text lives on Scene Context.” Runtime Truth: the Reader’s story text is Frame Narrative. Scene Context remains supporting.

NIM-INV-06 is preserved: **editorial progression authority** stays on Editorial Scene. Reading Frame does not become an Editorial identity. Frame is the Runtime **carrier** of the text the Reader reads, representing a Reader Step.

---

## 4. Story → Frame Contract

Not a field schema. The contract for turning an approved Story into one or more Frames:

**Narrative unit (Reader).** One Reading Frame = one Reader Step representation: Frame Narrative (required) + optional image.

**Narrative unit (Editorial).** One Approved Story = one Mental Model Transition (ADR-005). It contains one or more editorial progression beats. Those beats are realized in Runtime as an **ordered Frame sequence** on the Story’s Reading Route.

**What must survive.** Every Reader-required turn of **this Story** must be recoverable from the **Frame Narrative sequence alone**. Proven kinds from SPIKE-DISCOVERY-SCENE-001 / RIE-001: event, outcome, attempted action, prevented action, causal turn, relationship change — when they are the beat. `Story.summary` is not a survival path.

**Frame narrative sufficiency.** A Frame is sufficient when a Reader of **that Frame’s text** can establish the understanding that Step is responsible for. A still description (“confront on horseback”) is insufficient when the approved Story’s beat is an outcome (“slay Deng Mao and Cheng Yuanzhi”). Image, Expression, and Context.relationship cannot complete that understanding.

**When a Story must produce multiple Frames.** When one Frame cannot communicate the Story’s Reader-required turns coherently. `Story → 1 Frame` is legal only for a single-turn Story. It is not a universal constraint. Production 5 Stories × 1 Frame is a cardinality error (Granularity G1+G4), not a Discovery quality score.

**Relationship Story ↔ Frame.**

```text
Approved Story  ──projects onto──►  Reading Route  ──contains──►  Reading Frame[]
```

Orthogonal identities (ADR-007). N Frames per Story is valid. 0 Frames is not a complete Reading experience.

Default persist mapping remains **one Approved Editorial Scene → one Frame** when Discovery/Rollout produced that Scene. Under-framed Stories are corrected by **more Frames under the same Story** (more editorial beats), not by stuffing `Story.summary` into one caption, and not by a new framing service.

**May a Frame contain information not in `Story.summary`?** **Yes.** `Story.summary` is not the Story. Dong Zhuo production caption carries “restrain” while Story.summary does not. That is legitimate Frame Narrative.

**May a Frame invent beyond the human-approved Story unit?** **No.** Frame Narrative MUST be grounded in the approved Story (and approved Character / Location). It MUST NOT promote unapproved Source-only facts, and MUST NOT treat Discovery Candidates as Truth.

**When the Story contains more than one Frame can carry.** Produce additional Frames. Do not silently drop required turns. Do not use Route Synopsis as a hidden overflow channel.

**Not required to survive (already evidenced):** exact counts, verbatim oath wording, weapon proper names in text, narrator prophecy, Qingzhou-as-optional-prior, Expression lighting, Work Canon units.

---

## 5. Discovery Boundary

Discovery **should** own:

- Extraction and structuring of Source into Candidates (Character, Location, Story, Editorial Scene).
- Propose of Creator Expression / Visual Intent (ADR-011).
- Handoff to Human Review. Discovery **ends** at Human Review (ADR-006).

Discovery **must not** own:

- Reader-facing Frame Narrative as a Discovery success criterion.
- Reader experience authoring (Option A). Making Discovery “write better captions because they become Frames” redesigns Discovery to solve a Runtime mapping problem.
- Work Canon, atomic facts, or per-fact review.

Discovery Scene `summary` MAY be a **draft seed** for Frame Narrative, the same way Story `summary` is a draft editorial compression. After Human Accept + Projection, the Reading Frame owns the text. Prompt tuning Discovery to hide `caption := Scene.summary` is out of scope.

---

## 6. Runtime Mapping Consequence

```text
caption := Scene.summary
```

is an **accidental Hot Path contract**, not a frozen architectural decision.

| Reading | Verdict |
| ------- | ------- |
| Temporary implementation shortcut | **Yes** — `captionFromStaging` copies Editorial Scene staging into Frame Narrative so Projection Accept has a string |
| Accidental contract | **Yes** — Propose prompt and Granularity `frameNode` then treated that copy as Reader authority |
| Existing architectural decision that Frame Narrative **is** Editorial Scene.summary | **No** — CORE-001 / ADR-008 already define `caption` as Frame Narrative on Reading Frame; ROL-002 does not assign Frame Narrative authorship to Discovery; Admin Frame CRUD already edits caption independently |

**Required correction (architecture, not schema freeze):** Frame Narrative is authored on the Reading Frame. Editorial Scene.summary / Expression / Intent MUST NOT be identity-equal to Frame Narrative. The copy may remain a **default draft** at first persist; Human-facing Frame text is the authority thereafter.

Related mapping defects from the baseline spike stay **out of this ownership decision** (appearance ← Expression.characters; Context extras ≠ caption; chapter_number split). They must not be “fixed” by expanding Discovery or inventing Canon.

---

## 7. RIE-002 Consequence

IMPLEMENT-RIE-002 BLOCKER:

```text
Production Work Canon authority unavailable.
```

**Invalidated as architecture.**

RIE-002 asked the right **question**: does this Story’s Frame sequence preserve the turns the Reader must have? It chose the wrong **authority object**: a Work Canon catalog + Story Bind, because `Story.summary` was forbidden and caption was not allowed to invent REQUIRED units.

This closure supplies the authority object that Canon was standing in for:

```text
Human-approved Story
        ↓
Reading Frame Narrative sequence
```

Therefore:

- RIE-002 MUST NOT introduce Work Canon as a production workaround.
- `INFORMATION_EQUIVALENCE_CONTEXT_REQUIRED` MUST NOT remain the production Accept reason for “no Canon.”
- `Story.summary` remains non-authority for Reader reconstruction (unchanged).
- Propose output remains non-authority (unchanged).
- Sufficiency is judged against the approved Story’s Frame sequence. Human Acceptance (ADR-004) is the gate. Automated IE, if kept, is a Story-scoped check on **persisted or staged Frame Narrative**, not a Canon layer.

Granularity Gate remains valid and separate: it constrains Frame **cardinality**, not Canon.

---

## 8. Decision

### Evaluated options

| Option | Result |
| ------ | ------ |
| **A — Discovery-owned Frame Narrative** | **Rejected.** Discovery proposes editorial Candidates. Owning Reader Frame text makes Discovery a Reader-experience authoring system and violates “do not redesign Discovery to solve the Frame problem.” |
| **B — New Narrative Framing capability / module** | **Rejected as a new module.** Naming the responsibility does not create a capability. The transformation already lives on governed projection + Production Frame persist. |
| **C — Existing Reading Runtime / Reading Frame home** | **Accepted, with authorship correction below.** |

### Closed decision

```text
Source Content
  → Human-approved Story / Character / Location
  → Production persist of Reading Frame(s) on the Story’s Reading Route
  → Frame Narrative is the Reader-facing text
  → Reading Runtime consumes Frames
  → Reader
```

**Narrative Framing is not a new architectural capability.** It is the existing Story → Reading Route / Reading Frame projection (ADR-007, SPEC-ROL-001/002, Admin Frame CRUD), currently misused by treating Discovery Scene.summary as Frame Narrative.

Reading Runtime **consumes** Frame Narrative. It does **not** generate Reader text from `Story.summary` at read time.

```text
PASS
→ Architecture closed
→ Implementation scope may be defined
```

No ADR in this artifact. An ADR/SPEC is warranted only to record this authority split and to correct RDX/SCC wording that collapsed “narrative” onto Scene Context.

---

## 9. Required Implementation Changes

Scope only. Not authorized as implementation in this closure.

1. **Treat Frame Narrative as the Reader text contract** on `story_images_v2[].caption`. Stop documenting or validating `Scene.summary` as Reader authority.
2. **Decouple identity `caption := Scene.summary`.** First persist MAY copy Scene.summary as a draft; Frame Narrative is then the authoritative field (Admin / Projection already edit it).
3. **Story → Frame cardinality is a narrative decision.** Block or require re-authoring when an approved Story that needs multiple turns ships 0 Frames or a single still-only Frame. Reuse Granularity G2/G3/G4; do not add Work Canon.
4. **A Reading Route with 0 Frames is not Reader-complete** (Merchant case).
5. **Remove Work Canon as production Accept authority** for information equivalence. Replace with approved Story → Frame Narrative sequence (Human gate; optional later Story-scoped check). Do not silently skip Granularity.
6. **Do not prompt-tune Discovery** as the Frame Narrative fix. Do not add `work_canon`, atomic fact review, or a Narrative Framing service.
7. **Later governance alignment (separate ADR/SPEC grant):** CORE-001 already matches this closure. RDX/SCC “Frame = visual only” must be narrowed to image/representation vs **Frame Narrative = Reader text**; Scene Context remains supporting moment context.

Out of scope here: Character appearance join, Location archive fill, Expression Local caps, Discovery extraction of unapproved Source clauses.

---

## 10. Open Questions

None that block the authority boundary or the Story → Frame contract.

Operational (not architectural): whether operators first write Frame Narrative on Rollout Projection Accept or on Admin Frame CRUD — both are existing Production surfaces.

Deferred to a later SPEC, not this closure: a deterministic Story-scoped Frame-sufficiency checker that does not reintroduce Canon.
