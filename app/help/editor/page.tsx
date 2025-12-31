'use client'

import { useMemo, useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import helpContent from '../../../data/pageHelp.json'

type PageHelpEntry = {
  title: string
  body: string[]
  buttonLabel?: string
}

type PageHelpLocale = Record<string, PageHelpEntry> & {
  _common?: {
    buttonLabel?: string
  }
}

const STORAGE_KEY = 'customPageHelp'

const baseHelpMap = JSON.parse(JSON.stringify(helpContent)) as Record<string, PageHelpLocale>

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

export default function HelpEditorPage() {
  const [helpMap, setHelpMap] = useState<Record<string, PageHelpLocale>>(baseHelpMap)
  const [locale, setLocale] = useState<string>(Object.keys(baseHelpMap)[0] ?? 'ja')
  const [selectedPage, setSelectedPage] = useState<string>('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, PageHelpLocale>
        setHelpMap(parsed)
      }
    } catch {
      setHelpMap(baseHelpMap)
    }
  }, [])

  useEffect(() => {
    const keys = Object.keys(helpMap[locale] ?? {}).filter((k) => k !== '_common')
    if (!keys.length) return
    if (!selectedPage || !keys.includes(selectedPage)) {
      setSelectedPage(keys[0])
    }
  }, [helpMap, locale, selectedPage])

  const currentLocale = helpMap[locale] ?? {}
  const currentEntry = (currentLocale as Record<string, PageHelpEntry>)[selectedPage]

  const updateEntry = (key: string, next: PageHelpEntry) => {
    setHelpMap((prev) => ({
      ...prev,
      [locale]: {
        ...(prev[locale] ?? {}),
        [key]: next,
      },
    }))
  }

  const updateCommonLabel = (value: string) => {
    setHelpMap((prev) => ({
      ...prev,
      [locale]: {
        ...(prev[locale] ?? {}),
        _common: { buttonLabel: value || undefined },
      },
    }))
  }

  const addPage = () => {
    const key = prompt('ページキーを入力してください (例: tl-maker)')?.trim()
    if (!key) return
    setHelpMap((prev) => {
      const nextLocale = prev[locale] ?? {}
      if ((nextLocale as Record<string, PageHelpEntry>)[key]) return prev
      return {
        ...prev,
        [locale]: {
          ...nextLocale,
          [key]: { title: '新しいヘルプ', body: ['ここに説明を記載してください。'] },
        },
      }
    })
    setSelectedPage(key)
  }

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(helpMap))
    setStatus('保存しました（このブラウザのみ適用）。')
    setTimeout(() => setStatus(''), 2000)
  }

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY)
    setHelpMap(baseHelpMap)
    setStatus('保存済みのヘルプをリセットしました。')
    setTimeout(() => setStatus(''), 2000)
  }

  const preview = useMemo(() => {
    if (!currentEntry) return null
    return currentEntry.body.map((text, idx) => (
      <ReactMarkdown
        key={idx}
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
        className="prose dark:prose-invert max-w-none"
      >
        {text}
      </ReactMarkdown>
    ))
  }, [currentEntry])

  return (
    <main className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">ヘルプモーダル編集</h1>
        <button
          type="button"
          onClick={addPage}
          className="px-3 py-2 border rounded text-sm"
        >
          ページを追加
        </button>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        編集内容はブラウザのローカルストレージに保存され、各ページのヘルプモーダルに反映されます。共有したい場合はJSONをコピーして別環境に貼り付けてください。
      </p>

      <div className="flex items-center gap-2">
        <label className="text-sm">
          ロケール:
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="ml-2 border rounded px-2 py-1 text-sm"
          >
            {Object.keys(helpMap).map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          ページ:
          <select
            value={selectedPage}
            onChange={(e) => setSelectedPage(e.target.value)}
            className="ml-2 border rounded px-2 py-1 text-sm"
          >
            {Object.keys(currentLocale)
              .filter((k) => k !== '_common')
              .map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
          </select>
        </label>
        <label className="text-sm">
          共通ボタンラベル:
          <input
            value={currentLocale._common?.buttonLabel ?? ''}
            onChange={(e) => updateCommonLabel(e.target.value)}
            className="ml-2 border rounded px-2 py-1 text-sm"
            placeholder="例: このページについて"
          />
        </label>
      </div>

      {currentEntry && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-sm space-y-1">
              <span className="font-semibold">タイトル</span>
              <input
                value={currentEntry.title}
                onChange={(e) =>
                  updateEntry(selectedPage, { ...currentEntry, title: e.target.value })
                }
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </label>
            <label className="block text-sm space-y-1">
              <span className="font-semibold">本文（Markdown対応、複数段落は空行で区切り）</span>
              <textarea
                value={currentEntry.body.join('\n\n')}
                onChange={(e) =>
                  updateEntry(selectedPage, { ...currentEntry, body: e.target.value.split(/\n{2,}/) })
                }
                className="w-full h-48 border rounded p-2 text-sm font-mono"
              />
            </label>
            <label className="block text-sm space-y-1">
              <span className="font-semibold">ボタンラベル（このページ専用・任意）</span>
              <input
                value={currentEntry.buttonLabel ?? ''}
                onChange={(e) =>
                  updateEntry(selectedPage, { ...currentEntry, buttonLabel: e.target.value || undefined })
                }
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder="未入力なら共通を使用"
              />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={save} className="px-3 py-2 rounded border bg-blue-600 text-white text-sm">
                保存
              </button>
              <button type="button" onClick={reset} className="px-3 py-2 rounded border text-sm">
                リセット
              </button>
            </div>
            {status && <p className="text-sm text-green-600 dark:text-green-400">{status}</p>}
          </div>
          <div className="space-y-2 bg-white dark:bg-gray-800 border rounded p-3">
            <h2 className="text-lg font-semibold">プレビュー</h2>
            {preview}
          </div>
        </div>
      )}
    </main>
  )
}
