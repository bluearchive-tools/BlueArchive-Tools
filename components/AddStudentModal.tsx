'use client'

import { useState, useRef } from 'react'
import { useTheme } from './ThemeProvider'

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
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<Student>({
    id: '',
    name: '',
    image: '',
    attackType: '',
    defenseType: '',
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

  const submitManual = () => {
    if (!form.id || !form.name) return
    addStudent(form)
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
            <input
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
              placeholder="ID"
              className="border rounded w-full p-1"
            />
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="名前"
              className="border rounded w-full p-1"
            />
            <input
              value={form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
              placeholder="画像URL"
              className="border rounded w-full p-1"
            />
            <input
              value={form.attackType}
              onChange={(e) => setForm({ ...form, attackType: e.target.value })}
              placeholder="攻撃属性"
              className="border rounded w-full p-1"
            />
            <input
              value={form.defenseType}
              onChange={(e) => setForm({ ...form, defenseType: e.target.value })}
              placeholder="防御属性"
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

