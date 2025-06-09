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
    unique: 0,
    attack: 0,
  })

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
      unique_weapon: form.unique,
      attack_power: form.attack,
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
          <div className="space-y-2">
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
            <input
              type="number"
              value={form.level}
              onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}
              placeholder="レベル"
              className="border rounded w-full p-1"
            />
            <input
              type="number"
              value={form.star}
              onChange={(e) => setForm({ ...form, star: Number(e.target.value) })}
              placeholder="星"
              className="border rounded w-full p-1"
            />
            <input
              type="number"
              value={form.unique}
              onChange={(e) => setForm({ ...form, unique: Number(e.target.value) })}
              placeholder="固有武器レベル"
              className="border rounded w-full p-1"
            />
            <input
              type="number"
              value={form.attack}
              onChange={(e) => setForm({ ...form, attack: Number(e.target.value) })}
              placeholder="攻撃力"
              className="border rounded w-full p-1"
            />
            <div className="flex gap-2">
              <button type="button" onClick={submitManual} className="border rounded px-2 py-1">
                追加
              </button>
              <button type="button" onClick={() => setMode('menu')} className="border rounded px-2 py-1">
                戻る
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

