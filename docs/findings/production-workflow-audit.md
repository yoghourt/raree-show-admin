# Production Workflow Audit — Creator Pipeline

**Status:** Architecture discovery · evidence only  
**Date:** 2026-07-21  
**Repository:** `raree-show-admin`  
**Scope:** Current Creator production workflow and operational cost  
**Non-goals:** Do **not** redesign Creator Runtime, introduce queues/workers, or change Deployment architecture  

---

## Metadata

| Field | Value |
| ----- | ----- |
| Primary question | Can one operator produce one complete work within one working day? |
| Evidence sources | Live Admin routes/forms · ADR-010 A3 · SPEC-IMG-001 · SPIKE-IMG-001/002 · `pd-showcase-recommendation-v1` · Story Structure exit criteria |
| Timing method | Code-path click inventory + Spike measured latencies + operator-time estimates (not stopwatch production telemetry) |
| “Complete work” baseline | Public showcase canon subset (Track L / Track T shape) — see §0 |

---

## 0. Definitions

### 0.1 What “complete work” means today

There is **no** `published` flag or Publish button in Admin. Persistence to Runtime tables is the publish gate. Reader consumes stored rows/URLs.

| Layer | Minimum for “readable” | Practical “showcase-complete” |
| ----- | ---------------------- | ----------------------------- |
| Work | `title` + cover image (form-required) | Same |
| Characters | Optional for write gate; needed for rail | **8** with accepted portraits |
| Locations | Optional | **6** with names (+ optional map) |
| Reading Routes (`scenes`) | ≥1 with non-empty `title` + frames with non-empty `caption` | **8–10** routes |
| Reading Frames (`story_images_v2`) | Caption required; **url may be empty** for write completion | **16–20** frames with **real image URLs** |
| RAG backfill | Not a completion gate | Optional search quality |

Authority: `docs/specs/story-structure-exit-criteria.md` · `docs/deployment/pd-showcase-recommendation-v1.md`.

**Audit baseline (one work):**

| Entity | Count used in estimates |
| ------ | ----------------------: |
| Characters | 8 |
| Locations | 6 |
| Reading Routes (stories) | 9 (mid of 8–10) |
| Portrait accepts | 8 primary (1/character); note budget allows ≤24 variants |
| Scene frames with images | 18 (≈2 × 9) |
| Cover images | 1 |

### 0.2 Two production paths

```text
Path A — Manual CRUD
  Work → Characters → Locations → Reading Routes (+ uploads) → (optional RAG)

Path B — Discovery → Rollout → Image fill
  Work → Discovery (propose/review) → CRUD handoff (chars/locs)
       → Rollout write (titles + captions, empty frame urls)
       → Reading Route edit (upload frame images) → (optional RAG)
```

Path B is the intended assisted path for public-domain showcase. Path A remains fully valid. Estimates below assume **Path B** unless noted.

### 0.3 Actor

| Actor | Role |
| ----- | ---- |
| Operator | Authenticated Admin user (single person assumed) |
| System | Next.js Admin + Supabase + Cloudinary + Image Port adapters + LLM Propose/Copilot |
| Reader Runtime | Out of scope for production labor (consumes published assets only) |

---

## Part 1 · Current Production Workflow Map

```text
Login
  ↓
Create Work (+ cover upload)
  ↓
┌─────────────────────────────────────────┐
│ Discovery (Path B)                      │
│  Narrative input → Lock → Propose       │
│  → Human Candidate Review               │
└─────────────────────────────────────────┘
  ↓
Character Accept → Character Form → Generate Portrait → Accept/Retry → Save DB
  ↓ (× N characters; serial page round-trips)
Location Accept → Location Form → Save DB
  ↓ (× M locations)
Rollout: Sync staging → Write Story (+ auto-create missing entities)
  → Project frames (caption only, url="")
  → Reader-evidence verify
  ↓
Reading Route Edit → Upload frame images → Save
  ↓ (× routes / frames)
Optional: RAG backfill
  ↓
[Done — data is “live” for Reader; no Publish step]
```

### Step catalog

