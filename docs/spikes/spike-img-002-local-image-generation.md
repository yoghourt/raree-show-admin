# SPIKE-IMG-002 — Local Image Generation (Optional Deployment Adapter)

**Status:** Spike Implementation **Authorized** · Desk Findings **Partial** · Hardware Benchmarks **Operator-run within timebox**  
**Production Authorization:** **Not Authorized** (cloud remains Production Default)  
**Contract Freeze:** ADR-010 · SPEC-IMG-001 (Accepted)  
**Authority:** Architect · ROI Decision Package v1 · `POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC` §6  
**Timebox:** 3–5 person-days  
**Last Updated:** 2026-07-19

---

## What

Authorize an **isolated** Spike that evaluates whether **local** image generation on developer hardware (target: Apple Silicon M2 Pro, 16GB) can become an **optional** Image Runtime Deployment adapter.

Artifacts in scope:

| Artifact | Purpose |
| -------- | ------- |
| This Findings Report | Conditions under which local is preferable |
| Prototype Port adapter `local` | Optional Deployment binding only |
| Break-even analysis | Scale / cost / maintenance thresholds |
| Spike runner | Dry-run + optional local HTTP endpoint bench |

This Spike **does not** replace the cloud Production Default established by SPIKE-IMG-001.

---

## Why

Cloud accept is already inexpensive (~$0.03/image observational, SPIKE-IMG-001). The decision question is **not** unit-cost superiority today, but:

> Under what conditions should Raree Show switch from cloud generation to local generation?

Personal portfolio ROI may justify a bounded Spike as capability investment; commercial / reliable-demo ROI keeps cloud as default until break-even conditions are met.

---

## Authorization states (do not collapse)

| State | This Spike |
| ----- | ---------- |
| Contract Freeze | Already granted via ADR-010 / SPEC-IMG-001 |
| **Spike Implementation Authorization** | **GRANTED** by this document + ROI Decision Package v1 |
| Production Authorization (local as default) | **NOT GRANTED** |

---

## Goal

Produce verifiable evidence on five success criteria and a **switch-condition** recommendation:

1. Image Quality  
2. Throughput  
3. Engineering Complexity  
4. Break-even Scale  
5. Long-term Maintenance Cost  

---

## Allowlist (MAY implement)

| Path / artifact | Purpose |
| --------------- | ------- |
| `lib/ai/image/**` | Prototype `local` adapter + factory wiring |
| `scripts/spike-img-002-*.ts` | Bench / break-even runners |
| `docs/spikes/spike-img-002-*.md` | Authorization + Findings |
| Local spike output dirs (gitignored) | Images / `report.json` |
| Temporary `IMAGE_SPIKE_*` env | Spike-only config |

## Denylist (MUST NOT modify)

Same as SPIKE-IMG-001 denylist, including:

* Production avatar / Rollout / Discovery / Copilot paths  
* Database schema / migrations  
* Elevating local to Production Default without new Architecture Review  

---

## How (methodology)

### Phase 0 — Desk model (this document)

Freeze cloud baseline, fixed-cost model, and break-even formulas **before** hardware runs so later numbers only fill measured cells.

### Phase 1 — Prototype adapter

Implement Port-compatible `local` provider that:

* Supports `IMAGE_SPIKE_SKIP_NETWORK=1` dry-run (architecture only)  
* Optionally calls a **local HTTP** image endpoint (`IMAGE_SPIKE_LOCAL_BASE`) — ComfyUI / Diffusers-serve / OpenAI-compatible — so weights/runtime stay outside the Next.js process  

Preferred stack for later operator runs (not frozen): **Diffusers + MPS** or **MLX**; ComfyUI for manual tuning only.

### Phase 2 — Hardware benchmarks (operator, within timebox)

On M2 Pro 16GB, measure against a fixed prompt pack (reuse SPIKE-IMG-001 character prompts where possible):

| Metric | Method |
| ------ | ------ |
| Quality | Side-by-side vs SiliconFlow Kontext accept; identity / prompt / quality 1–5 |
| Throughput | Cold + warm P50/P95 for N≥10 images; note thermal drop after batch |
| Peak memory | Process + system pressure; fail if unstable under concurrent Admin/dev |

Models to try **in order**: SDXL (or Lightning) → FLUX.1-schnell quantized → FLUX.1-dev only if memory allows.

### Phase 3 — Switch-condition table

