'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useTheme } from './ThemeProvider'
import students from '../data/students.json'

const nameMap: Record<string, string> = Object.fromEntries(
  (students as { id: string; name: string }[]).map((s) => [s.id, s.name])
)

interface UserStudent {
  level: number
  star: number
  unique_star: number
  unique_level: number
  bond: number
  hp: number
  hp_wb: number
  attack: number
  attack_wb: number
  defense: number
  heal: number
  heal_wb: number
  ex_skill: number
  normal_skill: number
  passive_skill: number
  sub_skill: number
  equip1: number
  equip2: number
  equip3: number
  item_tier: number
  alt_bonds?: Record<string, number>
}

export default function DataSyncModal() {
  const session = useSession()
  const supabase = useSupabaseClient()
  const { dark } = useTheme()
  const [visible, setVisible] = useState(false)
  const [localData, setLocalData] = useState<Record<string, UserStudent>>({})
  const [dbData, setDbData] = useState<Record<string, UserStudent>>({})
  const [diffIds, setDiffIds] = useState<string[]>([])
  const [diffMap, setDiffMap] = useState<
    Record<string, { field: string; local: unknown; db: unknown }[]>
  >({})

  useEffect(() => {
    const run = async () => {
      if (!session) return
      const doneKey = `sync_done_${session.user.id}`
      if (localStorage.getItem(doneKey)) return
      const local: Record<string, UserStudent> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('userStudent:')) {
          const id = key.substring('userStudent:'.length)
          const val = localStorage.getItem(key)
          if (val) {
            try {
              local[id] = JSON.parse(val) as UserStudent
            } catch {
              /* ignore */
            }
          }
        }
      }
      if (!Object.keys(local).length) {
        localStorage.setItem(doneKey, '1')
        return
      }
      setLocalData(local)
      const { data } = await supabase
        .from('user_students')
        .select('*')
        .eq('user_id', session.user.id)
      const db: Record<string, UserStudent> = {}
      if (data) {
        for (const row of data) {
          db[row.student_id as string] = row as unknown as UserStudent
        }
      }
      setDbData(db)
      const ids = new Set([...Object.keys(local), ...Object.keys(db)])
      const diff: string[] = []
      const map: Record<string, { field: string; local: unknown; db: unknown }[]> = {}
      ids.forEach((id) => {
        const l = local[id]
        const d = db[id]
        if (!l || !d || JSON.stringify(l) !== JSON.stringify(d)) {
          diff.push(id)
          const fields = new Set<keyof UserStudent>([
            ...(Object.keys(l || {}) as (keyof UserStudent)[]),
            ...(Object.keys(d || {}) as (keyof UserStudent)[]),
          ])
          const arr: { field: string; local: unknown; db: unknown }[] = []
          fields.forEach((f) => {
            const lv = l ? l[f] : undefined
            const dv = d ? d[f] : undefined
            const leq = typeof lv === 'object' ? JSON.stringify(lv) : lv
            const deq = typeof dv === 'object' ? JSON.stringify(dv) : dv
            if (leq !== deq) {
              arr.push({ field: f, local: lv, db: dv })
            }
          })
          map[id] = arr
        }
      })
      if (diff.length) {
        setDiffIds(diff)
        setDiffMap(map)
        setVisible(true)
      } else {
        localStorage.setItem(doneKey, '1')
      }
    }
    run()
  }, [session, supabase])

  const close = () => {
    if (session) {
      localStorage.setItem(`sync_done_${session.user.id}`, '1')
    }
    setVisible(false)
  }

  const mergeToLocal = (priority: 'local' | 'db') => {
    const ids = new Set([
      ...Object.keys(localData),
      ...Object.keys(dbData),
    ])
    ids.forEach((id) => {
      const local = localData[id]
      const db = dbData[id]
      const chosen =
        priority === 'local' ? local ?? db : db ?? local
      if (chosen) {
        localStorage.setItem(`userStudent:${id}`, JSON.stringify(chosen))
      }
    })
    if (session) localStorage.setItem(`sync_done_${session.user.id}`, '1')
    setVisible(false)
  }

  const mergeToDb = async (priority: 'local' | 'db') => {
    if (!session) return
    const ids = new Set([
      ...Object.keys(localData),
      ...Object.keys(dbData),
    ])
    for (const id of ids) {
      const local = localData[id]
      const db = dbData[id]
      const row = priority === 'local' ? local ?? db : db ?? local
      if (!row) continue
      await supabase.from('user_students').upsert({
        user_id: session.user.id,
        student_id: id,
        level: row.level,
        star: row.star,
        unique_star: row.unique_star,
        unique_level: row.unique_level,
        bond: row.bond,
        hp: row.hp,
        hp_wb: row.hp_wb,
        attack: row.attack,
        attack_wb: row.attack_wb,
        defense: row.defense,
        heal: row.heal,
        heal_wb: row.heal_wb,
        ex_skill: row.ex_skill,
        normal_skill: row.normal_skill,
        passive_skill: row.passive_skill,
        sub_skill: row.sub_skill,
        equip1: row.equip1,
        equip2: row.equip2,
        equip3: row.equip3,
        item_tier: row.item_tier,
        alt_bonds: row.alt_bonds || null,
      })
    }
    localStorage.setItem(`sync_done_${session.user.id}`, '1')
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
        <p>ブラウザに保存されたデータがあります。どのように同期しますか？</p>
        {diffIds.length > 0 && (
          <div className="max-h-60 overflow-auto space-y-4 border-t pt-2 mt-2">
            {diffIds.map((id) => (
              <div key={id}>
                <p className="text-sm font-bold">{nameMap[id] || id}</p>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="border px-1">項目</th>
                      <th className="border px-1">ローカル</th>
                      <th className="border px-1">データベース</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffMap[id]?.map((d) => (
                      <tr key={d.field}>
                        <td className="border px-1">{d.field}</td>
                        <td className="border px-1 bg-red-100 dark:bg-red-900">
                          {typeof d.local === 'object'
                            ? JSON.stringify(d.local)
                            : ((d.local ?? '-') as ReactNode)}
                        </td>
                        <td className="border px-1 bg-red-100 dark:bg-red-900">
                          {typeof d.db === 'object'
                            ? JSON.stringify(d.db)
                            : ((d.db ?? '-') as ReactNode)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={() => mergeToLocal('local')}
            className="border rounded px-2 py-1"
          >
            ローカル優先でローカル環境に統合
          </button>
          <button
            type="button"
            onClick={() => mergeToLocal('db')}
            className="border rounded px-2 py-1"
          >
            データベース優先でローカル環境に統合
          </button>
          <button
            type="button"
            onClick={() => mergeToDb('local')}
            className="border rounded px-2 py-1"
          >
            ローカル優先でデータベースに統合
          </button>
          <button
            type="button"
            onClick={() => mergeToDb('db')}
            className="border rounded px-2 py-1"
          >
            データベース優先でデータベースに統合
          </button>
          <button
            type="button"
            onClick={close}
            className="border rounded px-2 py-1"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  )
}