| # | Step | Purpose | Actor | Input | Output | Current implementation | Manual / Auto |
| - | ---- | ------- | ----- | ----- | ------ | ---------------------- | ------------- |
| 1 | Login | Auth gate | Operator | Credentials | Session | `middleware.ts` · `/login` | Manual |
| 2 | Create Work | Establish work shell | Operator | Title, cover, optional source profile / description | `works` row | `WorkForm` · `/works/new` · `lib/works` | Manual (cover upload auto to Cloudinary) |
| 3 | Open Discovery | Enter assisted pipeline | Operator | `workId` | Discovery UI | `/works/[id]/discovery` | Manual navigation |
| 4 | Narrative input | Provide source text for propose | Operator | Excerpts (≥512) or attested summary (≥768) | Locked session narrative | `DiscoveryComposer` · session lock API | Manual |
| 5 | Propose | Generate Candidates | System (+ Operator trigger) | Locked narrative | Ephemeral Candidates (≤10/type) | `POST /api/admin/discovery/propose` | Trigger manual · generation automatic |
| 6 | Candidate review | Gate what enters staging / CRUD | Operator | Candidates | Accepted / edited / regen’d Candidates | `DiscoveryReviewPanel` · **no** catalog Accept-All | Manual (policy) |
| 7 | Character handoff | Materialize character row | Operator | Accept prefill | Navigate to `/characters/new?...` | `storeDiscoveryAcceptPrefill` | Manual page switch |
| 8 | Character fields | Curate name / family / description / quote | Operator (+ Copilot) | Prefill + edits | Form state | `CharacterForm` · Copilot suggest APIs | Manual; Copilot optional assist |
| 9 | Generate portrait | Produce portrait draft URL | Operator trigger · System gen+upload | Name, description, optional reference URL | Cloudinary URL in form only | Server Action `generateCharacterAvatar` → Image Port → `uploadImageBufferToCloudinary` | Semi-auto (click → wait → form dirty) |
| 10 | Portrait accept / retry | Human visual gate | Operator | Preview URL | Keep / regenerate | Re-click AI button; no separate Accept control | Manual |
| 11 | Save character | Persist Assets | Operator | Form | `characters` row (`portrait_url`) | `lib/characters` create/update | Manual save (Constraint D: save = accept) |
| 12 | Location handoff + save | Materialize locations | Operator | Prefill | `locations` row | Location form · MapPicker | Manual |
| 13 | Rollout sync | Import accepted staging | Operator | Discovery staging | Rollout queue UI | `RolloutPanel` sync | Manual click |
| 14 | Story write | Persist Reading Route + frame captions | Operator trigger · System persist | Story staging + bindings | `scenes` + `story_images_v2` captions (`url=""`) | `persistStoryUnit` · `projectSceneCreate` · `verifyReaderEvidence` | Semi-auto; may auto-create missing chars/locs **without** portraits |
| 15 | Frame image upload | Make frames visually complete | Operator | Local files / URLs | Non-empty `story_images_v2[].url` | `MultiImageUploader` · client Cloudinary | **Fully manual** (no AI scene gen — A3) |
| 16 | Cross-entity navigation | Move between domains | Operator | — | Next screen | Work table row buttons only (no in-work nav) | Manual friction |
| 17 | RAG backfill (optional) | Search index | Operator trigger | Scenes | Embeddings | `RagBackfillPanel` | Semi-auto |
| — | ~~Publish~~ | — | — | — | — | **Does not exist** | N/A |

**Path A deltas:** Skip steps 3–6, 13–14; operator types all fields and creates stories manually. Portrait and frame-upload costs remain.

---

## Part 2 · Time Cost Analysis

### 2.1 Per-operation estimates

**Legend:** Manual = active human time. Waiting = blocked on network/LLM/GPU. Clicks = approximate primary actions (not every focus/tab).

