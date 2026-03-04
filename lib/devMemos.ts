import { promises as fs } from 'fs'
import path from 'path'

export type DevMemoMeta = {
  slug: string
  title: string
  summary: string
  updatedAt: string
  fileName: string
}

const DEV_MEMOS: DevMemoMeta[] = [
  {
    slug: 'getting-started',
    title: '開発メモの使い方',
    summary: 'このページの目的と、Markdown記事を追加する手順をまとめています。',
    updatedAt: '2026-03-04',
    fileName: 'getting-started.md',
  },
  {
    slug: 'font-used-in-ba',
    title: 'ブルアカで使われているフォント調査',
    summary: 'UIなどで使われているフォントをまとめたメモです',
    updatedAt: '2026-03-05',
    fileName: 'font-used-in-ba.md',
  },
]

const memoRootDir = path.join(process.cwd(), 'dev-memos')

export const getDevMemoList = () => DEV_MEMOS

export const getDevMemoBySlug = async (slug: string) => {
  const found = DEV_MEMOS.find((memo) => memo.slug === slug)
  if (!found) return null

  const markdownPath = path.join(memoRootDir, found.fileName)
  const markdown = await fs.readFile(markdownPath, 'utf-8')

  return {
    ...found,
    markdown,
  }
}
