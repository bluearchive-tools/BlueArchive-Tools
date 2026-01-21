# DeepSeek OCR vLLM API

DeepSeek vLLM の OpenAI 互換 API に対して画像を送信し、OCR テキストを返す軽量 API です。

## セットアップ（Windows）

```bash
cd services/deepseek-ocr-vllm-api
py -3.11 -m venv .venv
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 環境変数

```bash
set OCR_API_KEY=your-strong-token
set VLLM_CHAT_ENDPOINT=http://127.0.0.1:8000/v1/chat/completions
set VLLM_API_KEY=your-vllm-key
set VLLM_TIMEOUT_SECONDS=30
set VLLM_SYSTEM_PROMPT=You are an OCR engine. Extract all readable text from the image and return it as plain text.
```

PowerShell の場合:

```powershell
$env:OCR_API_KEY="your-strong-token"
$env:VLLM_CHAT_ENDPOINT="http://127.0.0.1:8000/v1/chat/completions"
$env:VLLM_API_KEY="your-vllm-key"
$env:VLLM_TIMEOUT_SECONDS="30"
$env:VLLM_SYSTEM_PROMPT="You are an OCR engine. Extract all readable text from the image and return it as plain text."
```

## 起動

```bash
uvicorn app:app --host 127.0.0.1 --port 13000
```

`services/paddleocr-home-api` 側の環境変数 `DEEPSEEK_VLLM_ENDPOINT` を
`http://127.0.0.1:13000/ocr` に設定してください。

## 動作確認（curl）

```bash
curl -X POST \
  -H "Authorization: Bearer $OCR_API_KEY" \
  -F "model=deepseek-v1" \
  -F "image=@/path/to/image.png" \
  http://127.0.0.1:13000/ocr
```