| Operation | Avg manual time | Manual clicks (typ.) | Waiting time | Can run in parallel today? | Evidence / notes |
| --------- | --------------: | -------------------: | -----------: | -------------------------- | ---------------- |
| Login | 20s | 2 | ~1s | No | Auth form |
| Create Work + cover | 3–5 min | 5–8 | 2–5s upload | No | Cover required |
| Discovery narrative prep | 15–40 min | 10–30 | 0 | No | Paste/curate excerpts; largest text labor |
| Lock narrative | 15s | 2 | ~1s | No | Confirm dialog |
| Propose | 10s | 1 | **30–90s** (est.) | No (single session) | LLM; no Spike P50 in-repo |
| Review one Candidate | 30–90s | 2–5 | 0 (or Regen wait) | No catalog parallel | Per-item Accept/Edit/Regen |
| Regen Candidate | 10s | 1–3 | 20–60s | No | Feedback optional |
| Character handoff navigate | 10–20s | 1–2 | ~1s | No | Full page navigation |
| Fill/review CharacterForm | 1–3 min | 5–15 | Copilot 5–20s if used | No | Prefill helps Path B |
| Generate portrait (Local default) | 5–15s setup | 1 | **~35s warm P50** (P95 ~45s) | **No** (UI serial; A3 forbids batch) | SPIKE-IMG-002 |
| Generate portrait (Cloud fallback) | 5–15s | 1 | **~15–40s** (est.) | No | Provider-dependent; retries up to 6 |
| Portrait visual review | 15–45s | 0–1 | 0 | No | Retry adds +35s+ each |
| Save character | 5s | 1 | 1–2s | No | DB write |
| Location form + map | 1–2 min | 4–10 | 1s | No | No location image gen |
| Rollout sync + write one Story | 1–3 min review | 3–6 | 2–8s write+verify | No multi-story auto-batch beyond loop in one write | Captions only |
| Edit route + upload 2 frames | 2–4 min | 4–8 | 3–8s / upload | No | Dominant visual labor after Rollout |
| RAG backfill | 10s | 1–2 | 10–60s | Whole-work batch exists | Optional |
| Switch domain via `/works` table | 15–30s | 2–3 | ~1s | No | No work-scoped sidebar |

### 2.2 Worked example — one showcase work (Path B, Local portraits)

Assumptions: 8 characters × 1.4 generations average (40% first-pass reject), 6 locations, 9 stories, 18 frame uploads, Discovery review of ~25 Candidates, moderate Copilot use.

| Phase | Manual | Waiting | Wall-clock (serial) |
| ----- | -----: | ------: | ------------------: |
| Work shell | 5 min | 0.1 min | ~5 min |
| Discovery input + lock | 25 min | — | ~25 min |
| Propose + review + regens | 40 min | 8 min | ~50 min |
| Characters (8 × form + portrait) | 40 min | **~32 min** gen wait | ~75 min |
| Locations (6) | 12 min | — | ~12 min |
| Rollout writes (9) | 20 min | 3 min | ~25 min |
| Frame image uploads (18) | **55 min** | 8 min | ~65 min |
| Navigation / context switching tax | 20 min | — | ~20 min |
| Buffer / rework / RAG | 15 min | 5 min | ~20 min |
| **Total** | **~232 min (~3.9 h)** | **~56 min (~0.9 h)** | **~297 min (~5.0 h)** |

**Interpretation:** Under optimistic Path B with Local default and one portrait variant each, **one showcase work is ~0.6–0.7 working day wall-clock** if the operator stays focused and text/images are ready. Stretch cases (3 portrait variants, heavy regen, sourcing art for 18 frames, poor excerpts) push **8–12+ hours**.

---

## Part 3 · Human Cost Analysis

