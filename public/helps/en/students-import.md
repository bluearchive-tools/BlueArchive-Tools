# Student OCR (Improve accuracy and speed)

This page uses free client-side OCR via `tesseract.js`. For higher accuracy and faster response, combine **layout-aware cropping**, **image preprocessing**, and **dictionary-based postprocessing**, and optionally add a **free self-hosted OCR backend** as a fallback.

## Recommended free stack

1. **Layout-based cropping**
   - Cut the screenshot into fixed regions: name+stars, stats, skills, equipment.
2. **Preprocessing**
   - 2x upscale → grayscale → contrast boost → thresholding.
3. **Two-stage OCR**
   - Keep `tesseract.js` on the client.
   - Add a free self-hosted backend using **PaddleOCR** or **Tesseract+OpenCV** for difficult cases.
4. **Postprocessing rules**
   - Match student names against the local student list.
   - Parse stats near keywords like HP/Attack/Defense/Heal.
   - Normalize `MAX`, `T10`, and similar patterns with dedicated parsers.

## Simple backend idea

- `/api/ocr` accepts an image → PaddleOCR extracts text → return JSON.
- The client calls the backend only when local OCR fails.

## PaddleOCR via external hosting (free tiers)

If you prefer an external service (not local), use a free-tier host and keep the same `/api/ocr` entrypoint.

### Option A: Hugging Face Inference API

1. Create a free Hugging Face account
2. Enable a PaddleOCR model (e.g. `PaddlePaddle/paddleocr`)
3. Generate an API token
4. Set env vars:

```
OCR_ENDPOINT=https://api-inference.huggingface.co/models/PaddlePaddle/paddleocr
OCR_API_TOKEN=your_hf_token
```

### Option B: Self-host on Render (free tier)

1. Create a **New Web Service** in Render
2. Select the repository
3. Set Environment to **Docker**
4. Dockerfile path: `services/paddleocr-api/Dockerfile`
5. Docker build context: `services/paddleocr-api`
6. After deploy, use `https://<your-service>.onrender.com/ocr`

Point `OCR_ENDPOINT` to the Render `/ocr` URL.

## Speed tips

- Preprocess once per image and reuse for all crops.
- Cache OCR results to avoid reprocessing.
- Run OCR tasks in parallel (web workers or backend workers).

If you want, we can add step-by-step setup instructions or sample API code.
