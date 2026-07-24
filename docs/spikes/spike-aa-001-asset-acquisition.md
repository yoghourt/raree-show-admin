# SPIKE-AA-001 — Asset Acquisition Discovery

**Status:** Architecture Discovery **Complete** · Architect **Accepted** (2026-07-23)  
**Production Authorization:** **Not granted** (scene-frame AI still outside A3 Constraint B)  
**Spike Implementation Authorization:** **Conditionally Granted (Phase 1)** — Media Admission providers `local_upload` · `paste_url` only; wired via CPP Batch Frame Completion; frame AI **not** included  
**Contract Freeze:** **None** introduced by this Spike (no new Creator Runtime sibling)  
**Architect Decision:**  
- **SPIKE-AA-001** — **Accepted**  
- **Runtime Expansion** (fourth Creator capability) — **Rejected**  
- **Media Admission** — **Accepted** as an orthogonal domain capability; MUST integrate with existing CPP acceptance flow (not an independent application or workflow)  
- **Phase 1 implementation** — **Conditionally Granted** (2026-07-24): upload / paste URL providers only  
**Authority:** Architect · evidence package for Runtime boundary decision  
**Depends on:** SPEC-CPP-001 · SPIKE-CPP-001 (B+) · ADR-010 A3 · ADR-004 · goal-alignment evidence (CPP MVP ~5.0h → ~4.2h) · `config/infra/pd-showcase-recommendation-v1.md`  
**Last Updated:** 2026-07-24

---

## What

Authorize an **architecture-discovery-only** Spike that determines the architectural nature of **Asset Acquisition** after CPP MVP.

This Spike answers **one primary question**:

> Is Asset Acquisition an extension of Discovery, or should it become an independent Creator Runtime capability?

It does **not** design product UX, authorize scene-frame AI, redesign Discovery / Rollout / CPP, or introduce new Runtime Contracts.

---

## Why

CPP MVP achieved its stage objective (**MOSTLY YES** toward one work / operator / day): lean wall-clock ~**5.0h → ~4.2h**. Workflow orchestration is no longer the dominant constraint.

Goal Alignment ranked the next operational constraint as:

> **Scene Frame acquisition** — finding, creating, and preparing frame images for empty `story_images_v2[].url` slots (~40+ min residual on lean path; largest non-judgment visual block).

The team must decide whether that constraint is:

* still **Discovery** (wrong home, or natural extension), or  
* a **new Creator capability**, or  
* **neither** — an existing pattern (Media Admission / Jobs + Accept) missing only authorization or Deployment supply.

---

## Governing test (Architect supplement)

This Spike’s success criterion is **not** “how should Asset Acquisition be built?”

It is:

> **If tomorrow Raree Show swapped image sources entirely (stock library, AI draft, hand illustration, licensed purchase), would Creator Runtime still hold?**

| Outcome | Meaning |
| ------- | ------- |
| **Yes** | Frozen concern is a **domain capability** (admission / incompleteness), not a source technology |
| **No** | Architecture accidentally froze a **procurement method** (Bootstrap / early CPP failure mode: freeze implementation as Runtime) |

**Third lesson (Bootstrap + CPP):** freeze capability before freezing implementation.

---

## Authorization states (do not collapse)

| State | This Spike |
| ----- | ---------- |
| Contract Freeze | **None** (no new Creator Runtime sibling; no new SPEC freeze) |
| Spike Discovery Authorization | **Granted** · Findings **Accepted** by Architect (2026-07-23) |
| Spike Implementation Authorization | **Conditionally Granted (Phase 1)** — `local_upload` · `paste_url` via CPP only (2026-07-24) |
| Production Authorization | **Not granted** (incl. no A3 expansion for scene-frame AI) |

---

## Allowlist / Denylist

### Allowlist

| Artifact | Purpose |
| -------- | ------- |
| `docs/spikes/spike-aa-001-asset-acquisition.md` | This Spike + Findings |
| Read-only use of ADR/SPEC/CPP/Image evidence | Boundary comparison |

### Denylist

* Implement AA features, libraries, queues, or schema  
* Redesign Discovery, Rollout, or CPP  
* Amend ADR-010 / SPEC-IMG / Discovery SPECs  
* Grant scene-frame generation Production Authorization  