| Human cost center | Why manual today? | Can software perform it? | Should AI perform it? | Should humans always review it? |
| ----------------- | ----------------- | ------------------------ | --------------------- | ------------------------------- |
| Excerpt curation & lock | Provenance / attestation gates; narrative authority | Partially (connectors exist as specs; not full auto-ingest for showcase) | Assist selection; not silent lock | **Yes** — source authority |
| Candidate Accept / Edit / Regen | ADR-006 / SPEC-D3: no catalog Accept-All | Software can stage; cannot replace judgment | Propose/Regen already AI | **Yes** — editorial gate |
| Page navigation between domains | UI structure: work table is hub | Yes (in-work nav, deep links, wizard) | No (UX, not intelligence) | N/A |
| Character field polish | Copilot is suggest-only | Yes for drafting | Already optional AI | Prefer human Accept |
| Portrait click → wait → retry | A3: single-entity, human Accept before Assets | Yes for queue/batch **as product change** (out of scope here) | Generation already AI | **Yes** for final Accept (Constraint D) |
| Post-gen Cloudinary already automatic on AI path | — | Already software | N/A | No |
| Separate Save after gen | Explicit Accept-into-Assets | One-click “Accept & Save” possible | No | Human should still confirm image |
| Location map clicking | Spatial intent | Defaults / geocode assist | Optional | Light review enough |
| Rollout binding of chars/locs | Graph correctness | Auto-resolve exists for missing entities | Partial | Review bindings for showcase |
| **Scene frame image acquisition** | **A3 forbids scene AI gen in production** | Upload pipeline exists; gen not authorized | Architect decision (not this audit) | **Yes** if AI later; always for final |
| Finding/sourcing frame stills | No stock/search integration | Yes (library, batch upload) | Optional | Yes for final look |
| Copy/paste `char_` / `loc_` tsids | Empty-library fallback UX | Pickers when library exists | No | N/A |
| Waiting on Local ~35s/portrait | Deployment Local default | Parallelism / faster provider (Deployment) | Already AI | Human idle unless multitasking outside UI |
| Retry failed generations | Provider flakiness + taste | Auto-retry technical failures (partially exists on Cloud) | Taste retry = human | Technical vs aesthetic split |
| No Publish checklist | Product model = DB is live | Status / checklist UI | No | Human “done” signal useful |

**Dominant human time buckets (share of manual ~3.9 h):**

1. Frame image upload & curation — **~24%**
2. Discovery review — **~17%**
3. Character forms + portrait review (excl. GPU wait) — **~17%**
4. Narrative input — **~11%**
5. Navigation / rework / Rollout review — remainder

---

## Part 4 · Automation Opportunities

Classification only — **not** a design proposal.

### A — Must always remain manual

| Step | Reason |
| ---- | ------ |
| Final portrait Accept into Assets | ADR-010 Constraint D / visual brand risk |
| Discovery Candidate Accept (no catalog Accept-All) | SPEC-D3 / ADR-006 policy |
| Narrative lock attestation | Source-of-truth / provenance |
| Final judgment that a work is showcase-ready | No automated aesthetic SLA |
| Map intent (if used for Reader) | Spatial meaning |

### B — Can become one-click automation

| Step | Today | Opportunity shape (evidence only) |
| ---- | ----- | --------------------------------- |
| Generate → upload → populate field | Already mostly one click; Save separate | Accept+Save single control |
| Discovery Accept character → open form → Create | Two surfaces | Accept-and-persist without full navigation |
| Rollout sync + write | Multi-click per story | “Write all queued stories” |
| After write, jump to first empty-url frame | Manual find | Deep link to incomplete frames |
| Copilot Accept All (fields) | Exists per form | Already B-class locally |

### C — Can become background automation

| Step | Today | Opportunity shape |
| ---- | ----- | ----------------- |
| Cloudinary upload after gen | Already on server path for portraits | Extend same for any future frame gen |
| Reader-evidence verify | Inline after write | Background verify + badge |
| RAG backfill | Manual button | Post-write hook |
| Cloud provider retries | Partial (`withRetries` on SiliconFlow) | Broader silent technical retry |

### D — Can become batch jobs

| Step | Today | Opportunity shape |
| ---- | ----- | ----------------- |
| All pending portraits | **Forbidden by A3 Constraint B** as production authorization | Would require new Architecture grant |
| All empty `story_images_v2` urls | Manual serial upload; **no AI** | Batch upload UI possible without AI; AI frame gen needs grant |
| Multi-story Rollout write | Per-story write | Queue drain batch |
| Propose across chapters | One locked narrative unit | Multi-excerpt batch propose (policy-sensitive) |

---

## Part 5 · Throughput Analysis

### 5.1 Current throughput (estimated)

Assumes one focused operator, Local portrait default, Path B, serial UI.

