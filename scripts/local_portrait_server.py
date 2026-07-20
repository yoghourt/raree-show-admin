# pip install "torch" "diffusers" "transformers" "accelerate" "fastapi" "uvicorn" "pillow"
# 首次会下载 SDXL，需网络与磁盘

from io import BytesIO
from fastapi import FastAPI
from fastapi.responses import Response
from pydantic import BaseModel
import torch
from diffusers import AutoPipelineForText2Image

app = FastAPI()
pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/sdxl-turbo",  # 先求能跑；再换 SDXL / FLUX
    torch_dtype=torch.float16,
    variant="fp16",
)
pipe.to("mps")

class Req(BaseModel):
    prompt: str
    seed: int | None = None
    width: int = 768
    height: int = 768
    reference_url: str | None = None
    model: str | None = None

@app.post("/v1/portraits")
def portraits(body: Req):
    # reference_url：第一轮可忽略；能跑通再加 IP-Adapter
    g = torch.Generator(device="mps")
    if body.seed is not None:
        g.manual_seed(body.seed)
    image = pipe(
        body.prompt,
        num_inference_steps=4,   # turbo；正宗 SDXL 可改 20–30
        guidance_scale=0.0,      # turbo 常用 0
        width=body.width,
        height=body.height,
        generator=g,
    ).images[0]
    buf = BytesIO()
    image.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")

# uvicorn local_portrait_server:app --host 127.0.0.1 --port 8191