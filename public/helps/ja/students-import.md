# 生徒データOCR（精度と速度を上げる実装の考え方）

このページのOCRは無料の `tesseract.js` を使ったクライアント実行です。より高精度・高速にするには「画像の分割＋前処理＋辞書補正」を強化し、必要に応じて無料のバックエンドOCRを併用する構成がおすすめです。

## 実装の全体像（無料で完結）

1. **画面レイアウトに合わせて画像を分割**
   - すでに実装している左右・上下・縦3分割を基準に、
     「名前＋星」「ステータス欄」「スキル欄」「装備欄」などの領域を固定比率で切り出します。
2. **前処理（コントラスト・二値化・拡大）**
   - 2倍拡大 → グレースケール → コントラスト強調 → しきい値の二値化。
   - 文字の輪郭がはっきりすると認識率が上がります。
3. **OCRは2段構え（無料）**
   - フロントは `tesseract.js` を継続。
   - さらに精度が必要な場合は、**無料の自前バックエンド**で `PaddleOCR` か `Tesseract(OpenCV)` を動かし、
     失敗時のみバックエンドOCRへフォールバックします。
4. **辞書補正・ルール補正**
   - 生徒名は「生徒名一覧」辞書で最長一致。
   - ステータスは `HP/攻撃力/防御力/治癒力` をキーワードに、近傍テキストのみをパース。
   - `MAX` の変換や `T10` などの装備表記は専用のパーサーで補正。

## 無料バックエンドOCRの構成例

- **推奨: PaddleOCR（無料・高精度）**
  - 日本語OCRに強く、CPUでも実用速度。
  - Docker でセルフホストすれば完全無料で運用できます。
- **代替: Tesseract + OpenCV（無料）**
  - 前処理を丁寧に作り込むと実用レベルになります。

### 例: シンプルなAPI構成

- `/api/ocr` に画像を送信 → PaddleOCR でテキスト抽出 → JSON 返却
- フロントでは `tesseract.js` が失敗したら `/api/ocr` を呼ぶ

## 外部サービスを使ったPaddleOCRセルフホストの方法（無料）

「ローカルではなく外部で動かしたい」場合は、無料枠のある外部ホスティングを使います。

### 方法A: Hugging Face Inference API（無料枠あり）

1. Hugging Face で無料アカウント作成
2. **PaddleOCRモデル**を利用できるようにする（例: `PaddlePaddle/paddleocr`）
3. APIトークンを発行
4. 環境変数に設定

```
OCR_ENDPOINT=https://api-inference.huggingface.co/models/PaddlePaddle/paddleocr
OCR_API_TOKEN=your_hf_token
```

このリポジトリには `/api/ocr` が用意されているため、\n
フロントからは従来どおり `fetch('/api/ocr')` を呼ぶだけで外部OCRを利用できます。

### 方法B: RenderでPaddleOCRをセルフホスト（無料枠）

Render で Docker サービスとして起動できます。

1. Render で **New Web Service** を作成
2. リポジトリを選択
3. Environment を **Docker** に設定
4. Dockerfile path: `services/paddleocr-api/Dockerfile`
5. Docker build context: `services/paddleocr-api`
6. デプロイ後の URL を確認（例: `https://<your-service>.onrender.com/ocr`）

**ポイント:** `OCR_ENDPOINT` に Render の `/ocr` URL を設定するだけでOKです。

## 速度を上げるためのポイント

- **前処理はCanvasで一度だけ**行い、分割後に再利用
- 同じ画像に対して**再OCRしない**（結果キャッシュ）
- 分割画像は**同時並列にOCR**（Web Worker or backend worker）

## 期待できる読み取り精度

ユーザーが提示した「上部バー／キャラクター情報／ステータス／スキル／装備」の
項目は、**分割OCR＋辞書補正＋領域限定パース**でほぼ取り切れます。

---

必要であれば、PaddleOCRのセルフホスト手順やAPIサンプルも追記できます。