---

## Evidence baseline (ops)

| Claim | Evidence |
| ----- | -------- |
| CPP reduced coordination, not media manufacture | Goal Alignment: frame phase ~65 → ~42 min; AI wait unchanged |
| Human share still ~77% | Goal Alignment category table |
| ~18 captioned frames / lean showcase | `config/infra/pd-showcase-recommendation-v1.md` (≤20 frames) |
| Rollout writes captions with `url=""` | `lib/rollout/reading-frame-persist.ts`; Story Structure exit criteria |
| CPP Batch Frame Completion exists | upload candidate → Human「写入作品」→ Assets |
| Portrait AI path exists; frame AI **forbidden** under A3 | ADR-010 Constraint B |
| Discovery owns narrative Candidates, not images | ADR-006 / SPEC-D3; Constraint B: no Discovery auto-image |

---

## Discovery Questions

### Q1 — What exactly is Asset Acquisition?

#### Working definition (domain, source-agnostic)

**Asset Acquisition** is the set of activities that produce a **media candidate** for an already identified Asset **slot**, then subject that candidate to **Human Acceptance** into Runtime Assets.

```text
Identified slot (e.g. frame[i] with caption, or character portrait)
        ↓
Obtain candidate media (ANY source — Deployment / Job)
        ↓
Human Accept / Reject / Replace
        ↓
Asset field updated (canonical URL / bytes reference)
```

#### In scope (capability)

| Concern | Notes |
| ------- | ----- |
| Scene frame sourcing for empty urls | Dominant ops bottleneck |
| Portrait candidate supply | Already partially realized via Image Port + Accept |
| Cover / other Asset media slots | Same admission pattern |
| Candidate preparation for review | Draft ≠ Asset |
| Reference images used **as Job inputs** | Execution aid, not Runtime Truth |

#### Out of scope (not AA)

| Concern | Owner instead |
| ------- | ------------- |
| Deciding *which* frames/characters belong in the Work | Discovery (+ Human Accept of Candidates) |
| Persisting narrative structure / captions | Rollout |
| Completeness % / “what’s left” | CPP Production Plan (derived from Assets) |
| Reader consumption | Reader Runtime |
| Choosing Local vs Cloud / library vendor | Deployment |

#### Begins / ends

| Edge | Definition |
| ---- | ---------- |
| **Begins** | When an Asset **slot** is known (e.g. captioned frame with empty url, or character needing portrait) and the operator/system needs **media** for it |
| **Ends** | When Human Accept writes the media into the Asset field — **or** the slot is abandoned under business rules |

**AA does not begin at “open stock site” and does not end at “file uploaded to Cloudinary.”** Upload/generate without Accept is **Execution**, not acquisition complete (Gate A/E posture).

---

### Q2 — Compare with Discovery

| Dimension | Discovery | Asset Acquisition (domain) |
| --------- | --------- | -------------------------- |
| Primary question | **What belongs** in this Work? | **What media fills** an identified slot? |
| Input | Narrative / source text / attested summary | Slot identity + optional prompt/refs |
| Output | Ephemeral **Candidates** (Story / Character / Location / Scene…) | Ephemeral **media candidates** (URLs/bytes) |
| Authority after Accept | Staging → Rollout → narrative Assets | Directly **Asset media fields** (after Accept) |
| Modality | Structure + text (captions as narrative) | Visual / binary media |
| Failure if wrong | Canon / membership pollution (Bootstrap class) | Bad look / wrong identity; usually local to slot |
| Source replaceability | Text LLM / connectors are Deployment behind Propose | Library / AI / draw / purchase must be replaceable |
| Exists in product today | Propose → Review → Accept → handoff | Upload + portrait gen + CPP batch write; **no** authorized frame draft gen |

#### Overlap (real but narrow)

* Both emit **candidates** that MUST NOT become Truth without Human Accept (ADR-004).  
* Scene staging already creates **caption intent** that later needs a url — Discovery/Rollout create the **slot**; AA fills the **media**.  
* Both can be triggered from operator review surfaces.

#### Independent responsibilities

