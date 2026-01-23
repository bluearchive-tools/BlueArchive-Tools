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
set OCR_HIGH_MAX_SIDE=2200
set OCR_HIGH_DET_LIMIT_SIDE_LEN=1600
set DEEPSEEK_OCR_ENDPOINT=http://127.0.0.1:12000/ocr
set DEEPSEEK_OCR_TOKEN=your-deepseek-token
set DEEPSEEK_VLLM_ENDPOINT=http://127.0.0.1:13000/ocr
set DEEPSEEK_VLLM_TOKEN=your-deepseek-vllm-token
```

PowerShell を使う場合は以下の形式で設定してください。

```powershell
$env:OCR_API_KEY="your-strong-token"
$env:OCR_MAX_SIDE="1800"
$env:OCR_DET_LIMIT_SIDE_LEN="1280"
$env:OCR_MAX_IMAGE_BYTES="5242880"
$env:OCR_MAX_CONCURRENCY="1"
$env:OCR_TIMEOUT_SECONDS="15"
$env:OCR_HIGH_MAX_SIDE="2200"
$env:OCR_HIGH_DET_LIMIT_SIDE_LEN="1600"
$env:DEEPSEEK_OCR_ENDPOINT="http://127.0.0.1:12000/ocr"
$env:DEEPSEEK_OCR_TOKEN="your-deepseek-token"
$env:DEEPSEEK_VLLM_ENDPOINT="http://127.0.0.1:13000/ocr"
$env:DEEPSEEK_VLLM_TOKEN="your-deepseek-vllm-token"
```

## 一括起動（PowerShell）

PaddleOCR + DeepSeek OCR + DeepSeek OCR(vLLM) + Cloudflare Tunnel をまとめて起動したい場合は、
リポジトリ直下のスクリプトを使うと一括で立ち上げられます。

> NOTE: スクリプトが venv 作成と `pip install -r requirements.txt` まで自動で行います。

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
.\scripts\start-local-ocr-stack.ps1 `
  -OcrApiKey "your-strong-token" `
  -DeepseekOcrToken "your-deepseek-token" `
  -DeepseekVllmToken "your-deepseek-vllm-token" `
  -DeepseekOcrChatEndpoint "http://127.0.0.1:8000/v1/chat/completions" `
  -DeepseekVllmChatEndpoint "http://127.0.0.1:8000/v1/chat/completions"
```

コピペ用の 1 行コマンド:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local-ocr-stack.ps1 -OcrApiKey "your-strong-token" -DeepseekOcrToken "your-deepseek-token" -DeepseekVllmToken "your-deepseek-vllm-token" -DeepseekOcrChatEndpoint "http://127.0.0.1:8000/v1/chat/completions" -DeepseekVllmChatEndpoint "http://127.0.0.1:8000/v1/chat/completions"
```

`DeepseekOcrChatEndpoint` / `DeepseekVllmChatEndpoint` はそれぞれ上流の OpenAI 互換 API を指定してください。
vLLM を別ポートで起動している場合は、その URL に差し替えてください。

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

### 固定ドメインを使う場合（Named Tunnel）

Quick Tunnel は毎回 URL が変わるため、固定ドメインを使いたい場合は Named Tunnel を作成します。
Cloudflare で DNS を管理している前提で、以下の手順で固定 URL にできます。

> NOTE: 現在 `bluearchive.tools` の NS が Vercel を指している場合は、Named Tunnel で固定ドメインを使うには
> Cloudflare 側に DNS を委任する必要があります。方法は 2 つです。
> 1) レジストラ側の NS を Cloudflare に変更して、Vercel の DNS レコードを Cloudflare に移す。
> 2) サブドメイン（例: `ocr.bluearchive.tools`）だけを Cloudflare に委任し、そのサブドメインでトンネルを使う。
>
> サブドメインだけ委任したい場合は、Vercel 側の DNS に **NS レコード** を追加して Cloudflare の NS を設定します。
> 例: `ocr.bluearchive.tools` に Cloudflare が指定する NS（2 つ）を追加します。
> その後、Cloudflare 側で `ocr.bluearchive.tools` のゾーンを作成し、Named Tunnel の DNS を作成してください。

```powershell
# 1) 初回ログイン
cloudflared login

# 2) トンネル作成
cloudflared tunnel create paddleocr-home

# 3) DNS を割り当て（例: ocr.example.com）
cloudflared tunnel route dns paddleocr-home ocr.example.com
```

`%USERPROFILE%\.cloudflared\config.yml` を作成して、ローカル API に向けます。

```yaml
tunnel: paddleocr-home
credentials-file: C:\Users\<user>\.cloudflared\<tunnel-id>.json

ingress:
  - hostname: ocr.example.com
    service: http://127.0.0.1:10000
  - service: http_status:404
```

起動:

```powershell
cloudflared tunnel --config "C:\Users\<user>\.cloudflared\config.yml" run paddleocr-home
```

この場合は `https://ocr.example.com/ocr` を `OCR_ENDPOINT_PRIMARY` に設定します。

## 動作確認（curl）

```bash
curl -X POST \
  -H "Authorization: Bearer $OCR_API_KEY" \
  -F "image=@/path/to/image.png" \
  https://xxxx.trycloudflare.com/ocr
```

高精度モデル（高解像度プリセット）を指定する場合は `model=high` を送信してください。

```bash
curl -X POST \
  -H "Authorization: Bearer $OCR_API_KEY" \
  -F "model=high" \
  -F "image=@/path/to/image.png" \
  https://xxxx.trycloudflare.com/ocr
```

DeepSeek OCR を使う場合は `engine=deepseek` と `model` を指定してください。

```bash
curl -X POST \
  -H "Authorization: Bearer $OCR_API_KEY" \
  -F "engine=deepseek" \
  -F "model=deepseek-v1" \
  -F "image=@/path/to/image.png" \
  https://xxxx.trycloudflare.com/ocr
```

DeepSeek OCR vLLM を使う場合は `engine=deepseek-vllm` と `model` を指定してください。

```bash
curl -X POST \
  -H "Authorization: Bearer $OCR_API_KEY" \
  -F "engine=deepseek-vllm" \
  -F "model=deepseek-v1" \
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
