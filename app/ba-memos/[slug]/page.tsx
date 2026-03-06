import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { notFound } from 'next/navigation'
import { getBaMemoBySlug, getBaMemoList } from '@/lib/baMemos'

type BaMemoArticlePageProps = {
  params: Promise<{
    slug: string
  }>
}

export const generateStaticParams = async () => {
  const memos = getBaMemoList()
  return memos.map((memo) => ({ slug: memo.slug }))
}

export default async function BaMemoArticlePage({ params }: BaMemoArticlePageProps) {
  const { slug } = await params
  const memo = await getBaMemoBySlug(slug)

  if (!memo) {
    notFound()
  }

  return (
    <main className="p-4 space-y-4">
      <Link href="/ba-memos" className="text-sm text-blue-600 hover:underline">
        ← ブルアカ情報メモトップへ戻る
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{memo.title}</h1>
        <p className="text-sm text-gray-500">更新日: {memo.updatedAt}</p>
      </header>

      <article className="prose max-w-none rounded border bg-white p-4">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {memo.markdown}
        </ReactMarkdown>
      </article>
    </main>
  )
}
