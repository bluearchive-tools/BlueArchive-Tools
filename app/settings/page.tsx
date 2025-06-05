'use client'

import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons'

export default function Settings() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = saved ? saved === 'dark' : prefersDark
    if (isDark) {
      document.documentElement.classList.add('dark')
      setDark(true)
    }
  }, [])

  const toggle = () => {
    setDark((prev) => {
      const next = !prev
      if (next) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('theme', 'light')
      }
      return next
    })
  }

  return (
    <main className="p-4 space-y-4">
      <h2 className="text-xl">設定ページ</h2>
      <button
        onClick={toggle}
        className="px-4 py-2 border rounded flex items-center gap-2"
      >
        <FontAwesomeIcon icon={dark ? faSun : faMoon} />
        <span>{dark ? 'ライトモードに切替' : 'ダークモードに切替'}</span>
      </button>
    </main>
  )
}
