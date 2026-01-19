# PaddleOCR API (Render)

Render 上で PaddleOCR を動かすためのシンプルな FastAPI サービスです。

## エンドポイント

- `POST /ocr`
  - `multipart/form-data` で `image` フィールドに画像を送信
  - 返却: `{ "text": "...", "raw": [...] }`

## ローカル実行

```bash
cd services/paddleocr-api
pip install -r requirements.txt
uvicorn app:app --reload
```

## Render デプロイ

1. Render で新しい Web Service を作成
2. Repository を選択
3. Environment: **Docker**
4. Dockerfile path: `services/paddleocr-api/Dockerfile`
5. Docker build context: `services/paddleocr-api`
6. Deploy

デプロイ後の URL は `https://<your-service>.onrender.com/ocr` になります。

## フロントエンド側の設定

フロントの `.env.local` もしくは本番環境変数で次を設定します:

```
OCR_ENDPOINT=https://<your-service>.onrender.com/ocr
```

`/api/ocr` はこのエンドポイントへリクエストを転送します。
