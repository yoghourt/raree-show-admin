# Completing Renderer Model Qualification Spike

## Status (updated 2026-08-01)

| Arm | Status | Notes |
| --- | ------ | ----- |
| baseline `sd-3.5-medium-ggml` | ✅ 3/3 | Done |
| candidate-a `sdxl-turbo` | ✅ 3/3 | Diffusers `:8191` |
| candidate-b `flux.2-klein-4b` | ❌ 0/3 | Weights on disk; LocalAI backend EOF — **needs your cold restart** |
| candidate-c `dreamshaper` | ✅ 3/3 | Gallery install completed (~2GB); ran OK |

Full write-up: `docs/findings/renderer-model-qualification-spike.md`

---

## Only remaining assist: FLUX cold restart

Weights already present under `~/.localai/models/stablediffusion-cpp/models/`.

1. **Quit LocalAI completely** (menu bar / Launcher → Quit).  
2. Reopen LocalAI; wait until `curl -s http://127.0.0.1:8080/v1/models` works.  
3. Run **only** FLUX (do not generate with sd-3.5 first):
   ```bash
   cd /Users/yuefuchen/Documents/GitHub/raree-show-admin
   SPIKE_MODEL_IDS=candidate-b npx tsx scripts/renderer-model-qualification-spike/run.ts
   ```
4. Reply with terminal output / LocalAI log if still EOF.

DreamShaper is already installed — no further action needed for Candidate C.

---

## You can help — two installs / fixes

### 1) Candidate C — install DreamShaper (required for complete matrix)

**Option A — LocalAI WebUI (preferred)**

1. Open [http://127.0.0.1:8080](http://127.0.0.1:8080)
2. **Models** → search `dreamshaper`
3. **Install** and wait until `curl -s http://127.0.0.1:8080/v1/models` lists `"id":"dreamshaper"`
4. Tell the agent (or run yourself):
   ```bash
   SPIKE_MODEL_IDS=candidate-c SPIKE_SKIP_EXISTING=1 \
     npx tsx scripts/renderer-model-qualification-spike/run.ts
   ```

**Option B — LocalAI API**

```bash
# Gallery id (if present in your LocalAI build):
curl -sS http://127.0.0.1:8080/models/apply \
  -H "Content-Type: application/json" \
  -d '{"id":"dreamshaper"}'

# Or YAML from LocalAI gallery:
curl -sS http://127.0.0.1:8080/models/apply \
  -H "Content-Type: application/json" \
  -d '{"url":"github:mudler/LocalAI/gallery/dreamshaper.yaml@master"}'
```

Poll until job finishes, then confirm:

```bash
curl -sS http://127.0.0.1:8080/v1/models | python3 -m json.tool
```

Disk: DreamShaper SD1.5 pruned ~2GB; XL variants larger.

---

### 2) Candidate B — FLUX.2 Klein already downloaded, backend unstable

Files present under `~/.localai/models/stablediffusion-cpp/models/`:

- `flux-2-klein-4b-Q4_0.gguf` (~2.3G)
- `flux2-vae.safetensors`
- `Qwen3-4B-Q4_K_M.gguf`

Failure mode: `rpc error … EOF` / connection refused after first call — typically **backend crash / OOM when switching from sd-3.5**.

**Please:**

1. **Fully quit & restart LocalAI** (Launcher → quit → open again).
2. **Do not** run baseline in the same session first.
3. Run FLUX only:
   ```bash
   SPIKE_MODEL_IDS=candidate-b \
     npx tsx scripts/renderer-model-qualification-spike/run.ts
   ```
4. If still EOF: open LocalAI logs; note Metal / VRAM errors. Optional: temporarily **unload** `sd-3.5-medium-ggml` from LocalAI UI so only FLUX is loaded.

---

### 3) Keep Candidate A path alive

```bash
cd scripts && source .venv/bin/activate
python -m uvicorn local_portrait_server:app --host 127.0.0.1 --port 8191
```

Check: `curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8191/docs` → `200`

---

## Re-run full matrix (after C installed + B fixed)

```bash
# From repo root; 8191 + LocalAI up
npx tsx scripts/renderer-model-qualification-spike/run.ts
```

Uses **fixed Expressions** from `fixtures.json` (unchanged).  
Findings will be rewritten under `docs/findings/renderer-model-qualification-spike.md`.

---

## What we already have (no reinstall)

- baseline + sdxl-turbo PNGs under `scripts/renderer-model-qualification-spike/results/`
- Partial conclusion: SDXL reduces blanks; relationship/vertical still weak; FLUX not feasible yet
