'use client'

import { useEffect, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useTheme } from './ThemeProvider'

interface Squad {
  strikers: string[]
  specials: string[]
  memo?: string
}

interface SquadGroup {
  id: string
  name: string
  squads: Squad[]
}

export default function SquadSyncModal() {
  const session = useSession()
  const supabase = useSupabaseClient()
  const { dark } = useTheme()
  const [visible, setVisible] = useState(false)
  const [localGroups, setLocalGroups] = useState<SquadGroup[]>([])
  const [dbGroups, setDbGroups] = useState<SquadGroup[]>([])
  const [diffNames, setDiffNames] = useState<string[]>([])

  useEffect(() => {
    const run = async () => {
      if (!session) return
      const doneKey = `squad_sync_done_${session.user.id}`
      if (localStorage.getItem(doneKey)) return
      let local: SquadGroup[] = []
      const raw = localStorage.getItem('squadGroups')
      if (raw) {
        try {
          local = JSON.parse(raw) as SquadGroup[]
        } catch {
          /* ignore */
        }
      }
      setLocalGroups(local)
      const { data } = await supabase
        .from('user_squad_groups')
        .select('groups')
        .eq('user_id', session.user.id)
        .maybeSingle()
      const db: SquadGroup[] = (data as { groups: SquadGroup[] } | null)?.groups || []
      setDbGroups(db)
      const ids = new Set([...local.map((g) => g.id), ...db.map((g) => g.id)])
      const diff: string[] = []
      ids.forEach((id) => {
        const l = local.find((g) => g.id === id)
        const d = db.find((g) => g.id === id)
        if (!l || !d || JSON.stringify(l) !== JSON.stringify(d)) {
          diff.push(l?.name ?? d?.name ?? id)
        }
      })
      if (diff.length) {
        setDiffNames(diff)
        setVisible(true)
      } else {
        localStorage.setItem(doneKey, '1')
      }
    }
    run()
  }, [session, supabase])

  const close = () => {
    if (session) localStorage.setItem(`squad_sync_done_${session.user.id}`, '1')
    setVisible(false)
  }

  const mergeToLocal = (priority: 'local' | 'db') => {
    const groups = priority === 'local' ? localGroups : dbGroups
    localStorage.setItem('squadGroups', JSON.stringify(groups))
    if (session) localStorage.setItem(`squad_sync_done_${session.user.id}`, '1')
    setVisible(false)
  }

  const mergeToDb = async (priority: 'local' | 'db') => {
    if (!session) return
    const groups = priority === 'local' ? localGroups : dbGroups
    await supabase
      .from('user_squad_groups')
      .upsert({ user_id: session.user.id, groups })
    localStorage.setItem(`squad_sync_done_${session.user.id}`, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 z-20 flex items-center justify-center transition-opacity duration-200 ${dark ? 'bg-black/50' : 'bg-black/20'}`}
      onClick={close}
    >
      <div
        className={`${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'} p-4 rounded space-y-2 w-80`}
        onClick={(e) => e.stopPropagation()}
      >
        <p>ブラウザに保存された部隊データがあります。どのように同期しますか？</p>
        {diffNames.length > 0 && (
          <div className="max-h-60 overflow-auto border-t pt-2 mt-2 space-y-1 text-sm">
            {diffNames.map((n) => (
              <div key={n}>{n}</div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 pt-2">
          <button type="button" onClick={() => mergeToLocal('local')} className="border rounded px-2 py-1">
            ローカル優先でローカル環境に統合
          </button>
          <button type="button" onClick={() => mergeToLocal('db')} className="border rounded px-2 py-1">
            データベース優先でローカル環境に統合
          </button>
          <button type="button" onClick={() => mergeToDb('local')} className="border rounded px-2 py-1">
            ローカル優先でデータベースに統合
          </button>
          <button type="button" onClick={() => mergeToDb('db')} className="border rounded px-2 py-1">
            データベース優先でデータベースに統合
          </button>
          <button type="button" onClick={close} className="border rounded px-2 py-1">
            キャンセル
          </button>
        </div>
      </div>
    </div>
  )
}
