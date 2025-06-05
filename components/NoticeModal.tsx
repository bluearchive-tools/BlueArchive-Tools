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

  const openModal = () => {
    setVisible(true)
    setTimeout(() => setOpen(true), 20)
  }

  const closeModal = () => {
    if (latestId) localStorage.setItem('lastNoticeId', latestId)
    setOpen(false)
    setTimeout(() => setVisible(false), 200)
  }

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
            openModal()
          }
        }
      } catch {
        // ignore
      }
    }
    load()
  }, [])

  useEffect(() => {
    const handler = () => openModal()
    window.addEventListener('openNotice', handler)
    return () => window.removeEventListener('openNotice', handler)
  }, [])

  const close = () => closeModal()

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 bg-black/30 flex items-center justify-center z-20 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      onClick={close}
    >
      <div
        className="bg-gray-100 p-4 max-w-lg w-full rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-h-96 overflow-auto space-y-4">
          {notices.map((n) => (
            <div key={n.id} className="bg-white rounded-lg p-4 prose">
              <ReactMarkdown>{n.content}</ReactMarkdown>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
