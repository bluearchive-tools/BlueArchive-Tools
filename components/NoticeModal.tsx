'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

type Notice = {
  id: string
  content: string
}

export default function NoticeModal() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [latestId, setLatestId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/notices')
        if (!res.ok) return
        const data: Notice[] = await res.json()
        setNotices(data.reverse())
        if (data.length) {
          const latest = data[data.length - 1]
          setLatestId(latest.id)
          const last = localStorage.getItem('lastNoticeId')
          if (last !== latest.id) {
            setOpen(true)
          }
        }
      } catch {
        // ignore
      }
    }
    load()
  }, [])

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('openNotice', handler)
    return () => window.removeEventListener('openNotice', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setVisible(true)
    } else {
      const id = setTimeout(() => setVisible(false), 200)
      return () => clearTimeout(id)
    }
  }, [open])

  const close = () => {
    if (latestId) localStorage.setItem('lastNoticeId', latestId)
    setOpen(false)
  }

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-20 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      onClick={close}
    >
      <div
        className="bg-white p-4 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-h-96 overflow-auto prose space-y-8">
          {notices.map((n) => (
            <ReactMarkdown key={n.id}>{n.content}</ReactMarkdown>
          ))}
        </div>
      </div>
    </div>
  )
}
