'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import StudentUserData from './StudentUserData'
import AddStudentModal from './AddStudentModal'
import {
  useSession,
  useSupabaseClient,
} from '@supabase/auth-helpers-react'

interface Student {
  id: string
  name: string
  styleIds?: string[]
  styleOf?: string
  altOf?: string
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

export default function StudentDetailClient({ studentId }: { studentId: string }) {
  const session = useSession()
  const supabase = useSupabaseClient()
  const [editMode, setEditMode] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [current, setCurrent] = useState(studentId)
  const [registered, setRegistered] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [previewMax, setPreviewMax] = useState(false)

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

  const checkRegistered = useCallback(async () => {
    const student = students.find((s) => s.id === current)
    const mainId = student?.styleOf || current
    if (session) {
      const { data } = await supabase
        .from('user_students')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('student_id', current)
        .maybeSingle()
      if (!data && mainId !== current) {
        const { data: alt } = await supabase
          .from('user_students')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('student_id', mainId)
          .maybeSingle()
        setRegistered(!!alt)
      } else {
        setRegistered(!!data)
      }
    } else {
      let local = localStorage.getItem(`userStudent:${current}`)
      if (!local && mainId !== current) {
        local = localStorage.getItem(`userStudent:${mainId}`)
      }
      setRegistered(!!local)
    }
  }, [session, supabase, students, current])

  useEffect(() => {
    if (students.length) {
      checkRegistered()
    }
  }, [checkRegistered, students])

  const student = students.find((s) => s.id === current)
  const baseId = student?.styleOf || student?.id
  const styles = students.filter((s) => (s.styleOf || s.id) === baseId)

  const refreshRegistered = useCallback(async () => {
    await checkRegistered()
  }, [checkRegistered])

  const exportData = useCallback(async () => {
    const student = students.find((s) => s.id === current)
    const baseId = student?.styleOf || current
    let obj: UserStudent | null = null
    if (session) {
      let { data } = await supabase
        .from('user_students')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('student_id', current)
        .maybeSingle()
      if (!data && baseId !== current) {
        const { data: alt } = await supabase
          .from('user_students')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('student_id', baseId)
          .maybeSingle()
        data = alt || null
      }
      obj = (data as UserStudent) || null
    } else {
      let raw = localStorage.getItem(`userStudent:${current}`)
      if (!raw && baseId !== current) {
        raw = localStorage.getItem(`userStudent:${baseId}`)
      }
      if (raw) {
        try {
          obj = JSON.parse(raw) as UserStudent
        } catch {
          obj = null
        }
      }
    }
    const out = obj ? { studentId: current, data: obj } : { studentId: current }
    const blob = new Blob([JSON.stringify(out)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${student?.name || current}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [students, current, session, supabase])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Link href="/students" aria-label="一覧に戻る" className="text-lg inline-block">
          <FontAwesomeIcon icon={faArrowLeft} />
        </Link>
        <div className="flex items-center gap-2">
          {!registered && (
            <button
              type="button"
              onClick={() => setPreviewMax((p) => !p)}
              className="border rounded px-2 py-1 text-sm"
            >
              {previewMax ? '最小' : '最大'}プレビュー
            </button>
          )}
          {registered ? (
            <label className="inline-flex items-center gap-1 text-sm">
              <span>編集</span>
              <input
                type="checkbox"
                checked={editMode}
                onChange={(e) => setEditMode(e.target.checked)}
                className="form-checkbox"
              />
            </label>
          ) : (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="border rounded px-2 py-1 text-sm"
            >
              追加
            </button>
          )}
          <button
            type="button"
            onClick={exportData}
            className="border rounded px-2 py-1 text-sm"
          >
            エクスポート
          </button>
        </div>
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
      <StudentUserData
        studentId={current}
        editMode={registered ? editMode : false}
        previewMax={!registered && previewMax}
      />
      {addOpen && (
        <AddStudentModal
          addStudents={(arr) => setStudents((prev) => [...prev, ...arr])}
          addStudent={(s) => setStudents((prev) => [...prev, s])}
          onAdded={refreshRegistered}
          close={() => setAddOpen(false)}
          defaultStudentId={current}
        />
      )}
    </div>
  )
}
