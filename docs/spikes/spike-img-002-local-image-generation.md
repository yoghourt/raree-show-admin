# SPIKE-IMG-002 — Local Image Generation (Optional Deployment Adapter)

**Status:** Spike Implementation **Authorized** · Desk + hardware + vs-Production pairwise **Recorded** (2026-07-20)  
**Production Authorization:** **Granted (scoped)** — ADR-010 **A3** · Constraint F sets Creator Deployment Default = **Local** with Cloud fallback (not Architecture freeze)  
**Contract Freeze:** ADR-010 · SPEC-IMG-001 (Accepted)  
**Authority:** Architect · ROI Decision Package v1 · `POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC` §6  
**Timebox:** 3–5 person-days  
**Last Updated:** 2026-07-20

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
| Production Authorization (Creator Local Deployment Default) | **GRANTED** via ADR-010 **A3 Constraint F** (Deployment only; Cloud fallback required) |

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

### Replay Production cases on local only (no cloud re-run)

Same C1–C3 prompts/seeds as SPIKE-IMG-001; left side uses existing
`spike-output/spike-img-001/**` (cloud not re-run).

```bash
cd /Users/yuefuchen/Documents/GitHub/raree-show-admin

IMAGE_SPIKE_ACCEPT_PROVIDER=local \
IMAGE_SPIKE_LOCAL_BASE=http://127.0.0.1:8191 \
IMAGE_SPIKE_ACCEPT_MODEL=sdxl-turbo \
IMAGE_SPIKE_SKIP_NETWORK=0 \
IMAGE_SPIKE_REPLAY_SIZE=512 \
  npx tsx scripts/spike-img-002-replay-production-cases.ts
```

Open: `spike-output/spike-img-002/vs-production/compare.html`

Evidence paths (gitignored):

* `spike-output/spike-img-002/report.json`  
* `spike-output/spike-img-002/images/` (bench only)
* `spike-output/spike-img-002/vs-production/` (replay + compare.html)

---

## Refs

* Governance: `governance/specs/POLICY_RUNTIME_DEPLOYMENT_LAYER_SPEC.md` §6  
* ADR: `docs/adr/010-image-runtime-and-policy.md`  
* SPEC: `docs/specs/spec-img-001-image-generation-port.md`  
* Prior spike: `docs/spikes/spike-img-001-image-runtime-port.md`  
* Deployment: `config/infra/deployment-defaults.md`  
* Authority: ROI Decision Package v1 (Architect, 2026-07-19)

---

## Findings

> **Status:** Analytical + prototype **complete**; hardware bench + vs-Production replay **recorded** (2026-07-20).  
> Operator pairwise preference (showcase-relevant dimensions): **local preferred**.  
> Architect later granted Creator Local as **Deployment Default** under ADR-010 **A3 Constraint F** (2026-07-20), with Cloud fallback; Architecture remains unfrozen.

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
| Quality pack + scoring vs cloud | 0.5–1 | Replay script + operator pairwise compare |
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

### EC-1 / EC-2 — Quality & throughput (operator evidence 2026-07-20)

**Hardware / bench**

| Item | Observed |
| ---- | -------- |
| Machine | MacBook Pro M2 Pro, 16GB |
| Local stack | Diffusers `sdxl-turbo` via `scripts/local_portrait_server.py` + Port `local` |
| Throughput (`--bench`, n=10, ~768) | Cold ≈ **55s**; Warm **P50 ≈ 35.5s**; **P95 ≈ 44.5s** |
| Replay | `scripts/spike-img-002-replay-production-cases.ts` → `vs-production/compare.html` (same IMG-001 prompts/seeds; size 512) |
| Reference | `referenceImages` passed to adapter; **server ignores `reference_url`** (text-only local path) |

**Pairwise vs Production (operator, showcase-weighted)**

Evidence UI: `spike-output/spike-img-002/vs-production/compare.html`  
Production side: existing SPIKE-IMG-001 SiliconFlow Kontext (+ reference). Local side: replay only (no cloud re-run).