Fill Recommendation with explicit predicates (scale, cloud price, quality parity, maintenance budget).

---

## Success Criteria (normative for this Spike)

| # | Criterion | Pass condition for Spike Success |
| - | --------- | -------------------------------- |
| EC-1 | Quality protocol | Rubric + prompt pack documented; scores filled **or** explicitly deferred with blocker |
| EC-2 | Throughput protocol | P50/P95 + thermal note filled **or** deferred with blocker |
| EC-3 | Engineering complexity | Person-day estimate for adapter + local runtime documented |
| EC-4 | Break-even scale | \(N^*\) images / Works tabulated under stated assumptions |
| EC-5 | Maintenance cost | Monthly person-day ceiling + failure modes listed |
| EC-6 | Production isolation | Diff touches allowlist only; cloud remains Deployment default |
| EC-7 | Question answered | Findings answer **switch conditions**, not “local is better” |

Spike may **Succeed with Partial Hardware Data** if EC-3…EC-7 are complete and EC-1/EC-2 record a clear operator checklist (timebox honesty). Elevating local to Production Default still requires a **new** grant.

---

## Validation

### Desk / plumbing (repo)

```bash
IMAGE_SPIKE_ACCEPT_PROVIDER=local \
IMAGE_SPIKE_SKIP_NETWORK=1 \
  npx tsx scripts/spike-img-002-local-breakeven.ts
```

Executed 2026-07-19: dry-run **PASS** — `local` provider resolves; break-even rows written to `spike-output/spike-img-002/report.json` (gitignored).

### Optional local endpoint bench (operator)

```bash
# Start your local OpenAI-compatible or simple POST /generate that returns image bytes.
IMAGE_SPIKE_ACCEPT_PROVIDER=local \
IMAGE_SPIKE_LOCAL_BASE=http://127.0.0.1:8191 \
IMAGE_SPIKE_ACCEPT_MODEL=sdxl \
IMAGE_SPIKE_SKIP_NETWORK=0 \
  npx tsx scripts/spike-img-002-local-breakeven.ts --bench
```

Evidence paths (gitignored):

* `spike-output/spike-img-002/report.json`  
* `spike-output/spike-img-002/images/` (bench only)

---

## Refs

* Governance: `governance/specs/POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC.md` §6  
* ADR: `docs/adr/010-image-runtime-and-policy.md`  
* SPEC: `docs/specs/spec-img-001-image-generation-port.md`  
* Prior spike: `docs/spikes/spike-img-001-image-runtime-port.md`  
* Deployment: `docs/deployment/deployment-defaults.md`  
* Authority: ROI Decision Package v1 (Architect, 2026-07-19)

---

## Findings

> **Status:** Analytical + prototype **complete** (2026-07-19).  
> Hardware quality/throughput cells: **awaiting operator bench within timebox**.  
> Production Authorization for local default: **NOT GRANTED**.

### Cloud baseline (from SPIKE-IMG-001)

| Item | Value |
| ---- | ----- |
| Accept provider (evidence) | SiliconFlow `FLUX.1-Kontext-dev` |
| Observational accept unit cost \(c\) | **~$0.03 / image** |
| Draft | Pollinations free-tier (~$0) |
| Portrait consistency | EC-3 PASS (18/18 ≥4/5 identity) |

### EC-3 — Engineering complexity (estimated)

| Work item | Person-days | Notes |
| --------- | -----------:| ----- |
| Port `local` adapter + factory + dry-run | 0.5–1 | Done in this change set (scaffold) |
| Local runtime bring-up (Diffusers/MLX or Comfy HTTP) | 1–2 | Outside Node; weights download + MPS quirks |
| Quality pack + scoring vs cloud | 0.5–1 | Reuse IMG-001 prompts |
| Break-even + Findings write-up | 0.5 | This report |
| **Total in timebox** | **3–5** | Stop at Findings; no production wiring |

### EC-4 — Break-even scale (desk model)

Assumptions (replaceable; encoded in `scripts/spike-img-002-local-breakeven.ts`):

| Parameter | Baseline |
| --------- | -------- |
| Cloud accept unit cost \(c\) | $0.03 |
| Billable images / Work \(n\) | 80 |
| Local marginal $ / image | ≈ $0 |
| Loaded eng rate (commercial lens) | $600 / person-day |
| Hardware allocation | $800 / 3y ≈ $267/y (optional; set 0 if sunk) |

