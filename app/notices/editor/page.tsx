'use client'

import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Notice = {
  id: string
  content: string
}

const STORAGE_KEY = 'customNotices'

const markdownComponents = {
  img: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={alt ?? ''} className={`max-w-full h-auto ${props.className ?? ''}`} />
  ),
  a: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} target={props.target ?? '_blank'} rel={props.rel ?? 'noreferrer'}>
      {children}
    </a>
  ),
}

export default function NoticeEditorPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [status, setStatus] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Notice[]
        setNotices(parsed)
      } else {
        setNotices([{ id: 'draft-1', content: '# 新しいお知らせ\nここに内容を記載してください。' }])
      }
    } catch {
      setNotices([{ id: 'draft-1', content: '# 新しいお知らせ\nここに内容を記載してください。' }])
    }
  }, [])

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notices))
    setStatus('保存しました（このブラウザのみ適用）。')
    setTimeout(() => setStatus(''), 2000)
  }

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY)
    setNotices([{ id: 'draft-1', content: '# 新しいお知らせ\nここに内容を記載してください。' }])
    setStatus('保存済みのお知らせをリセットしました。')
    setTimeout(() => setStatus(''), 2000)
  }

  const addNotice = () => {
    const nextId = `draft-${Date.now()}`
    setNotices([...notices, { id: nextId, content: '# 新しいお知らせ\nここに内容を記載してください。' }])
  }

  const removeNotice = (id: string) => {
    setNotices(notices.filter((n) => n.id !== id))
  }

  const preview = useMemo(
    () =>
      notices.map((n) => (
        <div key={n.id} className="rounded-lg p-3 bg-white dark:bg-gray-900 shadow space-y-2">
          <p className="text-xs text-gray-500">ID: {n.id}</p>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents} className="prose dark:prose-invert max-w-none">
            {n.content}
          </ReactMarkdown>
        </div>
      )),
    [notices]
  )

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-xl font-bold">お知らせ編集ページ</h1>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        編集内容はブラウザのローカルストレージに保存され、ヘッダーのお知らせモーダルに反映されます。共有したい場合はJSONをコピーして別環境に貼り付けてください。
      </p>

      <div className="flex gap-2">
        <button type="button" onClick={addNotice} className="px-3 py-2 rounded border">
          お知らせを追加
        </button>
        <button type="button" onClick={save} className="px-3 py-2 rounded border bg-blue-600 text-white">
          保存
        </button>
        <button type="button" onClick={reset} className="px-3 py-2 rounded border">
          リセット
        </button>
      </div>
      {status && <p className="text-sm text-green-600 dark:text-green-400">{status}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          {notices.map((n, idx) => (
            <div key={n.id} className="border rounded p-3 space-y-2 bg-white dark:bg-gray-800">
              <div className="flex items-center gap-2">
                <label className="text-sm">
                  ID:
                  <input
                    value={n.id}
                    onChange={(e) => {
                      const next = [...notices]
                      next[idx] = { ...n, id: e.target.value }
                      setNotices(next)
                    }}
                    className="ml-2 border rounded px-2 py-1 text-sm"
                  />
                </label>
                <button type="button" onClick={() => removeNotice(n.id)} className="text-sm text-red-600">
                  削除
                </button>
              </div>
              <textarea
                value={n.content}
                onChange={(e) => {
                  const next = [...notices]
                  next[idx] = { ...n, content: e.target.value }
                  setNotices(next)
                }}
                className="w-full h-32 border rounded p-2 text-sm font-mono"
              />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">プレビュー</h2>
          {preview}
        </div>
      </div>
    </main>
  )
}
