# Renderer Capability Defaults — Deployment only

**Status:** Current recommendations (replaceable)  
**Last Updated:** 2026-09-03  
**Path:** `config/infra/renderer-capability-defaults.md`  
**Layer:** **Deployment only**  
**Code:** `lib/ai/image/rendererCapability.ts`

> Prompt and pixel budgets are **model-keyed Deployment knobs**. They are not
> Architecture / Runtime constants. Canonical Visual Expression MUST persist
> full (ADR-011 A5). Length clip happens at **execute** via Execution Projection.

## Official evidence (Z-Image-Turbo)

Sources: [Tongyi-MAI prompting guide](https://huggingface.co/Tongyi-MAI/Z-Image-Turbo/discussions/8) (pinned), [Diffusers ZImagePipeline](https://huggingface.co/docs/diffusers/en/api/pipelines/z_image), [Alibaba Cloud Z-Image API](https://www.alibabacloud.com/help/en/model-studio/z-image-api-reference).

| Fact | Official | Not this |
| ---- | -------- | -------- |
| Default `max_sequence_length` | **512 tokens** (online demo / typical pipeline) | 800 Latin characters |
| Local pipeline option | **1024 tokens** | Architecture ceiling |
| Latin char estimate | ~4 chars/token → 512 ≈ **2000**, 1024 ≈ **4000** | Word-count folklore |
| Style | Turbo likes **long, specific** prompts | sd-3.5 “over 600 blanks” |
| Native / example size | **1024×1024** (API 512–2048, recommend 1024–1536) | 512² as model limit |
| Negative / CFG | Turbo **does not use CFG**; negatives are inert | Expecting negative to fix camouflage |

Chars in the table below are a **Latin conservative estimate** of the token window (512 × 4 × 0.9 = **1800**), not an Architecture number.

## This-host check (2026-09-03)

Probe: `npx tsx scripts/probe-z-image-prompt-budget.ts`

| Check | Result |
| ----- | ------ |
| LocalAI | `http://127.0.0.1:8080` reachable; `/v1/models` lists `Z-Image-Turbo` |
| Host YAML | `~/.localai/models/Z-Image-Turbo.yaml` — `backend: stablediffusion-ggml`, `llm_path: Qwen3-4B.Q4_K_M.gguf` |
| `context_size` / `max_sequence_length` in YAML | **unset** |
| LocalAI default `context_size` | **512** tokens when unset |
| Live image truncation A/B (800 / 1500 / 2500 chars) | **Not run** — Local CPU generate is too slow for a budget probe. Token window taken from official default + unset host YAML. |

**Table choice:** `promptBodyMaxChars = 1800` (conservative 512-token Latin). Do **not** use 800 as a Z-Image ceiling. 800 was “portrait can render,” not the model window.

**Size:** execute still uses **512²** as a CPU / draft knob (`IMAGE_CREATOR_LOCALAI_MAX_EDGE` may clamp further). That is a throughput choice, **not** the Z-Image native ceiling.

## Model rows (execute join)

| `modelId` / family | `promptBodyMaxChars` | visual / action | size | `negativePromptEffective` |
| ------------------ | -------------------- | --------------- | ---- | ------------------------- |
| `Z-Image-Turbo` (Creator Local Default, RSD-002) | 1800 | 400 / 480 | 512² (CPU knob) | **false** |
| `sd-3.5-medium-ggml` (rollback) | 520 | 80 / 96 | 512² | true |
| Cloud / FLUX family | 4000 | 400 / 800 | 1024² | true |
| Local generic (other Local ids) | 740 | 220 / 280 | 512² | true |

Env `IMAGE_CREATOR_ACCEPT_MODEL=sdxl-turbo` (stack placeholder) resolves to the **Z-Image** row when provider is Local.

## Abandoned as Z-Image ceilings

- Execute body **740–800** characters (portrait observation, not token window)
- Propose persist **visual ≤ 80 / action ≤ 96** (sd-3.5 transport; MUST NOT overwrite Canonical)
- **512²** as “Z-Image max resolution”
