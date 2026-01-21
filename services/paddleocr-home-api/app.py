import asyncio
import gc
import io
import logging
import os
from typing import Optional

import numpy as np
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from paddleocr import PaddleOCR
from PIL import Image

app = FastAPI()
logger = logging.getLogger("paddleocr-home-api")

OCR_API_KEY = os.getenv("OCR_API_KEY", "")
MAX_IMAGE_BYTES = int(os.getenv("OCR_MAX_IMAGE_BYTES", "5242880"))
MAX_CONCURRENCY = int(os.getenv("OCR_MAX_CONCURRENCY", "1"))
TIMEOUT_SECONDS = float(os.getenv("OCR_TIMEOUT_SECONDS", "15"))
MAX_SIDE = int(os.getenv("OCR_MAX_SIDE", "1800"))
DET_LIMIT_SIDE_LEN = int(os.getenv("OCR_DET_LIMIT_SIDE_LEN", "1280"))
HIGH_MAX_SIDE = int(os.getenv("OCR_HIGH_MAX_SIDE", "2200"))
HIGH_DET_LIMIT_SIDE_LEN = int(os.getenv("OCR_HIGH_DET_LIMIT_SIDE_LEN", "1600"))

semaphore = asyncio.Semaphore(MAX_CONCURRENCY if MAX_CONCURRENCY > 0 else 1)

ocr_default = PaddleOCR(
    use_angle_cls=True,
    lang="japan",
    show_log=False,
    det_limit_side_len=DET_LIMIT_SIDE_LEN,
    det_limit_type="max",
)
ocr_high = PaddleOCR(
    use_angle_cls=True,
    lang="japan",
    show_log=False,
    det_limit_side_len=HIGH_DET_LIMIT_SIDE_LEN,
    det_limit_type="max",
)


def _check_auth(authorization: Optional[str]) -> None:
    if not OCR_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OCR_API_KEY is not configured.",
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header is required.",
        )
    token = authorization.removeprefix("Bearer ").strip()
    if token != OCR_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API token.",
        )


def _run_ocr(ocr_instance: PaddleOCR, image_bytes: bytes, max_side: int) -> str:
    with Image.open(io.BytesIO(image_bytes)) as src_image:
        if max_side > 0:
            src_image.thumbnail((max_side, max_side))
        pil_image = src_image.convert("RGB")
    np_image = np.array(pil_image)
    result = ocr_instance.ocr(np_image, cls=True)
    texts: list[str] = []
    for line in result:
        if not line:
            continue
        for entry in line:
            text = entry[1][0]
            if text:
                texts.append(text)
    pil_image.close()
    del np_image, result
    gc.collect()
    return "\n".join(texts)


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"ok": True})


@app.get("/version")
async def version() -> JSONResponse:
    return JSONResponse(
        {
            "ocr_max_side": MAX_SIDE,
            "ocr_det_limit_side_len": DET_LIMIT_SIDE_LEN,
            "ocr_max_image_bytes": MAX_IMAGE_BYTES,
            "ocr_max_concurrency": MAX_CONCURRENCY,
            "ocr_timeout_seconds": TIMEOUT_SECONDS,
            "use_angle_cls": True,
            "lang": "japan",
        }
    )


@app.post("/ocr")
async def ocr_image(
    image: UploadFile = File(...),
    model: Optional[str] = Form(default=None),
    authorization: Optional[str] = Header(default=None),
) -> JSONResponse:
    _check_auth(authorization)
    data = await image.read()
    if MAX_IMAGE_BYTES > 0 and len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image exceeds size limit.",
        )

    model_key = (model or "default").strip().lower()
    if model_key in ("high", "accurate"):
        ocr_instance = ocr_high
        max_side = HIGH_MAX_SIDE
    else:
        ocr_instance = ocr_default
        max_side = MAX_SIDE

    async with semaphore:
        try:
            text = await asyncio.wait_for(
                asyncio.to_thread(_run_ocr, ocr_instance, data, max_side),
                timeout=TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as exc:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="OCR processing timed out.",
            ) from exc
        except Exception as exc:
            logger.exception("OCR processing failed")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"OCR processing failed: {exc}",
            ) from exc

    del data
    gc.collect()
    return JSONResponse({"text": text})
