'use client'

import { useState, useRef, useEffect } from 'react'
import { useTheme } from './ThemeProvider'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'

interface Student {
  id: string
  name: string
  image: string
  attackType: string
  defenseType: string
  hasAccessory?: boolean
}

interface AddStudentModalProps {
  addStudents: (students: Student[]) => void
  addStudent: (student: Student) => void
  close: () => void
}

export default function AddStudentModal({ addStudents, addStudent, close }: AddStudentModalProps) {
  const { dark } = useTheme()
  const [mode, setMode] = useState<'menu' | 'manual' | 'image'>('menu')
  const session = useSession()
  const supabase = useSupabaseClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)
  const [students, setStudents] = useState<Student[]>([])

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
    level: 1,
    star: 1,
    uniqueStar: 0,
    uniqueLevel: 0,
    bond: 1,
    hp: 0,
    hpwb: 0,
    attack: 0,
    attackwb: 0,
    defense: 0,
    heal: 0,
    healwb: 0,
    ex: 1,
    normal: 1,
    passive: 1,
    sub: 1,
    gear1: 1,
    gear2: 1,
    gear3: 1,
    love: 0,
  })

  useEffect(() => {
    if (form.star < 5) {
      setForm((prev) => ({ ...prev, uniqueStar: 0, uniqueLevel: 0 }))
    }
  }, [form.star])

  const selectedStudent = students.find((s) => s.id === form.studentId)

  useEffect(() => {
    if (selectedStudent && !selectedStudent.hasAccessory) {
      setForm((prev) => ({ ...prev, love: 0 }))
    }
  }, [selectedStudent])

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data: Student[] = JSON.parse(text)
      addStudents(data)
      close()
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
    })
    e.target.value = ''
    close()
  }

  const submitManual = async () => {
    if (!session) {
      alert('ログインが必要です')
      return
    }
    if (!form.studentId) return

    const { error } = await supabase.from('user_students').upsert({
      user_id: session.user.id,
      student_id: form.studentId,
      level: form.level,
      star: form.star,
      unique_star: form.uniqueStar,
      unique_level: form.uniqueLevel,
      bond: form.bond,
      hp: form.hp,
      hp_wb: form.hpwb,
      attack: form.attack,
      attack_wb: form.attackwb,
      defense: form.defense,
      heal: form.heal,
      heal_wb: form.healwb,
      ex_skill: form.ex,
      normal_skill: form.normal,
      passive_skill: form.passive,
      sub_skill: form.sub,
      equip1: form.gear1,
      equip2: form.gear2,
      equip3: form.gear3,
      item_tier: form.love,
    })
    if (error) {
      alert(error.message)
      return
    }
    const student = students.find((s) => s.id === form.studentId)
    if (student) {
      addStudent(student)
    }
    close()
  }

  return (
    <div
      className={`fixed inset-0 z-20 flex items-center justify-center ${dark ? 'bg-black/50' : 'bg-black/20'}`}
      onClick={close}
    >
      <div
        className={`${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'} p-4 rounded space-y-4 w-80`}
        onClick={(e) => e.stopPropagation()}
      >
        {mode === 'menu' && (
          <div className="space-y-2">
            <button type="button" className="border rounded w-full p-2" onClick={() => setMode('image')}>
              画像から追加
            </button>
            <button type="button" className="border rounded w-full p-2" onClick={() => setMode('manual')}>
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
            <select
              value={form.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              className="border rounded w-full p-1"
            >
              <option value="">生徒選択</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">レベル:</span>
              <input
                type="number"
                min={1}
                max={90}
                value={form.level}
                onChange={(e) =>
                  setForm({ ...form, level: Number(e.target.value) })
                }
                className="border rounded p-1 flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">星:</span>
              <input
                type="number"
                min={1}
                max={5}
                value={form.star}
                onChange={(e) =>
                  setForm({ ...form, star: Number(e.target.value) })
                }
                className="border rounded p-1 flex-1"
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
                  setForm({ ...form, uniqueStar: Number(e.target.value) })
                }
                disabled={form.star < 5}
                className="border rounded p-1 flex-1"
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
                  setForm({ ...form, uniqueLevel: Number(e.target.value) })
                }
                disabled={form.star < 5}
                className="border rounded p-1 flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">絆:</span>
              <input
                type="number"
                min={1}
                max={100}
                value={form.bond}
                onChange={(e) =>
                  setForm({ ...form, bond: Number(e.target.value) })
                }
                className="border rounded p-1 flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">HP:</span>
              <input
                type="number"
                value={form.hp}
                onChange={(e) => setForm({ ...form, hp: Number(e.target.value) })}
                className="border rounded p-1 flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">HPWB:</span>
              <input
                type="number"
                min={0}
                max={25}
                value={form.hpwb}
                onChange={(e) => setForm({ ...form, hpwb: Number(e.target.value) })}
                className="border rounded p-1 flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">攻撃力:</span>
              <input
                type="number"
                value={form.attack}
                onChange={(e) => setForm({ ...form, attack: Number(e.target.value) })}
                className="border rounded p-1 flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">攻撃力WB:</span>
              <input
                type="number"
                min={0}
                max={25}
                value={form.attackwb}
                onChange={(e) => setForm({ ...form, attackwb: Number(e.target.value) })}
                className="border rounded p-1 flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">防御力:</span>
              <input
                type="number"
                value={form.defense}
                onChange={(e) => setForm({ ...form, defense: Number(e.target.value) })}
                className="border rounded p-1 flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">治癒力:</span>
              <input
                type="number"
                value={form.heal}
                onChange={(e) => setForm({ ...form, heal: Number(e.target.value) })}
                className="border rounded p-1 flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">治癒力WB:</span>
              <input
                type="number"
                min={0}
                max={25}
                value={form.healwb}
                onChange={(e) => setForm({ ...form, healwb: Number(e.target.value) })}
                className="border rounded p-1 flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">EXスキルレベル:</span>
              <input
                type="number"
                min={1}
                max={5}
                value={form.ex}
                onChange={(e) => setForm({ ...form, ex: Number(e.target.value) })}
                className="border rounded p-1 flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">ノーマルスキルレベル:</span>
              <input
                type="number"
                min={1}
                max={10}
                value={form.normal}
                onChange={(e) =>
                  setForm({ ...form, normal: Number(e.target.value) })
                }
                className="border rounded p-1 flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">パッシブスキルレベル:</span>
              <input
                type="number"
                min={1}
                max={10}
                value={form.passive}
                onChange={(e) =>
                  setForm({ ...form, passive: Number(e.target.value) })
                }
                className="border rounded p-1 flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">サブスキルレベル:</span>
              <input
                type="number"
                min={1}
                max={10}
                value={form.sub}
                onChange={(e) => setForm({ ...form, sub: Number(e.target.value) })}
                className="border rounded p-1 flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">装備1Tier:</span>
              <input
                type="number"
                min={1}
                max={10}
                value={form.gear1}
                onChange={(e) => setForm({ ...form, gear1: Number(e.target.value) })}
                className="border rounded p-1 flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">装備2Tier:</span>
              <input
                type="number"
                min={1}
                max={10}
                value={form.gear2}
                onChange={(e) => setForm({ ...form, gear2: Number(e.target.value) })}
                className="border rounded p-1 flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">装備3Tier:</span>
              <input
                type="number"
                min={1}
                max={9}
                value={form.gear3}
                onChange={(e) => setForm({ ...form, gear3: Number(e.target.value) })}
                className="border rounded p-1 flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">愛用品Tier:</span>
              <input
                type="number"
                min={0}
                max={2}
                value={form.love}
                onChange={(e) => setForm({ ...form, love: Number(e.target.value) })}
                disabled={!selectedStudent?.hasAccessory}
                className="border rounded p-1 flex-1"
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

