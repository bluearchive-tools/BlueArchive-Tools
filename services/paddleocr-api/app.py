import io

import numpy as np
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from paddleocr import PaddleOCR
from PIL import Image

app = FastAPI()
ocr = PaddleOCR(use_angle_cls=True, lang="japan")


@app.post("/ocr")
async def ocr_image(image: UploadFile = File(...)):
    data = await image.read()
    pil_image = Image.open(io.BytesIO(data)).convert("RGB")
    np_image = np.array(pil_image)
    result = ocr.ocr(np_image, cls=True)
    texts = []
    for line in result:
        if not line:
            continue
        for entry in line:
            text = entry[1][0]
            if text:
                texts.append(text)
    return JSONResponse({"text": "\n".join(texts), "raw": result})
