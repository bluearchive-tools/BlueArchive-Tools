import fs from 'fs/promises'
import path from 'path'

interface Student {
  id: string
  name: string
  image: string
  attackType: string
  defenseType: string
}

export default async function StudentDetail({ params }: { params: { id: string } }) {
  const filePath = path.join(process.cwd(), 'data', 'students.json')
  const data = await fs.readFile(filePath, 'utf-8')
  const students: Student[] = JSON.parse(data)
  const student = students.find((s) => s.id === params.id)

  if (!student) {
    return <main className="p-4">生徒が見つかりません</main>
  }

  return (
    <main className="p-4 space-y-4">
      <h2 className="text-xl font-bold">{student.name}</h2>
      <img src={student.image} alt={student.name} className="w-full h-auto rounded" />
      <p>攻撃属性: {student.attackType}</p>
      <p>防御属性: {student.defenseType}</p>
    </main>
  )
}