| Metric | Estimate | Derivation |
| ------ | -------- | ---------- |
| Portraits / hour | **~8–12 accepts/h** wall | ~35s wait + ~2–3 min human/character; navigation limited |
| Portraits / hour (GPU only) | **~100 theoretical** if continuous | 3600/35 ≈ 103 — **unreachable** in current UI |
| Scene frames uploaded / hour | **~15–25** | ~2–4 min per 2-frame route |
| Characters fully done / day | **~15–25** | Forms + portraits; not counting Discovery |
| Locations / day | **~40–60** | No image gen |
| Reading Routes written (caption-only) / day | **~20–40** | Rollout assisted |
| **Showcase-complete works / week** | **~3–5** optimistic · **1–2** with variant portraits + art hunting | 5 h optimistic × 5 days vs 8–12 h realistic |

### 5.2 Throughput after automation (directional only)

Holding Architecture constraints fixed (still human Accept; still no unauthorized scene AI):

| If only B/C-class UX automation ships | Expected effect |
| ------------------------------------- | --------------- |
| Remove navigation + Accept/Save friction | −20–30% wall time |
| Batch Rollout write + incomplete-frame queue | −10–15% |
| Batch **upload** (not gen) for frames | −15–25% of frame phase |
| **Net works/day** | Optimistic path moves from ~0.6–0.7 day → **~0.4–0.5 day**; still fragile for 1.0 work/day under stretch scope |

| If Architecture later allows portrait batch + scene gen (out of scope) | Throughput change could be large | Not estimated as authorized |

---

## Part 6 · Gap Analysis

### Target

> One operator can produce one complete work in one working day (≈8 hours focused).

### Verdict

| Scenario | Achievable today? | Notes |
| -------- | ----------------- | ----- |
| Lean showcase (8×1 portrait, 18 frames, Path B, assets ready) | **Marginally yes (~5 h)** | Requires prepared excerpts and available stills/uploads; little rework |
| Showcase budget (≤24 portrait variants, ≤20 frames, high taste bar) | **Unlikely in 8 h** | Portrait waits + retries dominate AI; frame sourcing dominates human |
| Path A fully manual text | **Harder** | Loses Discovery/Rollout leverage on captions/structure |
| “Complete” including polished art direction + 3 variants/character | **No** as routine daily cadence | Becomes multi-day per work |

### Bottlenecks preventing reliable 1 work / operator / day

1. **Scene frame images are 100% manual** and numerically the largest visual asset count (≈18–20), with **no** production AI path (A3).
2. **Portrait production is serial** in UI despite Local GPU being batch-capable in principle; warm P50 ≈35s creates idle time that cannot be overlapped inside Admin.
3. **Discovery → CRUD handoff** forces per-entity page round-trips; accepted Candidates are not Assets until a second Save.
4. **Navigation hub is `/works` table** — no in-work production cockpit; context switching tax scales with entity count.
5. **Taste retries** (portraits + frame selection) have unbounded tails; averages hide P95 days.
6. **Write-complete ≠ visually complete** — operators can “finish” Rollout with empty urls and still owe an entire upload phase (easy to underestimate).

**No solutions proposed** (constraint). These are gaps for Architect scope decisions on whether a Creator Production Pipeline (CPP) is required.

---

## Part 7 · Top Five Bottlenecks (ROI-ranked)

ROI = (expected time saved on critical path) / (estimated implementation complexity). Complexity is relative (S/M/L), not a commit plan.

| Rank | Bottleneck | Current cost | Expected benefit if removed | Impl. complexity |
| ---: | ---------- | ------------ | --------------------------- | ---------------- |
| 1 | **Manual scene-frame image fill after caption-only Rollout** | ~55–65 min/work (+ sourcing); blocks “visual complete” | Recovers largest human block; makes write-complete ≈ showcase-complete | **L** if AI gen; **M** if batch upload/library only |
| 2 | **Serial portrait generate/wait/retry per character** | ~32 min GPU wait + review tails; caps portraits/h | Aligns wall time with GPU capacity; cuts idle | **M–L** (product + policy; batch touches A3) |
| 3 | **Discovery Accept → separate form Save round-trip** | ~1–3 min × entity + navigation | Converts Accept into Assets faster; fewer lost prefill sessions | **M** |
| 4 | **No work-scoped production navigation / incomplete-asset queue** | ~20 min switching + hunting empty urls | Reduces coordination failure; exposes true remaining work | **S–M** |
| 5 | **Unbounded visual retry without draft/accept workflow for frames** | P95 blowups (hours) | Stabilizes day-level cadence predictability | **M** (process + UX); gen policy separate |

