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

# Cloud fallback（Local 挂了才会用；要强制只走本地可先去掉 key / 注释 fallback）
IMAGE_CREATOR_ACCEPT_FALLBACK=siliconflow
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

**范围：** 本机 `npm run dev` + 本机 LocalAI。Vercel **不会**打到 `127.0.0.1`；线上拓扑见后续「队列 + Local Worker」切片。

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
   IMAGE_CREATOR_ACCEPT_FALLBACK=siliconflow
   # IMAGE_CREATOR_LOCALAI_KEY=...   # 仅当 LocalAI 开了鉴权
   # SILICONFLOW_API_KEY=...         # 可选；LocalAI 挂了才走云
   ```
4. **必须重启** Admin：`npm run dev`（改 env 后不重启仍走旧配置）。
5. **浏览器**（已登录）：
   - 角色表单：**生成肖像**
   - 和/或 CPP 批处理：**生成草稿**
6. **看终端日志**（期望 LocalAI 正常时）：
   ```text
   [capability:image.generate] … providerId: 'localai' … usedFallback: false
   [generateCharacterAvatar] 或 [generateFrameDraft] … usedFallback: false … cloudinaryOk: true
   ```
7. **UI**：得到 Candidate 图 URL；**未**点「写入作品」前不应写入 `story_images_v2` / 肖像 Asset。

首次生图若报 `grpc service not ready`：等 LocalAI 图像 backend 加载完再点一次（与 live verify 相同）。

### 排查

| 现象 | 处理 |
|------|------|
| 仍像走云 / `usedFallback: true` + siliconflow | LocalAI 未起、BASE 错、或模型名不对；先 `curl /v1/models` |
| connection refused | LocalAI 未听 8080；检查 `IMAGE_CREATOR_LOCALAI_BASE` |
| 改了 `.env.local` 无效 | 未重启 `npm run dev` |
| 模型 4xx/5xx | `IMAGE_CREATOR_ACCEPT_MODEL` 必须与 LocalAI 中 **name** 完全一致 |
| 误用 8191 portrait server | `ACCEPT_PROVIDER` 应为 `localai` 不是 `local` |

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
