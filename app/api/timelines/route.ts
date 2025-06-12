import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function GET() {
  const dirPath = path.join(process.cwd(), 'data', 'tl')
  try {
    const files = await fs.readdir(dirPath)
    let timelines: any[] = []
    for (const file of files.filter((f) => f.endsWith('.json'))) {
      const data = await fs.readFile(path.join(dirPath, file), 'utf-8')
      timelines = timelines.concat(JSON.parse(data))
    }
    return NextResponse.json(timelines)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