---

## Part 8 · AI Generation Time vs Human Operations Time

> **If the target is one work per operator per day, what percentage of total time is spent on AI generation, and what percentage on human operations?**

### 8.1 Method

For the lean Path B baseline wall-clock (~5.0 h ≈ 300 min):

| Category | Includes | Minutes | Share of wall-clock |
| -------- | -------- | ------: | ------------------: |
| **AI generation wait** | Portrait Local inference (~32 min) + Discovery Propose/Regen waits (~8 min) + minor Copilot waits (~2 min) | **~42** | **~14%** |
| **Human operations** | All active work: text prep, review, forms, uploads, navigation, decisions (includes time human spends *during* non-AI waiting if multitasking — counted as human if not blocked) | **~250** | **~83%** |
| **Non-AI system wait** | Cloudinary uploads, DB writes, evidence verify | **~8** | **~3%** |

**Blocked-on-AI vs active-human split of the operator day:**

| Split | Share |
| ----- | ----: |
| Time operator is **blocked on AI generation** | **~14%** |
| Time operator is in **human operations** (including manual uploads that are not AI) | **~86%** of remaining non-AI-wait ≈ **~83–86%** of day |

### 8.2 Critical finding

**AI image/LLM generation is not the majority of the day.** Roughly **one-seventh** of lean wall-clock is AI wait; roughly **five-sixths** is human operations — and the single largest human block is **non-AI scene frame uploading**, which Architecture currently keeps manual.

Implications for CPP scoping (evidence only):

* Optimizing only portrait model latency (35s → 15s) saves ~15–20 min/work (**~5–7%** of lean day) — helpful but not sufficient alone for reliable 1 work/day under stretch scope.
* Automating human operations around **frame acquisition, navigation, and Accept→persist** addresses the majority time mass.
* Portrait **batching** mainly converts the 14% AI wait from serial blocking into overlapped throughput; it does not remove the 83% human mass.

### 8.3 Stretch scenario (24 portrait variants)

If each of 8 characters takes 3 accept-quality variants (showcase budget ≤24):

| Category | Approx. share |
| -------- | ------------: |
| AI generation wait | **~30–40%** of a 8–10 h day |
| Human operations | **~55–65%** |
| Other system wait | **~5%** |

AI share rises with variant policy, but **human frame labor remains first-class**.

---

## Appendix A · Authority & file index

| Topic | Path |
| ----- | ---- |
| Image production scope | `docs/adr/010-image-runtime-and-policy.md` (A3) |
| Port / budget knobs | `docs/specs/spec-img-001-image-generation-port.md` |
| Local latency evidence | `docs/spikes/spike-img-002-local-image-generation.md` (warm P50 ≈ 35.5s) |
| Cloud cost evidence | `docs/spikes/spike-img-001-image-runtime-port.md` (~$0.03/accept observational) |
| Showcase entity counts | `docs/deployment/pd-showcase-recommendation-v1.md` |
| Write completion gate | `docs/specs/story-structure-exit-criteria.md` |
| Portrait action | `app/actions/generateCharacterAvatar.ts` |
| Frame persist (empty url) | `lib/rollout/reading-frame-persist.ts` |
| Deployment defaults | `docs/deployment/deployment-defaults.md` |

## Appendix B · Confidence

| Claim class | Confidence |
| ----------- | ---------- |
| Workflow topology / manual vs auto | **High** (code + specs) |
| Local portrait latency | **High** (Spike measured) |
| Discovery LLM latency | **Medium** (no dedicated Spike P50) |
| Operator manual minutes | **Medium** (structured estimate, not time-motion study) |
| Works/week extrapolation | **Low–Medium** (sensitive to taste retries & asset readiness) |

---

## Appendix C · One-line answer for Architect

**CPP is justified if the goal is reliable 1 work/operator/day:** today’s system can hit that only on a lean, well-prepared Path B day; the evidence shows **human operations (~83%) dominate AI wait (~14%)**, with **scene-frame fill** and **serial portrait UX** as the primary structural bottlenecks — not missing Reader publish infrastructure.
