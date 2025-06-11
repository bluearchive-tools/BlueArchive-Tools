import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function GET() {
  const filePath = path.join(process.cwd(), 'data', 'equipment.json')
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    const equipments = JSON.parse(data)
    return NextResponse.json(equipments)
  } catch {
    return NextResponse.json({}, { status: 500 })
  }
}
