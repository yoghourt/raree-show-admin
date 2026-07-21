# pip install "torch" "diffusers" "transformers" "accelerate" "fastapi" "uvicorn" "pillow" "numpy"
# Optional face guard: pip install "opencv-python-headless"
# (If CascadeClassifier is missing: pip uninstall -y cv2 opencv-python opencv-python-headless
#  then: pip install opencv-python-headless)
#
# Start:
#   cd scripts && python -m uvicorn local_portrait_server:app --host 127.0.0.1 --port 8191

from __future__ import annotations

from io import BytesIO

import numpy as np
import torch
from diffusers import AutoPipelineForText2Image
from fastapi import FastAPI
from fastapi.responses import Response
from PIL import Image
from pydantic import BaseModel

# Keep in sync with lib/prompts/avatar.ts AVATAR_NEGATIVE_PROMPT intent.
AVATAR_NEGATIVE_PROMPT = (
    "twins, two people, two faces, two heads, double head, extra head, "
    "duplicate, cloned, mirror double, conjoined, siamese, split screen, "
    "side by side, couple, group, crowd, multiple characters, extra person, "
    "deformed, mutated, text, letters, typography, caption, title, nameplate, "
    "signature, watermark, logo, emblem, seal, stamp, frame, border, "
    "ornate frame, picture frame, decorative border, scrollwork, filigree, "
    "UI, HUD, card, trading card, character sheet, poster, comic panel"
)

MAX_ATTEMPTS = 4

app = FastAPI()
pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/sdxl-turbo",
    torch_dtype=torch.float16,
    variant="fp16",
)
pipe.to("mps")

_face_cascade = None
_face_detect_enabled = False


def _init_face_detector() -> None:
    global _face_cascade, _face_detect_enabled
    try:
        import cv2  # type: ignore

        if not hasattr(cv2, "CascadeClassifier"):
            raise RuntimeError(
                "cv2.CascadeClassifier missing — wrong/stub cv2 package installed"
            )
        cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        if cascade.empty():
            raise RuntimeError("haar cascade failed to load")
        _face_cascade = cascade
        _face_detect_enabled = True
        print("[local_portrait] face guard: enabled (OpenCV Haar)")
    except Exception as err:
        _face_cascade = None
        _face_detect_enabled = False
        print(
            "[local_portrait] face guard: DISABLED "
            f"({err}). Server still runs; install opencv-python-headless to enable."
        )


_init_face_detector()


class Req(BaseModel):
    prompt: str
    seed: int | None = None
    width: int = 768
    height: int = 1024
    reference_url: str | None = None
    model: str | None = None
    negative_prompt: str | None = None


def count_faces(image: Image.Image) -> int | None:
    """Return face count, or None if face guard is unavailable."""
    if not _face_detect_enabled or _face_cascade is None:
        return None
    import cv2  # type: ignore

    rgb = np.array(image.convert("RGB"))
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    faces = _face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.08,
        minNeighbors=6,
        minSize=(72, 72),
    )
    return len(faces)


def generate_once(
    prompt: str,
    negative: str,
    width: int,
    height: int,
    seed: int,
) -> Image.Image:
    g = torch.Generator(device="mps")
    g.manual_seed(seed)
    return pipe(
        prompt,
        negative_prompt=negative,
        num_inference_steps=8,
        guidance_scale=1.5,
        width=width,
        height=height,
        generator=g,
    ).images[0]


@app.post("/v1/portraits")
def portraits(body: Req):
    width = max(512, min(1024, body.width - (body.width % 8)))
    height = max(512, min(1024, body.height - (body.height % 8)))
    negative = (body.negative_prompt or "").strip() or AVATAR_NEGATIVE_PROMPT
    base_seed = (
        body.seed
        if body.seed is not None
        else int(torch.randint(0, 1_000_000_000, (1,)).item())
    )

    attempts = MAX_ATTEMPTS if _face_detect_enabled else 1
    best: Image.Image | None = None
    best_faces: int | None = None
    chosen_seed = base_seed

    for attempt in range(attempts):
        seed = base_seed + attempt * 9973
        image = generate_once(body.prompt, negative, width, height, seed)
        faces = count_faces(image)
        print(
            f"[local_portrait] attempt={attempt + 1}/{attempts} "
            f"seed={seed} faces={faces}"
        )
        if faces == 1:
            best = image
            best_faces = faces
            chosen_seed = seed
            break
        if best is None:
            best = image
            best_faces = faces
            chosen_seed = seed
        elif faces is not None and (best_faces is None or faces < best_faces):
            best = image
            best_faces = faces
            chosen_seed = seed

    assert best is not None
    if _face_detect_enabled and best_faces != 1:
        print(
            f"[local_portrait] WARNING: no single-face sample after "
            f"{attempts} tries (best_faces={best_faces}, seed={chosen_seed})"
        )

    buf = BytesIO()
    best.save(buf, format="PNG")
    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={
            "x-local-portrait-faces": str(best_faces),
            "x-seed": str(chosen_seed),
        },
    )
