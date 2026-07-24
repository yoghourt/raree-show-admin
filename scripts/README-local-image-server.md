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
