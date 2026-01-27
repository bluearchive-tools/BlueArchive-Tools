import base64
import os
from typing import Optional

import httpx
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

app = FastAPI()

OCR_API_KEY = os.getenv("OCR_API_KEY", "")
VLLM_CHAT_ENDPOINT = os.getenv("VLLM_CHAT_ENDPOINT", "http://127.0.0.1:8000/v1/chat/completions")
VLLM_API_KEY = os.getenv("VLLM_API_KEY", "")
VLLM_SYSTEM_PROMPT = os.getenv(
    "VLLM_SYSTEM_PROMPT",
    "You are an OCR engine. Extract all readable text from the image and return it as plain text.",
)
VLLM_TIMEOUT_SECONDS = float(os.getenv("VLLM_TIMEOUT_SECONDS", "30"))


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


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"ok": True})


@app.get("/version")
async def version() -> JSONResponse:
    return JSONResponse(
        {
            "vllm_chat_endpoint": VLLM_CHAT_ENDPOINT,
            "vllm_timeout_seconds": VLLM_TIMEOUT_SECONDS,
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
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image payload is empty.",
        )

    encoded = base64.b64encode(data).decode("utf-8")
    model_name = (model or "").strip() or None

    messages = [
        {"role": "system", "content": VLLM_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{image.content_type or 'image/png'};base64,{encoded}"},
                },
                {"type": "text", "text": "Extract all text from the image."},
            ],
        },
    ]

    payload = {
        "messages": messages,
        "temperature": 0,
    }
    if model_name:
        payload["model"] = model_name

    headers = {"Content-Type": "application/json"}
    if VLLM_API_KEY:
        headers["Authorization"] = f"Bearer {VLLM_API_KEY}"

    try:
        async with httpx.AsyncClient(timeout=VLLM_TIMEOUT_SECONDS) as client:
            response = await client.post(VLLM_CHAT_ENDPOINT, headers=headers, json=payload)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"vLLM request failed: {exc}",
        ) from exc

    data = response.json()
    choices = data.get("choices", [])
    if not choices:
        return JSONResponse({"text": ""})
    content = choices[0].get("message", {}).get("content", "")
    return JSONResponse({"text": content or ""})
