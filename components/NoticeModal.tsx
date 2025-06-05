'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

export default function NoticeModal() {
  const [content, setContent] = useState<string | null>(null)
  const [noticeId, setNoticeId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/notices/latest')
        if (!res.ok) return
        const data = await res.json()
        if (!data.id) return
        const last = localStorage.getItem('lastNoticeId')
        if (last !== data.id) {
          setContent(data.content)
          setNoticeId(data.id)
          setOpen(true)
        }
      } catch {
        // ignore
      }
    }
    load()
  }, [])

  const close = () => {
    if (noticeId) localStorage.setItem('lastNoticeId', noticeId)
    setOpen(false)
  }

  if (!open || !content) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-20">
      <div className="bg-white p-4 max-w-lg w-full">
        <div className="max-h-96 overflow-auto prose">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
        <div className="text-right mt-4">
          <button onClick={close} className="px-4 py-2 bg-blue-500 text-white rounded">
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