| Must stay Discovery | Must stay AA (domain) | Must stay elsewhere |
| ------------------- | --------------------- | ------------------- |
| Membership & narrative propose | Obtain + present media candidates for slots | CPP: incompleteness / Plan |
| Catalog Accept policy (no Accept-All) | Source-agnostic admission to Asset fields | Rollout: persist structure |
| Text Candidate regen | — | Image Port / upload Jobs: execution |

**Conclusion of Q2:** Overlap is the **Candidate → Human gate** pattern, not the **domain**. Folding AA into Discovery conflates “what is the story?” with “what picture goes here?”

---

### Q3 — Runtime Boundary (ownership of example steps)

| Step | Owner | Rationale |
| ---- | ----- | --------- |
| Finding frame **references** (moodboards, prior art as Job input) | **AA domain / Job prep** — not Discovery | References aid execution; they are not narrative membership. MUST NOT become Asset Truth without Accept. |
| Generating draft frames | **Job (Image capability)** under AA domain; **Production Authorization required** beyond A3 Constraint B | Execution only; Deploymentsource replaceable. Not Discovery Propose. |
| Importing external images | **Job (upload / import)** under AA domain | Same admission path as today’s Batch Frame Completion. |
| Managing candidate assets (pre-Accept drafts) | **Temporary / staging** under AA domain — **not** Runtime Truth | Dual-truth risk if stored as editable authority (CPP lesson). |
| Preparing review candidates for operator | **AA domain UI** (or CPP surface hosting AA actions) | Presentation; Accept still business boundary. |
| Deciding which Scene/Frame captions exist | **Discovery → Rollout** | Slot creation, not media. |
| Marking Plan incomplete until urls filled | **CPP** | Projection from Assets. |

**Discovery must not own:** draft generation, stock import, or candidate media stores as “discovered content.”  
**AA must not own:** narrative Propose, Candidate Accept-All policy, or Plan progress.

---

### Q4 — Runtime Truth

| Object | Status | Notes |
| ------ | ------ | ----- |
| **Accepted Assets** (`portrait_url`, `story_images_v2[].url`, cover, …) | **Sole media Runtime Truth** | Reader + CPP completeness predicates |
| Captions / titles / bindings on Assets | **Narrative Runtime Truth** (Rollout/CRUD) | Independent of whether url is filled |
| Discovery Candidates | Ephemeral / staging — **not** Truth until Accept + persist path | ADR-006 / SPEC-D3 |
| Media candidates (draft URLs, local files, gen outputs) | **Temporary** — Execution outputs | Become Truth only via Human Accept |
| Reference images / moodboards | **Job inputs** — not Truth | Unless explicitly Accepted into an Asset field |
| Production Tasks / Plan % | **Derived** | CPP-INV-01/02 |

**Canonical business truth for AA:** **Accepted Asset media fields** — nothing else.

---

### Q5 — Human Judgment

| Step | Class | Why |
| ---- | ----- | --- |
| Select which draft/library still matches the caption / story | **Human Judgment** | Taste + narrative fit; no automated aesthetic SLA |
| Reject unsuitable assets | **Human Judgment** | Brand / legal / continuity |
| Approve media into Assets (Accept) | **Human Judgment** (gate) | ADR-004 / Gate E — may feel like “confirmation” but is authority admission |
| Trigger generate / upload Job | **Human Confirmation** (or later auto-enqueue under policy) | Cost/latency gate; not taste |
| Cloudinary upload of already-chosen file | **Fully Automatic** | After human chose the file |
| Provider failover Local↔Cloud | **Fully Automatic** | Deployment |
| Detect empty url slots | **Fully Automatic** | CPP derivation already |
| Replace generated draft with another | **Human Judgment** | Same as select |

---

### Q6 — Highest ROI opportunity (one only)

**Choose one:**

> **Supply draft (or library) media into the existing Batch Frame Completion → Human Accept → Assets path** for the ~16–20 captioned empty-url frames per lean showcase Work.

**Evidence:**

