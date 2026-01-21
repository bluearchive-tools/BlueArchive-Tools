# PaddleOCR Home API

Renderの軽量版とは別に、自宅PC向けに高精度設定で動かすOCR APIです。

## セットアップ（Windows）

```bash
cd services/paddleocr-home-api
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

`.env.example` を参考に環境変数を設定してください。

```bash
set OCR_API_KEY=your-strong-token
set OCR_MAX_SIDE=1800
set OCR_DET_LIMIT_SIDE_LEN=1280
set OCR_MAX_IMAGE_BYTES=5242880
set OCR_MAX_CONCURRENCY=1
set OCR_TIMEOUT_SECONDS=15
```

起動:

```bash
uvicorn app:app --host 127.0.0.1 --port 10000
```

## Cloudflare Tunnel（Quick Tunnel）

ポート開放せずに外部公開する場合は Quick Tunnel を利用します。

```bash
cloudflared tunnel --url http://127.0.0.1:10000
```

表示された URL（例: `https://xxxx.trycloudflare.com`）に `/ocr` を付けたものを、
Vercel の `OCR_ENDPOINT_PRIMARY` に設定してください。

## 動作確認（curl）

```bash
curl -X POST \
  -H "Authorization: Bearer $OCR_API_KEY" \
  -F "image=@/path/to/image.png" \
  https://xxxx.trycloudflare.com/ocr
```

```bash
curl -H "Authorization: Bearer $OCR_API_KEY" \
  https://xxxx.trycloudflare.com/health
```

```bash
curl -H "Authorization: Bearer $OCR_API_KEY" \
  https://xxxx.trycloudflare.com/version
```
