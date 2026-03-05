import Link from 'next/link'
import { getBaMemoList } from '@/lib/baMemos'

export default function BaMemoIndexPage() {
  const memos = getBaMemoList()

  return (
    <main className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">ブルアカ情報メモ</h1>
        <p className="text-sm text-gray-600">ブルーアーカイブ関連の情報を小記事でまとめています。</p>
      </div>

      <div className="space-y-3">
        {memos.map((memo) => (
          <Link key={memo.slug} href={`/ba-memos/${memo.slug}`} className="block rounded border bg-white p-4 shadow-sm hover:bg-gray-50">
            <p className="text-lg font-semibold">{memo.title}</p>
            <p className="text-sm text-gray-600">{memo.summary}</p>
            <p className="mt-2 text-xs text-gray-500">更新日: {memo.updatedAt}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
