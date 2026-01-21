# PaddleOCR Home API

Renderの軽量版とは別に、自宅PC向けに高精度設定で動かすOCR APIです。

## セットアップ（Windows）

```bash
cd services/paddleocr-home-api
py -3.11 -m venv .venv
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

> NOTE: Python 3.10/3.11 を推奨します（3.14 では paddlepaddle のホイールがありません）。

もし `paddlepaddle` のインストールでエラーが出る場合は、公式ホイールを使って再インストールしてください。

```bash
pip install --upgrade pip
pip install paddlepaddle==2.6.2 -f https://www.paddlepaddle.org.cn/whl/windows/mkl/avx/stable.html
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

> NOTE: `cloudflared` が見つからない場合は、先にインストールしてください（Windows）。
>
> **winget が使える場合**
> ```bash
> winget install --id Cloudflare.cloudflared
> ```
>
> **Chocolatey が使える場合**
> ```bash
> choco install cloudflared
> ```
>
> **手動インストール**
> 公式ダウンロード: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

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
