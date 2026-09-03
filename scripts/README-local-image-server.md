# 本地生图服务（Creator Local Deployment）

Admin「生成肖像 / 生成草稿」在 `IMAGE_CREATOR_ACCEPT_PROVIDER=local` 时，会请求本机 HTTP 服务。

协议：`POST http://127.0.0.1:8191/v1/portraits`  
实现：[`local_portrait_server.py`](./local_portrait_server.py)（SPIKE-IMG-002）

---

## 一键启动

```bash
cd scripts
python3 -m venv .venv          # 仅首次
source .venv/bin/activate
pip install "torch" "diffusers" "transformers" "accelerate" "fastapi" "uvicorn" "pillow" "numpy"   # 仅首次 / 缺依赖时
python -m uvicorn local_portrait_server:app --host 127.0.0.1 --port 8191
```

退出虚拟环境：

```bash
deactivate
```

**不要用**裸的 `python`（本机常落到 Python 2.7，没有 uvicorn）。

首次启动会下载 `stabilityai/sdxl-turbo`，可能较慢。看到 Uvicorn 在 `8191` 监听即可。

---

## Admin `.env.local`

```bash
IMAGE_CREATOR_ACCEPT_PROVIDER=local
IMAGE_CREATOR_LOCAL_BASE=http://127.0.0.1:8191
IMAGE_CREATOR_ACCEPT_MODEL=sdxl-turbo

# Cloud fallback（默认关闭。需要时再设 IMAGE_CREATOR_ACCEPT_FALLBACK=siliconflow）
# IMAGE_CREATOR_ACCEPT_FALLBACK=siliconflow
# SILICONFLOW_API_KEY=...
```

改完 env 后 **重启** `npm run dev`。

---

## 自检

```bash
# 服务是否在听
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8191/docs

# 点「生成草稿」后，Next 终端应类似：
#   providerId: 'local'
#   usedFallback: false
```

若出现 `usedFallback: true` + `providerId: 'siliconflow'`，说明 Local 失败已落到云端——先确认本脚本在跑、端口是 `8191`。

---

## 说明

- 路径仍叫 `/v1/portraits`（历史命名）；肖像与 Scene Frame 草稿共用此接口。
- Apple Silicon 脚本默认 `pipe.to("mps")`；无 MPS 需自行改 `local_portrait_server.py` 设备。
- `.venv/` 勿提交；依赖装在 scripts 本地虚拟环境即可。

---

## LocalAI（provider=`localai`）— Admin 端到端（切片 0）

