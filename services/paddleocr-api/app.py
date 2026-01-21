import gc
import io
import os

import numpy as np
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from paddleocr import PaddleOCR
from PIL import Image

app = FastAPI()
DET_LIMIT_SIDE_LEN = int(os.getenv("OCR_DET_LIMIT_SIDE_LEN", "640"))
MAX_SIDE = int(os.getenv("OCR_MAX_SIDE", "1024"))
ocr = PaddleOCR(
    use_angle_cls=False,
    lang="japan",
    show_log=False,
    det_limit_side_len=DET_LIMIT_SIDE_LEN,
    det_limit_type="max",
)


@app.post("/ocr")
async def ocr_image(image: UploadFile = File(...)):
    data = await image.read()
    with Image.open(io.BytesIO(data)) as src_image:
        if MAX_SIDE > 0:
            src_image.thumbnail((MAX_SIDE, MAX_SIDE))
        pil_image = src_image.convert("RGB")
    np_image = np.array(pil_image)
    result = ocr.ocr(np_image, cls=False)
    texts = []
    for line in result:
        if not line:
            continue
        for entry in line:
            text = entry[1][0]
            if text:
                texts.append(text)
    pil_image.close()
    del data, np_image, result
    gc.collect()
    return JSONResponse({"text": "\n".join(texts)})
