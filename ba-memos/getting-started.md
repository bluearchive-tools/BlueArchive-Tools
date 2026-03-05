# ブルアカ情報メモの使い方

このページは、ブルーアーカイブ関連の情報を短い記事として残すためのメモ置き場です。

## 記事の追加方法

1. `ba-memos/` 配下に Markdown ファイルを追加する。
2. `lib/baMemos.ts` の `BA_MEMOS` に `slug` / `title` / `summary` / `updatedAt` / `fileName` を追記する。
3. `/ba-memos` から一覧表示され、`/ba-memos/[slug]` で個別ページが自動生成される。

## 命名ルール

- Markdownファイル名は `kebab-case` 推奨
- `slug` はファイル名と同じにしておくと管理しやすい
