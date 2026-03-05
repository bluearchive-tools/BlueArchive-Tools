import { promises as fs } from 'fs'
import path from 'path'

export type BaMemoMeta = {
  slug: string
  title: string
  summary: string
  updatedAt: string
  fileName: string
}

const BA_MEMOS: BaMemoMeta[] = [
  {
    slug: 'getting-started',
    title: 'ブルアカ情報メモの使い方',
    summary: 'このページの目的と、Markdown記事を追加する手順をまとめています。',
    updatedAt: '2026-03-05',
    fileName: 'getting-started.md',
  },
  {
    slug: 'official-links',
    title: '公式情報リンク集',
    summary: '公式サイトや公式SNSなど、確認に便利なリンクをまとめました。',
    updatedAt: '2026-03-05',
    fileName: 'official-links.md',
  },
]

const memoRootDir = path.join(process.cwd(), 'ba-memos')

export const getBaMemoList = () => BA_MEMOS

export const getBaMemoBySlug = async (slug: string) => {
  const found = BA_MEMOS.find((memo) => memo.slug === slug)
  if (!found) return null

  const markdownPath = path.join(memoRootDir, found.fileName)
  const markdown = await fs.readFile(markdownPath, 'utf-8')

  return {
    ...found,
    markdown,
  }
}
