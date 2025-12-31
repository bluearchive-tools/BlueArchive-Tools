import fs from 'fs/promises'
import path from 'path'
import StudentDetailClient from '../../../components/StudentDetailClient'
import PageHelpButton from '../../../components/PageHelpButton'

interface RouteProps<T> {
  params: Promise<T>
}

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

export default async function StudentDetail({ params }: RouteProps<{ id: string }>) {
  const { id } = await params
  const filePath = path.join(process.cwd(), 'data', 'students.json')
  const data = await fs.readFile(filePath, 'utf-8')
  const students: Student[] = JSON.parse(data)
  const student = students.find((s) => s.id === id)

  if (!student) {
    return <main className="p-4">生徒が見つかりません</main>
  }

  return (
    <main className="p-2 space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold">生徒詳細</h2>
        <PageHelpButton pageKey="student-detail" />
      </div>
      <StudentDetailClient studentId={student.id} />
    </main>
  )
}