* Goal Alignment: after CPP, frame phase still **~40+ min**; largest **non-judgment** residual CPP already instrumented.  
* Audit / showcase shape: ≤20 frames; operator is still a stills courier.  
* Portrait path proves the pattern: Job → candidate → Accept → Asset. Frames lack **authorized draft supply** (A3 Constraint B), not a second board.  
* Further CPP chrome returns minutes; Discovery judgment compression fights policy.

**Explicitly not chosen as “the one”:** renaming modules, new AA microservice, or Discovery text improvements — they do not remove still-hunt labor.

*How* drafts are supplied (AI / library / purchase) is **Deployment / later Authorization** — out of this Spike’s freeze.

---

### Q7 — Runtime evolution

Current:

```text
Discovery → Rollout → CPP
```

#### Option A — Sequential fourth sibling

```text
Discovery → Rollout → CPP → Asset Acquisition
```

| Pros | Cons |
| ---- | ---- |
| Names the ops bottleneck | **False ordering** — AA interleaved with CPP (and portraits earlier); not a post-CPP stage |
| | Risks a fourth mega-module before capability is proven distinct from Jobs+Accept |
| | Easy to freeze “AI frames” as the sibling’s identity → fails replaceability test |

**Reject** as primary topology.

#### Option B — Split Discovery

```text
Discovery
  ├── Narrative Discovery
  └── Asset Acquisition
→ Rollout → CPP
```

| Pros | Cons |
| ---- | ---- |
| Shares Candidate/Accept vocabulary | **Wrong domain ownership** — media fill ≠ “what belongs” |
| | Couples text Propose SPECs to media procurement; swapping image source appears to “change Discovery” |
| | Conflicts with Constraint B spirit (Discovery must not auto-image) by putting images under Discovery’s roof |

**Reject.**

#### Option C — Recommended: **Media Admission as orthogonal concern; not a fourth sequential Runtime**

```text
Creator capabilities (siblings, not a strict waterfall):

  Discovery     — what belongs (narrative Candidates)
  Rollout       — persist narrative structure (incl. caption slots)
  CPP           — incomplete → complete (Plan / derived Tasks)
  Media Admission (domain concern) — candidate media → Human Accept → Asset fields
        ↑
        Jobs (upload | Image Port | future library import) — Execution only
        Deployment chooses source (library / AI / purchase / handoff)
```

| Why this passes the governing test | |
| ---------------------------------- | - |
| Swap AI → stock library tomorrow | Jobs + Deployment change; Assets, Accept, CPP Plan, Discovery unchanged |
| Swap library → licensed purchase | Same |
| No scene AI forever | Manual upload Job still completes Media Admission |

**Is Media Admission a “new Creator Runtime capability”?**

| Strict sibling (like Discovery) | **Not yet justified** |
| ------------------------------- | --------------------- |
| Named domain concern + Job/Accept pattern | **Yes — already partially exists** (portrait Port, batch upload) |
| Missing piece for ROI | **Frame draft supply authorization** — not a new topology node |

**Challenge outcome (successful either way):**  
Evidence does **not** support “Asset Acquisition ∈ Discovery.”  
Evidence also does **not** yet support inventing a heavy fourth Runtime peer.  
It supports treating **Media Admission** as the frozen **capability**, with **sources as Deployment**, and the next investment aimed at **filling frame slots** through the existing CPP admission UI.

---

## Replaceability test — explicit answer

> If tomorrow image sources change completely, does Runtime still hold?

**Yes — if and only if Architecture freezes:**

1. Asset media fields as Truth  
2. Human Accept as admission  
3. CPP incompleteness derived from empty slots  
4. Jobs as source-agnostic execution  

**No — if Architecture freezes:**

* “Scene AI generator” as the AA Runtime  
* “Unsplash integration” as Discovery  
* Candidate media tables as second Truth  
* Plan progress driven by “gen Job succeeded”  

---

## Architect answer card (Success Criteria)