Fixed cost \(F\) over a **2-year** window:

| Scenario | Meaning | \(F\) (approx.) | \(N^* = F/c\) images | Works @ \(n=80\) |
| -------- | ------- | --------------:| --------------------:| ----------------:|
| A | Research Spike only | ~$2,900 | ~97k | ~1,200 |
| B | Optional Deployment adapter + light ops | ~$10,100 | ~337k | ~4,200 |
| C | Local as primary accept path | ~$19,700 | ~657k | ~8,200 |

**Personal portfolio ROI lens:** engineering days are capability investment; Scenario A Spike can be justified for learning/evidence even when \(N^*\) is far above near-term volume. That **does not** move Production Default.

**Commercial / reliable-demo lens:** prefer cloud until measured volume or cloud price approaches Scenario B/C thresholds **and** quality/throughput parity holds.

Sensitivity:

* If \(c\) rises to $0.10 → Scenario B ≈ 1,260 Works.  
* If \(n\) = 300 → Scenario B ≈ 1,100 Works.  
* Opportunity cost of eng time (not in \(F\)) **raises** \(N^*\).

### EC-5 — Long-term maintenance

| Item | Estimate | Notes |
| ---- | -------- | ----- |
| Steady-state ops | 0.25 person-day / month | Deps, OS/MPS breaks, model pins |
| Failure modes | Endpoint down, OOM, thermal stall, style drift vs cloud accept | Demo reliability risk |
| Monthly ceiling (suggested) | ≤ 0.5 person-day | Else keep cloud-only |

### EC-1 / EC-2 — Quality & throughput

| Cell | Status | Notes |
| ---- | ------ | ----- |
| Image quality vs Kontext | **Pending operator bench** | Do not invent scores |
| Throughput P50/P95 | **Pending operator bench** | Record cold/warm + thermal |
| Reference / identity | **High risk on 16GB** | May lack Kontext-class reference; score with and without |

Operator checklist (copy into `report.json` when done):

1. Model id + quantization  
2. Resolution  
3. N images, cold/warm latency  
4. Peak memory  
5. Blind or rubric scores vs cloud canonicals  
6. Whether `referenceImages` worked  

### EC-6 — Production isolation

Prototype confined to `lib/ai/image/**` + `scripts/spike-img-002-*.ts` + this doc. Deployment Defaults continue to list **cloud** draft/accept.

### EC-7 — Switch conditions (answer to the Spike question)

**Prefer / enable local as optional accept when ALL hold:**

1. **Scale or price:** cumulative accept images ≳ Scenario B \(N^*\) **or** cloud accept \(c\) rises enough that recomputed \(N^*\) ≤ planned lifetime volume.  
2. **Quality floor:** measured identity/prompt/quality not materially below cloud accept for the showcase pack (document threshold, e.g. mean identity ≥ 4/5 on same rubric).  
3. **Throughput floor:** warm P50 acceptable for authoring UX (suggest ≤ 30s @ showcase resolution on target hardware) without blocking demo reliability.  
4. **Ops budget:** maintenance ≤ agreed monthly ceiling.  
5. **Explicit Deployment switch:** config-only; no Architecture change required beyond adapter registration — but **default** flip needs Architecture Review.

**Otherwise:** keep cloud Production Default; retain local as Research / optional adapter only.

---

## Risks

1. 16GB unified memory + Admin/dev contention → OOM before model “fits on paper”.  
2. Local reference consistency may fail EC-style identity bar that Kontext already passed.  
3. Comfy-first workflows resist Port automation — prefer HTTP + Diffusers/MLX.  
4. Scope creep into “productionize local” — **out of authorization**.

---

## Recommendation

- [x] **Continue Research (bounded)** — complete operator hardware benches inside timebox; keep cloud default  
- [ ] **Optional Deployment binding** — only after EC-1/EC-2 filled **and** switch conditions approaching  
- [ ] **Production Default → local** — **Not recommended**; requires new Architecture Review  

**Why:** Break-even and maintenance analysis already show local is a **high-scale / high-cloud-price / offline** option. Portfolio ROI justifies finishing the Spike evidence pack; it does not justify changing Production Default now.

Decision owner / date: Architect authorization 2026-07-19 · Desk Findings 2026-07-19  
**Production Authorization (local default):** still **NOT GRANTED**