| Dimension | Winner | Operator note |
| --------- | ------ | ------------- |
| Expression / pose vs prompt | **Production** | Better match to expression & facing cues |
| Fine detail / “photoreal” finish | **Production** | More refined; also stronger “AI photoreal” look |
| Background color vs prompt | **Local** | Better background adherence |
| Cross-image identity consistency | **Local** | Stronger same-character feel across variants (despite no local reference impl) |
| Character look (style preference) | **Tie** | Production more lifelike but AI-photoreal; local more illustration-like (preferred for product tone by operator) |
| **Overall (operator priorities)** | **Local** | Weighted toward consistency + illustration tone over photoreal detail |

**Interpretation:** On **portfolio / showcase taste + cross-variant consistency**, local can beat current cloud accept for this pack. That satisfies a **quality-preference** reading of EC-1 for optional local use. It does **not** by itself satisfy switch-condition #3 (throughput: warm P50 ≈ 35s &gt; ~30s UX hint) or Architecture authorization to flip Production Default.

### EC-6 — Production isolation

Prototype confined to `lib/ai/image/**` + `scripts/spike-img-002-*.ts` + `scripts/local_portrait_server.py` + this doc. Deployment Defaults continue to list **cloud** draft/accept.

### EC-7 — Switch conditions (answer to the Spike question)

**Prefer / enable local as optional accept when ALL hold:**

1. **Scale or price:** cumulative accept images ≳ Scenario B \(N^*\) **or** cloud accept \(c\) rises enough that recomputed \(N^*\) ≤ planned lifetime volume.  
2. **Quality floor:** measured identity/prompt/quality not materially below cloud accept for the showcase pack — **operator pairwise (2026-07-20): local preferred on weighted dimensions** (see EC-1).  
3. **Throughput floor:** warm P50 acceptable for authoring UX (suggest ≤ 30s @ showcase resolution on target hardware) — **not met** (≈ 35.5s P50 on sdxl-turbo bench).  
4. **Ops budget:** maintenance ≤ agreed monthly ceiling.  
5. **Explicit Deployment switch:** config-only; no Architecture change required beyond adapter registration — but **default** flip needs Architecture Review.

**Updated answer:** Local is a **credible optional / research accept** for illustration-led showcase when the operator accepts ~35s/image and self-hosted ops. **Keep cloud as Production Default** until throughput improves **and** Architect grants a default flip. Quality preference alone is not a full switch.

---

## Risks

1. 16GB unified memory + Admin/dev contention → OOM before model “fits on paper”.  
2. Local `reference_url` still unimplemented — today’s consistency win is **style/prompt luck**, not Kontext-class reference locking; may not hold on harder packs.  
3. Comfy-first workflows resist Port automation — prefer HTTP + Diffusers/MLX.  
4. Scope creep into “productionize local” — **out of authorization**.  
5. Operator “local wins” on taste ≠ license to change Deployment Default without Review.

---

## Recommendation

- [x] **Continue Research (bounded)** — evidence pack complete for timebox  
- [x] **Optional local accept (research / offline / illustration-led Creator batches)** — justified by operator pairwise preference on consistency + illustration tone  
- [x] **Architecture Alignment (2026-07-20)** — Creator Runtime ⊥ Reader Runtime frozen in ADR-010 **A2**; provider choice remains Deployment  
- [x] **Creator Local as Deployment Default** — **Granted** via ADR-010 **A3 Constraint F** (Deployment only; Cloud fallback required; MUST NOT freeze `Creator = Local` in Architecture)  
- [ ] **Reader / global Production Default → local** — **Rejected**; Reader MUST NOT depend on author-local generation  

**Why:** Operator comparison shows local can **win on Creator-weighted quality** for this pack. Architecture separates surfaces so that verdict informs **Creator Deployment**, not a single global Production Default. Throughput (~35s) is acceptable for Creator batch; Cloud fallback and unified published assets remain required. A3 authorizes scoped production wiring + Local Default; implementation follows SPEC-IMG-001 §9a.

Decision owner / date: Architect authorization 2026-07-19 · Operator compare 2026-07-20 · Architecture Alignment A2 2026-07-20 · Production A3 2026-07-20  
**Production Authorization (Creator Local Deployment Default):** **GRANTED** — ADR-010 A3 Constraint F  
**Architecture (Creator ⊥ Reader):** **FROZEN** (ADR-010 / A2); Local remains Deployment-only
