# SPIKE-IMG-003 — Generate Job Queue (Execution Envelope)

**Status:** Spike / Implementation Authorization **Granted** (scoped) · Slices 1–3 · **CPP-C portrait** · 2026-07-26 / 2026-07-27 / 2026-07-29  
**Production Authorization:** **Not** via ADR-010 amendment — this is Execution Runtime implementation, not an architectural decision  
**Contract Freeze:** ADR-010 · SPEC-IMG-001 · SPEC-CPP-001 (Job queue remains Forbidden as CPP Runtime; allowed here as Execution ops envelope)  
**Authority:** Architect Plan Review PASS (2026-07-26) · Execution Runtime slices 1–3 · CPP-C portrait enqueue  
**Depends on:** ADR-010 A4 (Candidate ≠ Asset; Job ≠ CPP Progress) · Capability `image.generate` · SPIKE-AA-001 Media Admission  
**Last Updated:** 2026-07-29 (CPP-C character portrait jobs)

---

## What

Authorize a **minimal Generate Job queue** as an **Execution Runtime** handoff envelope so Admin can enqueue work and a future Local Worker (slice 2) can poll → `imageGenerate` → write an opaque `result_reference`.

This is **not**:

* a CPP workflow engine  
* durable Candidate authority  
* an Architecture / ADR-010 A5 decision  

---

## Why

Synchronous Admin → LocalAI blocks the operator and cannot run on Vercel against `127.0.0.1`. Pull-based Local Worker needs a durable **job envelope** (queued → running → succeeded/failed) without elevating Job into Product Runtime Truth.

---

## Authorization states (do not collapse)

| State | This Spike |
| ----- | ---------- |
| Contract Freeze | ADR-010 / SPEC-IMG-001 / SPEC-CPP-001 unchanged |
| **Spike / Implementation Authorization** | **GRANTED** by this document (scoped) |
| ADR amendment | **Not required** — Execution implementation only |
| CPP Progress from Job | **Denied** |

---

## Goal

1. Persist generic job rows (`generate_jobs`)  
2. Admin can enqueue scene-frame generate intents (`status=queued`)  
3. List jobs by work for operator visibility  
4. **Do not** run Worker, create Candidates in-table, or write Assets  

---

## Invariants (mandatory)

* **Job ≠ Candidate ≠ Asset**  
* `result_reference` = opaque Execution result pointer only; Candidate semantics remain in Capability / Media Admission  
* Job / result success **MUST NOT** advance CPP Progress  
* Envelope stays **capability-generic** (`capability_id` + `input_json`); no capability-specific column sprawl  
* Existing synchronous `generateFrameDraft` / edit-page AI generate = **migration compatibility only** — no new features on that path  

---

## Allowlist (MAY implement)

| Path / artifact | Purpose |
| --------------- | ------- |
| `docs/supabase/migrations/*generate_jobs*` | Table DDL (hand-run SQL editor) |
| `lib/generate-jobs/**` | Enqueue / claim / complete / execute helpers |
| `lib/supabase-service.ts` | Worker-only service role client |
| `app/actions/enqueueFrameDraftJobs.ts` | Admin scene-frame enqueue Server Action |
| `app/actions/enqueueCharacterPortraitJobs.ts` | Admin character portrait enqueue (CPP-C) |
| `components/production/BatchFrameCompletion.tsx` | Scene-frame queue UI + job list / preview |
| `components/production/BatchPortraitCompletion.tsx` | Character portrait queue UI + Accept (CPP-C) |
| `components/characters/CharacterForm.tsx` | Portrait enqueue / Accept-to-form (CPP-C) |
| `scripts/local-generate-worker.ts` | Local Worker (slice 2 + CPP-C) |
| `docs/spikes/spike-img-003-*.md` | This authorization + Findings |
| `scripts/README-local-image-server.md` | Operator steps |

---

## Denylist (MUST NOT)

* ADR-010 / Architecture amendments claiming queue as Runtime Truth  
* Storing `candidate_url` (or Candidate objects) on the job row  
* Auto Accept / writing `story_images_v2` / `portrait_url` from enqueue, Worker, or job success alone  
* CPP board treating Job success as Plan complete  
* Expanding sync `generateFrameDraft` / MultiImageUploader sync path with new product features  
* Expanding sync `generateCharacterAvatar` beyond migration-compat  
* New Accept-only CPP board / route (slice 3 stays on BatchFrameCompletion; CPP-C Accept on BatchPortraitCompletion / CharacterForm)

---

## How (slice 1)

1. Apply `generate_jobs` migration.  
2. Enqueue from Production batch UI with `capability_id=image.generate`, `subject_type=scene`, `input_json` carrying frame caption / index.  
3. List recent jobs; leave `result_reference` null until Worker.  
4. Record Findings below after operator smoke.

## How (slice 2)

1. Worker uses `SUPABASE_SERVICE_ROLE_KEY` (scripts only).  
2. `claimNextQueuedJob` → `executeImageGenerateJob` → Cloudinary → `completeGenerateJob` with opaque `result_reference` JSON.  
3. Admin refreshes job list; optional hosted URL preview (Execution pointer ≠ Candidate).  
4. No Asset write.

---

## How (slice 3)

1. Admin admits `succeeded` job `result_reference.url` into ephemeral Candidate (PendingFill).  
2. Human Accept via existing「写入作品」(`patchSceneFrameUrls`) or one-shot「Accept 并写入」。  
3. Do **not** mutate Job status for Accept (Execution envelope ≠ Product Accept).  
4. Re-queue creates a new job; old succeeded retained as history.

---

## How (CPP-C — character portrait)

1. Enqueue `subject_type=character`, `subject_id=char_*`, `input_json.asset_slot=portrait` (+ name / description / optional reference_url).  
2. Worker parses portrait input → `imageGenerate({ assetSlot: "portrait" })` → Cloudinary → `result_reference`.  
3. Human Accept: CharacterForm「Accept 到表单」+ Save, or Production `BatchPortraitCompletion`「Accept 并写入肖像」(`characters.update`).  
4. Sync `generateCharacterAvatar` remains migration-compat only.  
5. In-flight dedupe: refuse second `queued`/`running` for same character.

---

## Exit Criteria

| ID | Criterion | Status |
| -- | --------- | ------ |
| EC-1 | Enqueue writes `queued` row without calling `imageGenerate` | Slice 1 Done |
| EC-2 | No Asset write on enqueue | Slice 1 Done |
| EC-3 | Job list visible for work | Slice 1 Done |
| EC-4 | Sync generate path still works (compat) | Slice 1 Done |
| EC-5 | Worker poll → `result_reference` | Slice 2 Done |
| EC-6 | Accept UI consumes result → Candidate → Asset | **Slice 3 Implemented** |
| EC-7 | Character portrait enqueue + Worker + Human Accept → `portrait_url` | **CPP-C Implemented** |

---

## Findings

| Date | Note |
| ---- | ---- |
| 2026-07-27 | Slice 2 implemented: `scripts/local-generate-worker.ts`, claim/complete/fail, `result_reference` = hosted_image JSON. Operator smoke: enqueue → worker drain → Admin refresh preview; Assets unchanged. |
| 2026-07-27 | Slice 3: BatchFrameCompletion admit-from-job / accept-and-write / requeue; Job table status unchanged on Accept; EC-6 closed. |
| 2026-07-29 | CPP-C: `CharacterPortraitJobInput`, `enqueueCharacterPortraitJobs`, Worker `subject_type=character`, CharacterForm queue/Accept-to-form, BatchPortraitCompletion Accept→portrait_url; sync avatar = migration-compat; EC-7 closed. |
