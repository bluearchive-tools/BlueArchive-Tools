'use client'

import { useEffect, useState } from 'react'
import StudentSelect from '../../components/StudentSelect'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'

interface Student {
  id: string
  name: string
  image: string
  attackType: string
  defenseType: string
  hasAccessory?: boolean
  styleIds?: string[]
  styleOf?: string
  altIds?: string[]
  altOf?: string
  initialStars: number
  role: string
  characterType: string
  position: string
}

interface Squad {
  strikers: string[]
  specials: string[]
}

interface SquadGroup {
  id: string
  name: string
  squads: Squad[]
}

export default function SquadPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [groups, setGroups] = useState<SquadGroup[]>([])
  const [groupName, setGroupName] = useState('')
  const [editGroup, setEditGroup] = useState<string | null>(null)
  const [form, setForm] = useState<Squad>({ strikers: ['', '', '', ''], specials: ['', ''] })
  const session = useSession()
  const supabase = useSupabaseClient()

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/students')
        if (res.ok) setStudents(await res.json())
      } catch {
        /* ignore */
      }
    }
    load()
  }, [])

  const loadGroups = async () => {
    if (session) {
      const { data } = await supabase
        .from('user_squad_groups')
        .select('groups')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (data) setGroups((data as { groups: SquadGroup[] }).groups || [])
    } else {
      const raw = localStorage.getItem('squadGroups')
      if (raw) {
        try { setGroups(JSON.parse(raw) as SquadGroup[]) } catch { /* ignore */ }
      }
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadGroups() }, [session])

  const saveGroups = async (gs: SquadGroup[]) => {
    if (session) {
      await supabase.from('user_squad_groups').upsert({ user_id: session.user.id, groups: gs })
    } else {
      localStorage.setItem('squadGroups', JSON.stringify(gs))
    }
  }

  const addGroup = async () => {
    if (!groupName.trim()) return
    const g: SquadGroup = { id: Date.now().toString(), name: groupName.trim(), squads: [] }
    const newGroups = [...groups, g]
    setGroups(newGroups)
    setGroupName('')
    await saveGroups(newGroups)
  }

  const addSquad = async (gid: string) => {
    if (!form.strikers.some((s) => s)) return
    const newSquad: Squad = { strikers: [...form.strikers], specials: [...form.specials] }
    const newGroups = groups.map((g) =>
      g.id === gid ? { ...g, squads: [...g.squads, newSquad] } : g
    )
    setGroups(newGroups)
    setEditGroup(null)
    setForm({ strikers: ['', '', '', ''], specials: ['', ''] })
    await saveGroups(newGroups)
  }

  const findStudent = (id: string) => students.find((s) => s.id === id)

  const strikers = students.filter((s) => s.role === 'STRIKER')
  const specials = students.filter((s) => s.role === 'SPECIAL')

  return (
    <main className="p-4 space-y-4">
      <h2 className="text-xl">部隊管理</h2>
      <div className="flex gap-2">
        <input
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="グループ名"
          className="border rounded p-1 flex-1"
        />
        <button type="button" onClick={addGroup} className="border rounded px-2 py-1">
          追加
        </button>
      </div>
      {groups.map((g) => {
        const used = new Set<string>()
        g.squads.forEach((sq) => {
          ;[...sq.strikers, ...sq.specials].forEach((id) => {
            if (id) used.add(id)
          })
        })
        const availableStrikers = strikers.filter((s) => !used.has(s.id))
        const availableSpecials = specials.filter((s) => !used.has(s.id))
        return (
          <div key={g.id} className="border rounded p-2 space-y-2">
            <h3 className="font-bold">{g.name}</h3>
            {g.squads.map((sq, i) => (
              <div key={i} className="border p-2">
                <div className="grid grid-cols-6 gap-1">
                  {sq.strikers.map((id, idx) => {
                    const st = findStudent(id)
                    return id && st ? (
                      <img
                        key={`st-${idx}`}
                        src={st.image}
                        alt={st.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div key={`st-${idx}`} className="w-12 h-12 border rounded" />
                    )
                  })}
                  {sq.specials.map((id, idx) => {
                    const st = findStudent(id)
                    return id && st ? (
                      <img
                        key={`sp-${idx}`}
                        src={st.image}
                        alt={st.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div key={`sp-${idx}`} className="w-12 h-12 border rounded" />
                    )
                  })}
                </div>
              </div>
            ))}
            {editGroup === g.id ? (
              <div className="space-y-2">
                {form.strikers.map((v, i) => (
                  <StudentSelect
                    key={`st${i}`}
                    students={availableStrikers}
                    value={v}
                    onChange={(id) =>
                      setForm((prev) => ({
                        ...prev,
                        strikers: prev.strikers.map((x, j) => (i === j ? id : x)),
                      }))
                    }
                  />
                ))}
                {form.specials.map((v, i) => (
                  <StudentSelect
                    key={`sp${i}`}
                    students={availableSpecials}
                    value={v}
                    onChange={(id) =>
                      setForm((prev) => ({
                        ...prev,
                        specials: prev.specials.map((x, j) => (i === j ? id : x)),
                      }))
                    }
                  />
                ))}
                <div className="flex gap-2">
                  <button type="button" onClick={() => addSquad(g.id)} className="border rounded px-2 py-1">
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditGroup(null)
                      setForm({ strikers: ['', '', '', ''], specials: ['', ''] })
                    }}
                    className="border rounded px-2 py-1"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setEditGroup(g.id)} className="border rounded px-2 py-1">
                部隊追加
              </button>
            )}
          </div>
        )
      })}
    </main>
  )
}

