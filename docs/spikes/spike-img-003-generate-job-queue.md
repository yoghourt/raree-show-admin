# SPIKE-IMG-003 — Generate Job Queue (Execution Envelope)

**Status:** Spike / Implementation Authorization **Granted** (scoped) · 2026-07-26  
**Production Authorization:** **Not** via ADR-010 amendment — this is Execution Runtime implementation, not an architectural decision  
**Contract Freeze:** ADR-010 · SPEC-IMG-001 · SPEC-CPP-001 (Job queue remains Forbidden as CPP Runtime; allowed here as Execution ops envelope)  
**Authority:** Architect Plan Review PASS (2026-07-26) · Execution Runtime slice 1  
**Depends on:** ADR-010 A4 (Candidate ≠ Asset; Job ≠ CPP Progress) · Capability `image.generate` · SPIKE-AA-001 Media Admission  
**Last Updated:** 2026-07-26

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
| `lib/generate-jobs.ts` | Enqueue / list helpers |
| `app/actions/enqueueFrameDraftJobs.ts` | Admin enqueue Server Action |
| `components/production/BatchFrameCompletion.tsx` | Queue UI + job list |
| `docs/spikes/spike-img-003-*.md` | This authorization + Findings |
| `scripts/README-local-image-server.md` | Point to Worker slice 2 |

---

## Denylist (MUST NOT)

* ADR-010 / Architecture amendments claiming queue as Runtime Truth  
* Storing `candidate_url` (or Candidate objects) on the job row  
* Auto Accept / writing `story_images_v2` / `portrait_url` from enqueue or job success  
* CPP board treating Job success as Plan complete  
* Expanding sync `generateFrameDraft` / MultiImageUploader sync path with new product features  
* Local Worker daemon (slice 2) · Accept-from-job UI (slice 3) in this Spike’s Exit  

---

## How (slice 1)

1. Apply `generate_jobs` migration.  
2. Enqueue from Production batch UI with `capability_id=image.generate`, `subject_type=scene`, `input_json` carrying frame caption / index.  
3. List recent jobs; leave `result_reference` null until Worker.  
4. Record Findings below after operator smoke.

---

## Exit Criteria

| ID | Criterion | Slice 1 |
| -- | --------- | ------- |
| EC-1 | Enqueue writes `queued` row without calling `imageGenerate` | Required |
| EC-2 | No Asset write on enqueue | Required |
| EC-3 | Job list visible for work | Required |
| EC-4 | Sync generate path still works (compat) | Required |
| EC-5 | Worker poll → `result_reference` | **Slice 2** |
| EC-6 | Accept UI consumes result → Candidate → Asset | **Slice 3** |

---

## Findings

_(Fill after smoke.)_

| Date | Note |
| ---- | ---- |
| | |
