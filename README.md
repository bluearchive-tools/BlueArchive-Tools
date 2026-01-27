This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Supabase 連携

Google 認証後に `profiles` テーブルへユーザー名を登録します。`admin` 列を追加しておくと管理者権限を付与できます。

環境変数 `SUPABASE_URL` と `SUPABASE_ANON_KEY` を `.env.local` に設定してください。
ユーザー名登録ページは `/profile/setup` です。

## お知らせ機能

`notices` フォルダに Markdown ファイルを追加すると、最新のお知らせがトップページ表示時にモーダルで通知されます。モーダルでは過去のお知らせもまとめて表示され、ヘッダーのベルアイコンからいつでも確認できます。ユーザーが一度確認するとローカルストレージに記録され、次回以降は更新があるまで自動表示されません。

## TL 自動更新

`api/tl-cron` エンドポイントは Vercel Cron により 30 分おきに実行されます。
最新シーズンのタイムライン動画を検索し、Supabase に保存します。
テーブル名はすべて小文字の `tl_<シーズン番号>` として事前に作成しておく必要があります。
各テーブルには以下の列を用意してください。
`guide` (boolean) は動画に解説が付いているかどうか、
`formation_status` (text) は編成情報の状態(`none`/`auto`/`manual`)を示します。

## YouTube 更新スクリプト

`npm run update:youtube` で YouTube の動画情報を取得し、Supabase に保存します。
GitHub Actions のスケジュール実行では Secrets から環境変数を渡しています。

必須の環境変数:

- `YOUTUBE_API_KEYS`: YouTube API キーのカンマ区切りリスト
- `SUPABASE_URL`: Supabase のプロジェクト URL
- `SUPABASE_ANON_KEY`: Supabase の anon key

任意の環境変数:

- `YOUTUBE_API_KEY`: 単一の YouTube API キー (補助的に追加)
