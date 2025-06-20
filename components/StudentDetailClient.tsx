'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import StudentUserData from './StudentUserData'

interface Student {
  id: string
  name: string
  styleIds?: string[]
  styleOf?: string
}

export default function StudentDetailClient({ studentId }: { studentId: string }) {
  const [editMode, setEditMode] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [current, setCurrent] = useState(studentId)

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

  const student = students.find((s) => s.id === current)
  const baseId = student?.styleOf || student?.id
  const styles = students.filter((s) => (s.styleOf || s.id) === baseId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/students" aria-label="一覧に戻る" className="text-lg inline-block">
          <FontAwesomeIcon icon={faArrowLeft} />
        </Link>
        <label className="inline-flex items-center gap-1 text-sm">
          <span>編集</span>
          <input
            type="checkbox"
            checked={editMode}
            onChange={(e) => setEditMode(e.target.checked)}
            className="form-checkbox"
          />
        </label>
      </div>
      {styles.length > 1 && (
        <select
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="border rounded p-1"
        >
          {styles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      <StudentUserData studentId={current} editMode={editMode} />
    </div>
  )
}
