'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import StudentUserData from './StudentUserData'

export default function StudentDetailClient({ studentId }: { studentId: string }) {
  const [editMode, setEditMode] = useState(false)
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
      <StudentUserData studentId={studentId} editMode={editMode} />
    </div>
  )
}
