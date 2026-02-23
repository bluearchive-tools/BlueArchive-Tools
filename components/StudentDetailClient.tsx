'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faBars } from '@fortawesome/free-solid-svg-icons'
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
  initialStars: number
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [previewMax, setPreviewMax] = useState(false)
  const [previewData, setPreviewData] = useState<UserStudent | null>(null)

  const buildPreviewData = useCallback(
    (initialStars: number, maxMode = false): UserStudent => ({
      level: maxMode ? 90 : 1,
      star: maxMode ? 5 : Math.max(1, Math.min(5, initialStars || 1)),
      unique_star: maxMode ? 4 : 0,
      unique_level: maxMode ? 60 : 0,
      bond: maxMode ? 100 : 0,
      hp: 0,
      hp_wb: maxMode ? 25 : 0,
      attack: 0,
      attack_wb: maxMode ? 25 : 0,
      defense: 0,
      heal: 0,
      heal_wb: maxMode ? 25 : 0,
      ex_skill: maxMode ? 5 : 1,
      normal_skill: maxMode ? 10 : 1,
      passive_skill: maxMode ? 10 : 1,
      sub_skill: maxMode ? 10 : 1,
      equip1: maxMode ? 10 : 1,
      equip2: maxMode ? 10 : 1,
      equip3: maxMode ? 9 : 1,
      item_tier: maxMode ? 2 : 0,
    }),
    []
  )

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

  useEffect(() => {
    if (!student) return
    setPreviewData(buildPreviewData(student.initialStars, previewMax))
  }, [student, previewMax, buildPreviewData])

  const refreshRegistered = useCallback(async () => {
    await checkRegistered()
  }, [checkRegistered])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Link href="/students" aria-label="一覧に戻る" className="text-lg inline-block">
          <FontAwesomeIcon icon={faArrowLeft} />
        </Link>
        <div className="flex items-center gap-2 relative">
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
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="プレビューメニュー"
            className="border rounded px-2 py-1 text-sm"
          >
            <FontAwesomeIcon icon={faBars} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded border bg-white p-2 shadow dark:bg-gray-800">
              <button
                type="button"
                onClick={() => {
                  setPreviewMode((v) => !v)
                  setMenuOpen(false)
                }}
                className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {previewMode ? 'プレビュー終了' : 'プレビューモード'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewMax((v) => !v)
                  setPreviewMode(true)
                  setMenuOpen(false)
                }}
                className="mt-1 block w-full rounded px-2 py-1 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {previewMax ? '最小プレビュー' : '最大プレビュー'}
              </button>
            </div>
          )}
        </div>
      </div>
      {styles.length > 1 && (
        <select
          value={current}
          onChange={(e) => {
            setCurrent(e.target.value)
            setMenuOpen(false)
          }}
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
        previewMode={previewMode}
        previewData={previewData}
        onPreviewChange={(next) => setPreviewData((prev) => ({ ...(prev || buildPreviewData(student?.initialStars || 1, previewMax)), ...next }))}
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
