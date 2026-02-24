'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTheme } from './ThemeProvider'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import StudentSelect from './StudentSelect'

interface Student {
  id: string
  name: string
  image: string
  imageFull?: string
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
  exHitDelay?: number
  normalHitDelay?: number
}

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

interface AddStudentModalProps {
  addStudents: (students: Student[]) => void
  addStudent: (student: Student) => void
  onAdded: () => void
  close: () => void
  defaultStudentId?: string
}

export default function AddStudentModal({
  addStudents,
  addStudent,
  onAdded,
  close,
  defaultStudentId,
}: AddStudentModalProps) {
  const { dark } = useTheme()
  const [mode, setMode] = useState<'menu' | 'manual' | 'image'>('menu')
  const [visible, setVisible] = useState(false)
  const session = useSession()
  const supabase = useSupabaseClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [existing, setExisting] = useState<UserStudent | null>(null)
  const userEditedRef = useRef(false)

  useEffect(() => {
    setVisible(true)
  }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(close, 200)
  }

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/students')
        if (res.ok) {
          setStudents(await res.json())
        }
      } catch {
        // ignore
      }
    }
    load()
  }, [])
  const [form, setForm] = useState({
    studentId: '',
    level: '1',
    star: '1',
    uniqueStar: '0',
    uniqueLevel: '0',
    hp: '',
    hpwb: '',
    attack: '',
    attackwb: '',
    defense: '',
    heal: '',
    healwb: '',
    ex: '1',
    normal: '1',
    passive: '1',
    sub: '1',
    gear1: '1',
    gear2: '1',
    gear3: '1',
    love: '0',
  })
  const [bonds, setBonds] = useState<Record<string, string>>({})

  const updateForm = useCallback(
    (next: Partial<typeof form>, markEdited = false) => {
      if (markEdited) userEditedRef.current = true
      setForm((prev) => ({ ...prev, ...next }))
    },
    []
  )

  const updateBond = useCallback(
    (id: string, value: string, markEdited = false) => {
      if (markEdited) userEditedRef.current = true
      setBonds((prev) => ({ ...prev, [id]: value }))
    },
    []
  )

  useEffect(() => {
    if (mode === 'manual' && defaultStudentId && !form.studentId) {
      updateForm({ studentId: defaultStudentId })
    }
  }, [mode, defaultStudentId, form.studentId, updateForm])

  useEffect(() => {
    if (Number(form.star) < 5) {
      updateForm({ uniqueStar: '0', uniqueLevel: '0' })
    }
  }, [form.star, updateForm])

  const selectedStudent = students.find((s) => s.id === form.studentId)

  useEffect(() => {
    if (selectedStudent) {
      updateForm({ star: selectedStudent.initialStars.toString() })
    }
  }, [selectedStudent, updateForm])

  useEffect(() => {
    if (!selectedStudent) return
    const baseId = selectedStudent.altOf || selectedStudent.id
    const base = students.find((s) => s.id === baseId)
    let ids: string[] = []
    if (selectedStudent.altOf) {
      ids = [
        selectedStudent.id,
        baseId,
        ...(base?.altIds?.filter((id) => id !== selectedStudent.id) || []),
      ]
    } else {
      ids = [baseId, ...(base?.altIds || [])]
    }
      setBonds((prev) => {
        const obj: Record<string, string> = {}
        for (const id of ids) {
          obj[id] = prev[id] ?? '1'
        }
        return obj
      })
  }, [selectedStudent, students])

  const baseId = selectedStudent?.altOf || selectedStudent?.id
  const baseStudent = baseId ? students.find((s) => s.id === baseId) : undefined
  let bondFieldIds: string[] = []
  if (selectedStudent && baseStudent) {
    if (selectedStudent.altOf) {
      bondFieldIds = [
        selectedStudent.id,
        baseId!,
        ...(baseStudent.altIds?.filter((id) => id !== selectedStudent.id) || []),
      ]
    } else {
      bondFieldIds = [baseId!, ...(baseStudent.altIds || [])]
    }
  }
  const bondFields = bondFieldIds.map((id) => {
    const a = students.find((s) => s.id === id)
    return { id, name: a ? a.name : id }
  })

  useEffect(() => {
    if (selectedStudent && !selectedStudent.hasAccessory) {
      updateForm({ love: '0' })
    }
  }, [selectedStudent, updateForm])

  useEffect(() => {
    const load = async () => {
      if (!form.studentId) {
        setExisting(null)
        return
      }
      if (session) {
        const { data } = await supabase
          .from('user_students')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('student_id', form.studentId)
          .maybeSingle()
        if (data) {
          const d = data as UserStudent
          setExisting(d)
          if (!userEditedRef.current) {
            setForm({
              studentId: form.studentId,
              level: d.level.toString(),
              star: d.star.toString(),
              uniqueStar: d.unique_star.toString(),
              uniqueLevel: d.unique_level.toString(),
              hp: d.hp.toString(),
              hpwb: d.hp_wb.toString(),
              attack: d.attack.toString(),
              attackwb: d.attack_wb.toString(),
              defense: d.defense.toString(),
              heal: d.heal.toString(),
              healwb: d.heal_wb.toString(),
              ex: d.ex_skill.toString(),
              normal: d.normal_skill.toString(),
              passive: d.passive_skill.toString(),
              sub: d.sub_skill.toString(),
              gear1: d.equip1.toString(),
              gear2: d.equip2.toString(),
              gear3: d.equip3.toString(),
              love: d.item_tier.toString(),
            })
          }
        const alt = d.alt_bonds || null
        if (selectedStudent) {
          const baseId = selectedStudent.altOf || selectedStudent.id
          const base = students.find((s) => s.id === baseId)
          let ids: string[] = []
          if (selectedStudent.altOf) {
            ids = [
              selectedStudent.id,
              baseId,
              ...(base?.altIds?.filter((id) => id !== selectedStudent.id) || []),
            ]
          } else {
            ids = [baseId, ...(base?.altIds || [])]
          }
          const obj: Record<string, string> = {}
          for (const id of ids) {
            if (alt && alt[id] !== undefined) {
              obj[id] = String(alt[id])
            } else if (id === selectedStudent.id) {
              obj[id] = d.bond.toString()
            } else if (id === baseId) {
              obj[id] = selectedStudent.id === baseId ? d.bond.toString() : String(alt?.[id] ?? d.bond)
            } else {
              obj[id] = '1'
            }
          }
          if (!userEditedRef.current) {
            setBonds(obj)
          }
        }
        } else {
          setExisting(null)
          if (selectedStudent) {
            const baseId = selectedStudent.altOf || selectedStudent.id
            if (selectedStudent.altOf) {
              const { data: baseRow } = await supabase
                .from('user_students')
                .select('*')
                .eq('user_id', session.user.id)
                .eq('student_id', baseId)
                .maybeSingle()
              if (baseRow) {
                const baseData = baseRow as UserStudent
                const alt = baseData.alt_bonds || null
                const ids = [
                  selectedStudent.id,
                  baseId,
                  ...((students.find((s) => s.id === baseId)?.altIds || []).filter(
                    (id) => id !== selectedStudent.id
                  )),
                ]
                const obj: Record<string, string> = {}
                for (const id of ids) {
                  if (id === selectedStudent.id) {
                    obj[id] = String(alt?.[id] ?? 1)
                  } else if (id === baseId) {
                    obj[id] = baseData.bond.toString()
                  } else {
                    obj[id] = String(alt?.[id] ?? 1)
                  }
                }
                setBonds(obj)
                return
              }
            }
            const base = students.find((s) => s.id === baseId)
            const ids = [
              baseId,
              ...((base?.altIds || []).filter((id) => id !== selectedStudent.id)),
            ]
            if (selectedStudent.altOf) ids.unshift(selectedStudent.id)
            const obj: Record<string, string> = {}
            for (const id of ids) {
              obj[id] = '1'
            }
            setBonds(obj)
          }
        }
      } else {
        const local = localStorage.getItem(`userStudent:${form.studentId}`)
        if (local) {
          try {
            const d = JSON.parse(local) as UserStudent
            setExisting(d)
            if (!userEditedRef.current) {
              setForm({
                studentId: form.studentId,
                level: d.level.toString(),
                star: d.star.toString(),
                uniqueStar: d.unique_star.toString(),
                uniqueLevel: d.unique_level.toString(),
                hp: d.hp.toString(),
                hpwb: d.hp_wb.toString(),
                attack: d.attack.toString(),
                attackwb: d.attack_wb.toString(),
                defense: d.defense.toString(),
                heal: d.heal.toString(),
                healwb: d.heal_wb.toString(),
                ex: d.ex_skill.toString(),
                normal: d.normal_skill.toString(),
                passive: d.passive_skill.toString(),
                sub: d.sub_skill.toString(),
                gear1: d.equip1.toString(),
                gear2: d.equip2.toString(),
                gear3: d.equip3.toString(),
                love: d.item_tier.toString(),
              })
            }
            const alt = d.alt_bonds || null
            if (selectedStudent) {
              const baseId = selectedStudent.altOf || selectedStudent.id
              const base = students.find((s) => s.id === baseId)
              let ids: string[] = []
              if (selectedStudent.altOf) {
                ids = [
                  selectedStudent.id,
                  baseId,
                  ...(base?.altIds?.filter((id) => id !== selectedStudent.id) || []),
                ]
              } else {
                ids = [baseId, ...(base?.altIds || [])]
              }
              const obj: Record<string, string> = {}
              for (const id of ids) {
                if (alt && alt[id] !== undefined) {
                  obj[id] = String(alt[id])
                } else if (id === selectedStudent.id) {
                  obj[id] = d.bond.toString()
                } else if (id === baseId) {
                  obj[id] = selectedStudent.id === baseId ? d.bond.toString() : String(alt?.[id] ?? d.bond)
                } else {
                  obj[id] = '1'
                }
              }
              if (!userEditedRef.current) {
                setBonds(obj)
              }
            }
          } catch {
            setExisting(null)
          }
        } else {
          setExisting(null)
        }
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.studentId, session, supabase])

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed: unknown = JSON.parse(text)

      if (Array.isArray(parsed)) {
        addStudents(parsed as Student[])
        handleClose()
        return
      }

      if (parsed && typeof parsed === 'object') {
        const entries = Object.entries(parsed as Record<string, unknown>)
        if (entries.length === 0) {
          alert('インポートデータが空です')
          return
        }

        if (session) {
          const rows = entries
            .filter(([studentId, v]) => !!studentId && !!v && typeof v === 'object')
            .map(([studentId, v]) => ({
              user_id: session.user.id,
              student_id: studentId,
              ...(v as Record<string, unknown>),
            }))
          if (rows.length === 0) {
            alert('取り込める生徒データが見つかりませんでした')
            return
          }
          const { error } = await supabase.from('user_students').upsert(rows)
          if (error) {
            alert(error.message)
            return
          }
        } else {
          let imported = 0
          for (const [studentId, v] of entries) {
            if (!studentId || !v || typeof v !== 'object') continue
            localStorage.setItem(`userStudent:${studentId}`, JSON.stringify(v))
            imported += 1
          }
          if (imported === 0) {
            alert('取り込める生徒データが見つかりませんでした')
            return
          }
        }

        onAdded()
        handleClose()
        return
      }

      alert('JSON形式が不正です')
      handleClose()
    } catch (err) {
      console.error(err)
    } finally {
      e.target.value = ''
    }
  }

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    addStudent({
      id: Date.now().toString(),
      name: '新規生徒',
      image: url,
      attackType: '',
      defenseType: '',
      initialStars: 1,
      role: 'STRIKER',
      characterType: 'タンク',
      position: 'FRONT',
    })
    e.target.value = ''
    handleClose()
  }

  const submitManual = async () => {
    if (!form.studentId) return

    if (existing) {
      const ok = confirm('既に登録されたデータがあります。上書きしますか?')
      if (!ok) return
    }

    const mainId = selectedStudent?.id || ''
    const altData: Record<string, number> = {}
    for (const [k, v] of Object.entries(bonds)) {
      altData[k] = Number(v) || 0
    }

    if (session) {
      const { error } = await supabase.from('user_students').upsert({
        user_id: session.user.id,
        student_id: form.studentId,
        level: Number(form.level) || 0,
        star: Number(form.star) || 0,
        unique_star: Number(form.uniqueStar) || 0,
        unique_level: Number(form.uniqueLevel) || 0,
        bond: altData[mainId] || 0,
        hp: Number(form.hp) || 0,
        hp_wb: Number(form.hpwb) || 0,
        attack: Number(form.attack) || 0,
        attack_wb: Number(form.attackwb) || 0,
        defense: Number(form.defense) || 0,
        heal: Number(form.heal) || 0,
        heal_wb: Number(form.healwb) || 0,
        ex_skill: Number(form.ex) || 0,
        normal_skill: Number(form.normal) || 0,
        passive_skill: Number(form.passive) || 0,
        sub_skill: Number(form.sub) || 0,
        equip1: Number(form.gear1) || 0,
        equip2: Number(form.gear2) || 0,
        equip3: Number(form.gear3) || 0,
        item_tier: Number(form.love) || 0,
        alt_bonds: altData,
      })
      if (error) {
        alert(error.message)
        return
      }
      onAdded()
      handleClose()
    } else {
      const obj = {
        level: Number(form.level) || 0,
        star: Number(form.star) || 0,
        unique_star: Number(form.uniqueStar) || 0,
        unique_level: Number(form.uniqueLevel) || 0,
        bond: altData[mainId] || 0,
        hp: Number(form.hp) || 0,
        hp_wb: Number(form.hpwb) || 0,
        attack: Number(form.attack) || 0,
        attack_wb: Number(form.attackwb) || 0,
        defense: Number(form.defense) || 0,
        heal: Number(form.heal) || 0,
        heal_wb: Number(form.healwb) || 0,
        ex_skill: Number(form.ex) || 0,
        normal_skill: Number(form.normal) || 0,
        passive_skill: Number(form.passive) || 0,
        sub_skill: Number(form.sub) || 0,
        equip1: Number(form.gear1) || 0,
        equip2: Number(form.gear2) || 0,
        equip3: Number(form.gear3) || 0,
        item_tier: Number(form.love) || 0,
        alt_bonds: altData,
      } as UserStudent
      localStorage.setItem(`userStudent:${form.studentId}`, JSON.stringify(obj))
      onAdded()
      handleClose()
    }
  }

  return (
    <div
      className={`fixed inset-0 z-20 flex items-center justify-center transition-opacity duration-200 ${dark ? 'bg-black/50' : 'bg-black/20'} ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      <div
        className={`${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'} p-4 rounded space-y-4 w-80 transform transition-all duration-200 ${visible ? 'scale-100' : 'scale-95'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {mode === 'menu' && (
          <div className="space-y-2">
            <button type="button" className="border rounded w-full p-2" onClick={() => setMode('image')}>
              画像から追加
            </button>
            <button
              type="button"
              className="border rounded w-full p-2"
              onClick={() => {
                userEditedRef.current = false
                setMode('manual')
                if (defaultStudentId) {
                  setForm((prev) => ({ ...prev, studentId: defaultStudentId }))
                }
              }}
            >
              手動追加
            </button>
            <button type="button" className="border rounded w-full p-2" onClick={() => fileRef.current?.click()}>
              インポート
            </button>
            <input
              type="file"
              accept="application/json"
              ref={fileRef}
              onChange={handleImport}
              className="hidden"
            />
            <input
              type="file"
              accept="image/*"
              ref={imgRef}
              onChange={handleImage}
              className="hidden"
            />
          </div>
        )}
        {mode === 'manual' && (
          <div className="space-y-2 overflow-y-auto max-h-[70vh]">
            <StudentSelect
              students={students}
              value={form.studentId}
              onChange={(id) => {
                userEditedRef.current = false
                updateForm({ studentId: id })
              }}
            />
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">レベル:</span>
              <input
                type="number"
                min={1}
                max={90}
                value={form.level}
                onChange={(e) => updateForm({ level: e.target.value }, true)}
                className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">星:</span>
              <input
                type="number"
                min={1}
                max={5}
                value={form.star}
                onChange={(e) => updateForm({ star: e.target.value }, true)}
                className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">固有武器星:</span>
              <input
                type="number"
                min={0}
                max={3}
                value={form.uniqueStar}
                onChange={(e) =>
                  updateForm({ uniqueStar: e.target.value }, true)
                }
                disabled={Number(form.star) < 5}
                className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">固有武器レベル:</span>
              <input
                type="number"
                min={1}
                max={50}
                value={form.uniqueLevel}
                onChange={(e) =>
                  updateForm({ uniqueLevel: e.target.value }, true)
                }
                disabled={Number(form.star) < 5}
                className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
              />
            </label>
            {bondFields.map(({ id, name }) => (
              <label key={id} className="flex items-center gap-2">
                <span className="whitespace-nowrap">
                  絆{selectedStudent?.id === id ? '' : `(${name})`}:
                </span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={bonds[id] ?? ''}
                  onChange={(e) =>
                    updateBond(id, e.target.value, true)
                  }
                  className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
                />
              </label>
            ))}
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">HP:</span>
              <input
                type="number"
                value={form.hp}
                onChange={(e) => updateForm({ hp: e.target.value }, true)}
                className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">HPWB:</span>
              <input
                type="number"
                min={0}
                max={25}
                value={form.hpwb}
                onChange={(e) => updateForm({ hpwb: e.target.value }, true)}
                className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">攻撃力:</span>
              <input
                type="number"
                value={form.attack}
                onChange={(e) => updateForm({ attack: e.target.value }, true)}
                className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">攻撃力WB:</span>
              <input
                type="number"
                min={0}
                max={25}
                value={form.attackwb}
                onChange={(e) => updateForm({ attackwb: e.target.value }, true)}
                className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">防御力:</span>
              <input
                type="number"
                value={form.defense}
                onChange={(e) => updateForm({ defense: e.target.value }, true)}
                className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">治癒力:</span>
              <input
                type="number"
                value={form.heal}
                onChange={(e) => updateForm({ heal: e.target.value }, true)}
                className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">治癒力WB:</span>
              <input
                type="number"
                min={0}
                max={25}
                value={form.healwb}
                onChange={(e) => updateForm({ healwb: e.target.value }, true)}
                className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">EXスキルレベル:</span>
              <input
                type="number"
                min={1}
                max={5}
                value={form.ex}
                onChange={(e) => updateForm({ ex: e.target.value }, true)}
                className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">ノーマルスキルレベル:</span>
              <input
                type="number"
                min={1}
                max={10}
                value={form.normal}
                onChange={(e) => updateForm({ normal: e.target.value }, true)}
                className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">パッシブスキルレベル:</span>
              <input
                type="number"
                min={1}
                max={10}
                value={form.passive}
                onChange={(e) => updateForm({ passive: e.target.value }, true)}
                className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">サブスキルレベル:</span>
              <input
                type="number"
                min={1}
                max={10}
                value={form.sub}
                onChange={(e) => updateForm({ sub: e.target.value }, true)}
                className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">装備1Tier:</span>
              <input
                type="number"
                min={1}
                max={10}
                value={form.gear1}
                onChange={(e) => updateForm({ gear1: e.target.value }, true)}
                className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">装備2Tier:</span>
              <input
                type="number"
                min={1}
                max={10}
                value={form.gear2}
                onChange={(e) => updateForm({ gear2: e.target.value }, true)}
                className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">装備3Tier:</span>
              <input
                type="number"
                min={1}
                max={9}
                value={form.gear3}
                onChange={(e) => updateForm({ gear3: e.target.value }, true)}
                className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">愛用品Tier:</span>
              <input
                type="number"
                min={0}
                max={2}
                value={form.love}
                onChange={(e) => updateForm({ love: e.target.value }, true)}
                disabled={!selectedStudent?.hasAccessory}
                className="border rounded p-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white flex-1"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={submitManual}
                className="border rounded px-2 py-1"
              >
                追加
              </button>
              <button
                type="button"
                onClick={() => setMode('menu')}
                className="border rounded px-2 py-1"
              >
                戻る
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
