'use client'

import { useState, useEffect } from 'react'
import { useTheme } from './ThemeProvider'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

const markdownComponents = {
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="text-3xl font-bold mt-4 mb-2" {...props} />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-2xl font-bold mt-4 mb-2" {...props} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-xl font-bold mt-4 mb-2" {...props} />
  ),
  h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4 className="text-lg font-bold mt-4 mb-2" {...props} />
  ),
  h5: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h5 className="text-base font-bold mt-4 mb-2" {...props} />
  ),
  h6: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h6 className="text-sm font-bold mt-4 mb-2" {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc pl-6" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal pl-6" {...props} />
  ),
}

type Notice = {
  id: string
  content: string
}

export default function NoticeModal() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [latestId, setLatestId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const { dark } = useTheme()

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
        const ordered = [...data].reverse()
        setNotices(ordered)
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
      className={`fixed inset-0 ${dark ? 'bg-black/50' : 'bg-black/20'} flex items-center justify-center z-20 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      onClick={close}
    >
      <div
        className={`${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'} p-4 max-w-lg w-full rounded-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-h-96 overflow-auto space-y-4">
          {notices.map((n) => (
            <div key={n.id} className={`${dark ? 'bg-gray-700' : 'bg-white'} rounded-lg p-4 prose ${dark ? 'prose-invert' : ''}`}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={markdownComponents}
              >
                {n.content}
              </ReactMarkdown>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
