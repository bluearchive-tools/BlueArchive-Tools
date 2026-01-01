'use client'

import decorations from '../../data/decorations.json'

export default function DecorationsPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>
          🛍️
        </span>
        <div>
          <h1 className="text-2xl font-bold">デコレーションショップ</h1>
          <p className="text-sm text-gray-600">プロフィールを彩るデコレーションを選べます。</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {decorations.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden>
                {item.emoji}
              </span>
              <div>
                <p className="text-lg font-semibold">{item.name}</p>
                <p className="text-xs text-gray-500">ID: {item.id}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-700">{item.description}</p>
            <p className="mt-3 text-xs text-gray-500">
              購入・管理はデータベースで行ってください。現在は閲覧のみです。
            </p>
          </div>
        ))}
      </div>
    </main>
  )
}
