import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function GET() {
  const filePath = path.join(process.cwd(), 'data', 'students.json')
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    const students = JSON.parse(data)
    return NextResponse.json(students)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
