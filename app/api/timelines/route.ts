import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function GET() {
  const filePath = path.join(process.cwd(), 'data', 'tl.json')
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    const timelines = JSON.parse(data)
    return NextResponse.json(timelines)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
