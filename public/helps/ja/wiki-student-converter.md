# Wikiru生徒変換

wikiru の生徒ページURLを入力すると、`students.json` 形式の雛形JSONを生成します。

## 使い方

1. 生徒ページURLを貼り付け
2. 「変換する」を押す
3. 出力結果を確認し、必要項目を補完して `students.json` に追加

## 注意

- 自動抽出はページ構造に依存するため、手動確認は必須です。
- スキル倍率（values）は雛形では空配列として出力される場合があります。

## スキル変数名ルール

スキル文中の `{変数}` は次の命名規則を使います。

- `cost`: コスト回復力（%）
- `costnum`: コストを獲得（定数）
- `defense`: 防御力（%）
- `defensenum`: 防御力（定数）
- `hp`: HP（%）
- `hpnum`: HP（定数）
- `attack`: 攻撃力（%）
- `attacknum`: 攻撃力（定数）
- `heal`: 治癒力（%）
- `healnum`: 治癒力（定数）
- `damage`: ダメージ
- `crit`: 会心率（%）
- `critnum`: 会心値（定数）
- `critdamage`: 会心ダメージ（%）
- `critdamagenum`: 会心ダメージ（定数）
- `type`: 特攻（%）
- `typenum`: 特攻（定数）