| # | Question | Spike answer |
| - | -------- | ------------ |
| 1 | What is Asset Acquisition? | Domain of **Media Admission**: obtain candidate media for identified Asset slots → Human Accept → Asset fields. Source-agnostic. |
| 2 | Runtime boundary? | Begins at known slot; ends at Accept into Assets. Not narrative Propose; not Plan ownership; Jobs are execution under it. |
| 3 | Part of Discovery or new capability? | **Not Discovery.** **Not** (yet) a sequential fourth sibling. Freeze **Media Admission** as orthogonal domain concern; realize via existing Jobs+Accept+CPP surfaces. |
| 4 | Next highest-ROI improvement? | Supply drafts/library into **existing** Batch Frame Completion → Accept path (~16–20 frames). |
| 5 | Smallest future investment, greatest time cut? | Authorize **frame draft supply** (e.g. scoped Image Production Authorization beyond A3 Constraint B) wired to current CPP write path — **not** a new AA app shell. |

---

## Recommended direction (**Architect Accepted** — 2026-07-23)

1. **Reject** Option A and Option B as primary topology. ✅  
2. **Accept** Option C: Media Admission as orthogonal domain capability; sources replaceable. ✅  
3. **Do not** introduce a fourth Creator Runtime capability / independent AA application or workflow. ✅ Rejected by Architect.  
4. Media Admission **MUST integrate with the existing CPP acceptance flow** (e.g. Batch Frame Completion → Human Accept → Assets), not a parallel product shell.  
5. Next authorization question (separate, not granted here): whether to grant **scoped frame draft generation** feeding the same CPP admission path.  
6. Discovery investment remains valid for handoff ROI, but is **not** the answer to the current **frame acquisition** constraint.

---

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Building “AA module” that is really an AI wrapper | Enforce replaceability test in any future SPEC |
| Putting images under Discovery | Keep Constraint B spirit; narrative ≠ media |
| Candidate media store becomes dual Truth | Prefer ephemeral candidates; Assets only after Accept |
| Ignoring A3 and shipping frame AI in CPP | Requires new Production Authorization |

---

## Recommendation checklist

- [x] Define AA source-agnostically  
- [x] Compare vs Discovery; reject false overlap  
- [x] Assign ownership of example steps  
- [x] State Runtime Truth (Accepted Assets only)  
- [x] Classify human judgment  
- [x] Single ROI pick with audit/alignment evidence  
- [x] Topology recommendation (Option C) + challenge to “new Runtime” assumption  
- [x] Replaceability test answered **Yes** under Option C  
- [x] **Architect decision:** Accept SPIKE-AA-001 · Reject Runtime Expansion · Accept Media Admission via CPP flow (2026-07-23)  
- [x] **Phase 1 implementation grant:** upload / paste_url providers (2026-07-24)  
- [ ] Frame draft AI supply (not granted — A3 Constraint B)  
- [ ] Broader Production Authorization (not granted)

**Decision owner:** Architect  
**Discovery completed:** 2026-07-23  
**Architect review:** Accepted as recorded above (2026-07-23)  
**Phase 1 implementation grant:** 2026-07-24

---

## Architect Decision Record (normative summary)

| Decision | Result |
| -------- | ------ |
| SPIKE-AA-001 | **Accepted** |
| Fourth Creator Runtime capability (“Asset Acquisition Runtime”) | **Rejected** |
| Media Admission as orthogonal domain capability | **Accepted** |
| Integration posture | **Via existing CPP acceptance flow** — not an independent application or workflow |
| Phase 1 Implementation Authorization | **Conditionally Granted** — providers: `local_upload`, `paste_url` only |
| Scene-frame AI / A3 expansion | **Not granted** |  

---

## Appendix · File index

| Doc | Role |
| --- | ---- |
| `docs/specs/spec-cpp-001-creator-production-pipeline.md` | CPP siblings; Assets Truth; Gates A–F |
| `docs/adr/010-image-runtime-and-policy.md` | A3 Constraint B (no scene-frame batch gen) |
| `docs/adr/004-source-of-canonical-truth.md` | Human Accept |
| `config/infra/pd-showcase-recommendation-v1.md` | Frame count shape |
| `config/infra/media-admission-defaults.md` | Phase 1 provider Deployment knobs |
| `lib/media-admission/` | Provider Port + adapters |
| `docs/spikes/spike-cpp-001-creator-production-pipeline.md` | Prior pipeline discovery |
| Goal Alignment (operational evidence) | ~4.2h lean; frame residual ~40+ min |
