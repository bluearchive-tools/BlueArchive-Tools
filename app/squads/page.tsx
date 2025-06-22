'use client'

import { useEffect, useState } from 'react'
import StudentSelect from '../../components/StudentSelect'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlus,
  faFloppyDisk,
  faXmark,
  faPen,
  faGripVertical,
  faNoteSticky,
  faArrowUp,
  faArrowDown,
  faLink,
  faCopy,
} from '@fortawesome/free-solid-svg-icons'

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
  memo?: string
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
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [editing, setEditing] = useState<{ gid: string; index: number } | null>(null)
  const [form, setForm] = useState<Squad>({ strikers: ['', '', '', ''], specials: ['', ''], memo: '' })
  const [memoTarget, setMemoTarget] = useState<{ gid: string; index: number } | null>(null)
  const [memoValue, setMemoValue] = useState('')
  const [dragInfo, setDragInfo] = useState<
    { gid: string; sIndex: number; role: 'striker' | 'special'; index: number } | null
  >(null)
  const [touchSquad, setTouchSquad] = useState<{ gid: string; index: number } | null>(null)
  const [sharedGroup, setSharedGroup] = useState<SquadGroup | null>(null)
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const share = params.get('share')
    if (share) {
      try {
        const decoded = decompressFromEncodedURIComponent(share)
        if (decoded) {
          const g: SquadGroup = JSON.parse(decoded)
          setSharedGroup(g)
        }
      } catch {
        /* ignore */
      }
    }
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

  const saveSquad = async () => {
    if (!editing) return
    if (!form.strikers.some((s) => s)) return
    const newGroups = groups.map((g) => {
      if (g.id !== editing.gid) return g
      const squads = [...g.squads]
      const data: Squad = {
        strikers: [...form.strikers],
        specials: [...form.specials],
        memo: form.memo,
      }
      if (editing.index >= 0) {
        squads[editing.index] = data
      } else {
        squads.push(data)
      }
      return { ...g, squads }
    })
    setGroups(newGroups)
    setEditing(null)
    setForm({ strikers: ['', '', '', ''], specials: ['', ''], memo: '' })
    await saveGroups(newGroups)
  }

  const cancelEdit = () => {
    setEditing(null)
    setForm({ strikers: ['', '', '', ''], specials: ['', ''], memo: '' })
  }

  const saveMemo = async () => {
    if (!memoTarget) return
    const newGroups = groups.map((g) => {
      if (g.id !== memoTarget.gid) return g
      const squads = [...g.squads]
      const sq = squads[memoTarget.index]
      squads[memoTarget.index] = { ...sq, memo: memoValue }
      return { ...g, squads }
    })
    setGroups(newGroups)
    setMemoTarget(null)
    setMemoValue('')
    await saveGroups(newGroups)
  }

  const saveGroupName = async () => {
    if (!renameId) return
    const name = renameValue.trim()
    if (!name) return
    const newGroups = groups.map((g) =>
      g.id === renameId ? { ...g, name } : g
    )
    setGroups(newGroups)
    setRenameId(null)
    setRenameValue('')
    await saveGroups(newGroups)
  }

  const findStudent = (id: string) => students.find((s) => s.id === id)

  const handleStudentDrop = (
    gid: string,
    sIndex: number,
    role: 'striker' | 'special',
    index: number
  ) => {
    if (
      !dragInfo ||
      dragInfo.gid !== gid ||
      dragInfo.sIndex !== sIndex ||
      dragInfo.role !== role ||
      dragInfo.index === index
    )
      return
    const newGroups = groups.map((g) => {
      if (g.id !== gid) return g
      const arr = [...g.squads]
      const sq = { ...arr[sIndex] }
      const list = role === 'striker' ? [...sq.strikers] : [...sq.specials]
      const temp = list[dragInfo.index]
      list[dragInfo.index] = list[index]
      list[index] = temp
      if (role === 'striker') {
        sq.strikers = list
      } else {
        sq.specials = list
      }
      arr[sIndex] = sq
      return { ...g, squads: arr }
    })
    setGroups(newGroups)
    saveGroups(newGroups)
    setDragInfo(null)
  }

  const moveUp = (gid: string, index: number) => {
    if (index === 0) return
    const newGroups = groups.map((g) => {
      if (g.id !== gid) return g
      const arr = [...g.squads]
      ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
      return { ...g, squads: arr }
    })
    setGroups(newGroups)
    saveGroups(newGroups)
  }

  const moveDown = (gid: string, index: number) => {
    const group = groups.find((g) => g.id === gid)
    if (!group || index >= group.squads.length - 1) return
    const newGroups = groups.map((g) => {
      if (g.id !== gid) return g
      const arr = [...g.squads]
      ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
      return { ...g, squads: arr }
    })
    setGroups(newGroups)
    saveGroups(newGroups)
  }

  const copyShareLink = (g: SquadGroup) => {
    const encoded = compressToEncodedURIComponent(JSON.stringify(g))
    const url = `${location.origin}/squads?share=${encoded}`
    navigator.clipboard.writeText(url)
      .then(() => alert('リンクをコピーしました'))
      .catch(() => alert('コピーに失敗しました'))
  }

  const importSharedGroup = async () => {
    if (!sharedGroup) return
    const newG: SquadGroup = {
      ...sharedGroup,
      id: Date.now().toString(),
    }
    const newGroups = [...groups, newG]
    setGroups(newGroups)
    await saveGroups(newGroups)
    alert('保存しました')
  }

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
          <FontAwesomeIcon icon={faPlus} />
        </button>
      </div>
      {sharedGroup && (
        <div className="border rounded p-2 space-y-2 relative">
          <h3 className="font-bold">{sharedGroup.name}</h3>
          <button
            type="button"
            onClick={importSharedGroup}
            className="absolute right-2 top-2 border rounded p-1"
            aria-label="コピー"
          >
            <FontAwesomeIcon icon={faCopy} />
          </button>
          {sharedGroup.squads.map((sq, i) => (
            <div
              key={i}
              className="border p-2 relative flex flex-col items-center"
            >
              <div className="absolute left-2 top-1 text-sm flex gap-2 items-center">
                <span>部隊{i + 1}</span>
                {sq.memo && <span>{sq.memo}</span>}
              </div>
              <div className="mt-4 grid grid-cols-6 gap-1">
                {sq.strikers.map((id, idx) => {
                  const st = findStudent(id)
                  return id && st ? (
                    <img
                      key={`s-${idx}`}
                      src={st.image}
                      alt={st.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div key={`s-${idx}`} className="w-12 h-12 border rounded" />
                  )
                })}
                {sq.specials.map((id, idx) => {
                  const st = findStudent(id)
                  return id && st ? (
                    <img
                      key={`p-${idx}`}
                      src={st.image}
                      alt={st.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div key={`p-${idx}`} className="w-12 h-12 border rounded" />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {groups.map((g) => {
        const used = new Set<string>()
        g.squads.forEach((sq, si) => {
          if (editing && editing.gid === g.id && editing.index === si) return
          ;[...sq.strikers, ...sq.specials].forEach((id) => {
            if (id) used.add(id)
          })
        })
        const availableStrikers = strikers.filter((s) => !used.has(s.id))
        const availableSpecials = specials.filter((s) => !used.has(s.id))
        return (
          <div key={g.id} className="border rounded p-2 space-y-2">
            {renameId === g.id ? (
              <div className="flex gap-2 items-center justify-end">
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="border rounded p-1 flex-1"
                />
                <button type="button" onClick={saveGroupName} className="border rounded p-1">
                  <FontAwesomeIcon icon={faFloppyDisk} />
                </button>
                <button type="button" onClick={() => setRenameId(null)} className="border rounded p-1">
                  <FontAwesomeIcon icon={faXmark} />
                </button>
                <button
                  type="button"
                  onClick={() => copyShareLink(g)}
                  className="border rounded p-1"
                  aria-label="共有リンク"
                >
                  <FontAwesomeIcon icon={faLink} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 justify-end">
                <h3 className="font-bold flex-1">{g.name}</h3>
                <button
                  type="button"
                  onClick={() => {
                    setRenameId(g.id)
                    setRenameValue(g.name)
                  }}
                  className="border rounded p-1"
                  aria-label="グループ名変更"
                >
                  <FontAwesomeIcon icon={faPen} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing({ gid: g.id, index: -1 })
                    setForm({ strikers: ['', '', '', ''], specials: ['', ''], memo: '' })
                  }}
                  className="border rounded p-1"
                  aria-label="部隊追加"
                >
                  <FontAwesomeIcon icon={faPlus} />
                </button>
                <button
                  type="button"
                  onClick={() => copyShareLink(g)}
                  className="border rounded p-1"
                  aria-label="共有リンク"
                >
                  <FontAwesomeIcon icon={faLink} />
                </button>
              </div>
            )}
            {g.squads.map((sq, i) => (
              <div
                key={i}
                className="border p-2 relative"
                draggable
                data-sindex={i}
                onDragStart={(e) => e.dataTransfer.setData('text/plain', i.toString())}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const from = Number(e.dataTransfer.getData('text/plain'))
                  if (from === i) return
                  const newGroups = groups.map((gg) => {
                    if (gg.id !== g.id) return gg
                    const arr = [...gg.squads]
                    const [item] = arr.splice(from, 1)
                    arr.splice(i, 0, item)
                    return { ...gg, squads: arr }
                  })
                  setGroups(newGroups)
                  saveGroups(newGroups)
                }}
                onTouchStart={() => setTouchSquad({ gid: g.id, index: i })}
                onTouchEnd={(e) => {
                  if (!touchSquad) return
                  const t = e.changedTouches[0]
                  const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null
                  const target = el?.closest('[data-sindex]') as HTMLElement | null
                  if (target && target.dataset.sindex) {
                    const to = Number(target.dataset.sindex)
                    const from = touchSquad.index
                    if (to !== from && touchSquad.gid === g.id) {
                      const newGroups = groups.map((gg) => {
                        if (gg.id !== g.id) return gg
                        const arr = [...gg.squads]
                        const [item] = arr.splice(from, 1)
                        arr.splice(to, 0, item)
                        return { ...gg, squads: arr }
                      })
                      setGroups(newGroups)
                      saveGroups(newGroups)
                    }
                  }
                  setTouchSquad(null)
                }}
              >
                <div className="absolute left-2 top-1 text-sm flex gap-2 items-center">
                  <span>部隊{i + 1}</span>
                  {sq.memo && <span>{sq.memo}</span>}
                </div>
                <div className="mt-4 flex items-start gap-2">
                  <div className="grid grid-cols-6 gap-1">
                  {sq.strikers.map((id, idx) => {
                    const st = findStudent(id)
                    return (
                      <div
                        key={`st-${idx}`}
                        className="w-12 h-12 border rounded overflow-hidden"
                        draggable
                        data-role="striker"
                        data-idx={idx}
                        onDragStart={(e) => {
                          e.stopPropagation()
                          setDragInfo({ gid: g.id, sIndex: i, role: 'striker', index: idx })
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.stopPropagation()
                          handleStudentDrop(g.id, i, 'striker', idx)
                        }}
                        onTouchStart={() =>
                          setDragInfo({ gid: g.id, sIndex: i, role: 'striker', index: idx })
                        }
                        onTouchEnd={(e) => {
                          const t = e.changedTouches[0]
                          const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null
                          const target = el?.closest('[data-role="striker"]') as HTMLElement | null
                          if (target && target.dataset.idx) {
                            handleStudentDrop(g.id, i, 'striker', Number(target.dataset.idx))
                          }
                          setDragInfo(null)
                        }}
                      >
                        {id && st && (
                          <img
                            src={st.image}
                            alt={st.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    )
                  })}
                  {sq.specials.map((id, idx) => {
                    const st = findStudent(id)
                    return (
                      <div
                        key={`sp-${idx}`}
                        className="w-12 h-12 border rounded overflow-hidden"
                        draggable
                        data-role="special"
                        data-idx={idx}
                        onDragStart={(e) => {
                          e.stopPropagation()
                          setDragInfo({ gid: g.id, sIndex: i, role: 'special', index: idx })
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.stopPropagation()
                          handleStudentDrop(g.id, i, 'special', idx)
                        }}
                        onTouchStart={() =>
                          setDragInfo({ gid: g.id, sIndex: i, role: 'special', index: idx })
                        }
                        onTouchEnd={(e) => {
                          const t = e.changedTouches[0]
                          const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null
                          const target = el?.closest('[data-role="special"]') as HTMLElement | null
                          if (target && target.dataset.idx) {
                            handleStudentDrop(g.id, i, 'special', Number(target.dataset.idx))
                          }
                          setDragInfo(null)
                        }}
                      >
                        {id && st && (
                          <img
                            src={st.image}
                            alt={st.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing({ gid: g.id, index: i })
                      setForm(sq)
                    }}
                    className="border rounded p-1"
                    aria-label="編集"
                  >
                    <FontAwesomeIcon icon={faPen} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMemoTarget({ gid: g.id, index: i })
                      setMemoValue(sq.memo ?? '')
                    }}
                    className="border rounded p-1"
                    aria-label="メモ編集"
                  >
                    <FontAwesomeIcon icon={faNoteSticky} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveUp(g.id, i)}
                    className="border rounded p-1"
                    aria-label="上へ移動"
                  >
                    <FontAwesomeIcon icon={faArrowUp} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(g.id, i)}
                    className="border rounded p-1"
                    aria-label="下へ移動"
                  >
                    <FontAwesomeIcon icon={faArrowDown} />
                  </button>
                  <span className="cursor-move p-1" aria-hidden="true">
                    <FontAwesomeIcon icon={faGripVertical} />
                  </span>
                </div>
              </div>
              {memoTarget && memoTarget.gid === g.id && memoTarget.index === i && (
                  <div className="mt-2 flex gap-2 w-full">
                    <input
                      type="text"
                      value={memoValue}
                      onChange={(e) => setMemoValue(e.target.value)}
                      className="border rounded p-1 flex-1"
                    />
                    <button type="button" onClick={saveMemo} className="border rounded p-1">
                      <FontAwesomeIcon icon={faFloppyDisk} />
                    </button>
                    <button type="button" onClick={() => setMemoTarget(null)} className="border rounded p-1">
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {editing && editing.gid === g.id && (
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <span className="whitespace-nowrap text-sm">メモ</span>
                  <input
                    type="text"
                    value={form.memo}
                    onChange={(e) => setForm({ ...form, memo: e.target.value })}
                    className="border rounded p-1 flex-1"
                  />
                </label>
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
                  <button type="button" onClick={saveSquad} className="border rounded px-2 py-1">
                    <FontAwesomeIcon icon={faFloppyDisk} />
                  </button>
                  <button type="button" onClick={cancelEdit} className="border rounded px-2 py-1">
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </main>
  )
}

