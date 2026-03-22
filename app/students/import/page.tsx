'use client'

import Link from 'next/link'
import PageHelpButton from '../../../components/PageHelpButton'
import StudentImportContent from '../../../components/StudentImportContent'

export default function StudentImportPage() {
  return (
    <main className="p-4 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/students" className="text-blue-600 underline">
          生徒データ確認へ戻る
        </Link>
        <PageHelpButton pageKey="students-import" />
      </div>
      <StudentImportContent mode="full" showHeader />
    </main>
  )
}