Strategic Default 候选：本机 [LocalAI](https://localai.io/) → OpenAI 兼容 `POST /v1/images/generations`。  
与上方 legacy `local`（`:8191` `/v1/portraits`）**并存**；**代码默认仍是 `local`**，切 LocalAI **只改 env**。

产品路径：Admin UI → Server Action → Capability `image.generate` → Execution `localai` → LocalAI → Cloudinary Candidate（**不写 Asset**，直至「写入作品」）。

**范围：** 本机 `npm run dev` + 本机 LocalAI。Vercel **不会**打到 `127.0.0.1`。

**切片 1（已授权 SPIKE-IMG-003）：** 制作页「排队生成」写入 `generate_jobs`（Execution envelope）。  
**切片 2（Local Worker）：** 本机 poll → `imageGenerate` → Cloudinary → `result_reference`（≠ Candidate ≠ Asset）。  
**切片 3（Accept）：** Job 列表「纳入候选」→「写入作品」/「Accept 并写入」→ `story_images_v2`。  
同步「生成草稿」仅为迁移兼容，勿在其上加新功能。

### Local Worker（切片 2）

Pull-based：本机拉任务，**不**暴露 LocalAI 给 Vercel。

1. `.env.local` 增加（**仅本机 Worker / scripts；勿提交、勿配到 Vercel**）：
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=...   # Supabase project settings → service_role
   ```
   并保持 LocalAI / Cloudinary / `IMAGE_CREATOR_*` 与切片 0 一致。
2. LocalAI 已启动且模型可用。
3. Admin 制作页对空帧点 **排队生成**（`status=queued`）。
4. 另开终端跑 Worker：
   ```bash
   # 处理当前全部 queued 后退出
   npx tsx scripts/local-generate-worker.ts

   # 只处理一条
   npx tsx scripts/local-generate-worker.ts --once

   # 常驻轮询（默认 5s）
   WORKER_POLL_MS=5000 npx tsx scripts/local-generate-worker.ts --loop
   ```
5. Admin Job 列表点 **刷新**：期望 `succeeded` + `result_reference`（可预览图）。  
   **未** Accept 前 `story_images_v2` 不应变化。
6. 日志关键字：`[local-generate-worker] claim` → `complete`；失败则为 `fail` + DB `status=failed`。

### Accept（切片 3）

Job succeeded 之后，在制作页同一 Job 列表：

1. **纳入候选**（单条）或 **全部纳入候选**：把 `result_reference.url` 填入待补帧候选（Candidate；DB Asset 仍不变）。
2. **写入作品**：对已有候选的帧调用 `patchSceneFrameUrls`（Human Accept → Asset）。
3. 或单条 **Accept 并写入**：纳入 + 立即写该帧。
4. 不满意可 **重新排队**（新 job；旧 succeeded 保留历史）。
5. 对应帧已有 Asset 时显示「已写入 Asset」（不改 Job 表 status）。

| 现象 | 处理 |
|------|------|
| 缺 `SUPABASE_SERVICE_ROLE_KEY` | 写入 `.env.local` 后重跑脚本（不必重启 Next） |
| 一直 `queued` | Worker 未跑；或 LocalAI/Cloudinary 失败看终端 |
| `failed` + LocalAI timeout | 见下方 LocalAI 排查；可降 `IMAGE_CREATOR_LOCALAI_MAX_EDGE` |
| `failed` + Cloudinary /「托管失败」 | 图已生成，上传 `api.cloudinary.com` 失败。查网络/`HTTPS_PROXY`；不必降 `MAX_EDGE` |
| 纳入候选后列表仍显示空帧 | 尚未点「写入作品」；Candidate ≠ Asset |

### 操作者步骤（按序）

1. **启动 LocalAI**（默认 `http://127.0.0.1:8080`）。
2. **确认图像模型**（常用名：`dreamshaper`；以 UI / API 为准）：
   ```bash
   curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/v1/models
   curl -sS http://127.0.0.1:8080/v1/models
   ```
3. **编辑仓库根 `.env.local`**（勿提交；可与其它密钥并存）：
   ```bash
   IMAGE_CREATOR_ACCEPT_PROVIDER=localai
   IMAGE_CREATOR_LOCALAI_BASE=http://127.0.0.1:8080
   IMAGE_CREATOR_ACCEPT_MODEL=dreamshaper
   # 专测本机时：fallback 也指回 localai，避免误以为「云端好了」
   IMAGE_CREATOR_ACCEPT_FALLBACK=localai
   IMAGE_CREATOR_LOCALAI_MAX_EDGE=768          # 长边上限（默认 768）。scene_frame 现请求 512×512（不 clamp）
   IMAGE_CREATOR_LOCALAI_TIMEOUT_MS=600000     # 默认 10min
   # IMAGE_CREATOR_LOCALAI_KEY=...
   # 本机稳定后再开云 fallback：
   # IMAGE_CREATOR_ACCEPT_FALLBACK=siliconflow
   # SILICONFLOW_API_KEY=...
   ```
4. **必须重启** Admin：`npm run dev`（改 env 后不重启仍走旧配置）；**Local Worker 也需重启**才会吃到新 size。
5. **浏览器**（已登录）：
   - 角色表单：**生成肖像**
   - 和/或故事编辑画面页 / CPP：**AI 生图 / 生成草稿**
6. **看终端日志**（期望 LocalAI 正常时）：
   ```text
   [executeSceneFrameImageGenerate] prompt { hasExpr, promptLen, size: '512x512' }
   [localai] generate … size: '512x512'   # 或无 clamping（512 ≤ maxEdge）
   [capability:image.generate] … providerId: 'localai' … usedFallback: false
   ```
7. **UI**：得到 Candidate 图 URL；**未**点「写入作品」/保存前不应写入 Asset。

首次生图若报 `grpc service not ready`：等 LocalAI 图像 backend 加载完再点一次（与 live verify 相同）。

本机冒烟（不经过 Admin；512²）：

```bash
VERIFY_LOCALAI_LIVE=1 \
IMAGE_CREATOR_ACCEPT_PROVIDER=localai \
IMAGE_CREATOR_LOCALAI_BASE=http://127.0.0.1:8080 \
IMAGE_CREATOR_ACCEPT_MODEL=dreamshaper \
npx tsx scripts/verify-execution-localai.ts
```

### 排查

| 现象 | 处理 |
|------|------|
| `localai timed out` | 多为分辨率过大或首次加载；看 LocalAI 日志；降 `MAX_EDGE`（如 512）或加 `TIMEOUT_MS` |
| `画面已生成，但托管失败` / Cloudinary connect timeout | 推理已完成；失败在上传。检查到 `api.cloudinary.com` 的网络或 `HTTPS_PROXY`，Worker 会自动重试 3 次 |
| 电脑很卡但最终失败 | LocalAI 仍在本机推理；超时只断客户端等待，后台可能还在跑——必要时重启 LocalAI |
| 仍像走云 / `usedFallback: true` + siliconflow | 未配 `IMAGE_CREATOR_ACCEPT_FALLBACK` 时不应走云；若仍出现，检查是否显式设了 `siliconflow`，并重启 `npm run dev` / worker |
| connection refused | LocalAI 未听 8080；检查 `IMAGE_CREATOR_LOCALAI_BASE` |
| 改了 `.env.local` 无效 | 未重启 `npm run dev` |
| 模型 4xx/5xx | `IMAGE_CREATOR_ACCEPT_MODEL` 必须与 LocalAI 中 **name** 完全一致 |
| 误用 8191 portrait server | `ACCEPT_PROVIDER` 应为 `localai` 不是 `local` |
| 白屏 / 空白图 Job 变 `failed` | 正常：空白检测拒收后，未配置 fallback 则直接失败 |
| fallback 报缺 key | 须设 `SILICONFLOW_API_KEY`；仅有 `IMAGE_SPIKE_SILICONFLOW_KEY` 不够 |

### 脚本回归（可选）

```bash
npx tsx scripts/verify-execution-localai.ts

VERIFY_LOCALAI_LIVE=1 \
IMAGE_CREATOR_ACCEPT_PROVIDER=localai \
IMAGE_CREATOR_LOCALAI_BASE=http://127.0.0.1:8080 \
IMAGE_CREATOR_ACCEPT_MODEL=dreamshaper \
npx tsx scripts/verify-execution-localai.ts
```

### 验收清单（切片 0）

- [ ] `.env.local` 如上且已重启 dev
- [ ] 生成肖像或生成草稿得到 Candidate URL
- [ ] 日志 `providerId: 'localai'` 且 `usedFallback: false`（LocalAI 正常时）
- [ ] 未 Accept / 写入作品前 Asset 未自动写入
