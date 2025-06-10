import fs from 'fs/promises'
import path from 'path'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import StudentUserData from '../../../components/StudentUserData'

interface RouteProps<T> {
  params: Promise<T>
}

interface Student {
  id: string
  name: string
  image: string
  attackType: string
  defenseType: string
  hasAccessory?: boolean
  altIds?: string[]
  altOf?: string
  initialStars: number
  role: string
  characterType: string
  position: string
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
    <main className="p-4 space-y-4">
      <Link href="/students" aria-label="一覧に戻る" className="text-lg inline-block">
        <FontAwesomeIcon icon={faArrowLeft} />
      </Link>
      <StudentUserData studentId={student.id} />
    </main>
  )
}
