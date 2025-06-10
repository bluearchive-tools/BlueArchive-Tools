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
      <h2 className="text-xl font-bold">{student.name}</h2>
      <img src={student.image} alt={student.name} className="w-full h-auto rounded" />
      <p>攻撃属性: {student.attackType}</p>
      <p>防御属性: {student.defenseType}</p>
      <p>初期星数: {student.initialStars}</p>
      <p>役割: {student.role}</p>
      <p>タイプ: {student.characterType}</p>
      <StudentUserData studentId={student.id} />
    </main>
  )
}
