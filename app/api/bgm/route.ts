import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

interface BgmTrack {
  filename: string
  title?: string
  category: string
}

interface BgmData {
  categories: string[]
  tracks: BgmTrack[]
}

export async function GET() {
  const filePath = path.join(process.cwd(), 'data', 'bgm.json')
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(data) as BgmData
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ categories: [], tracks: [] }, { status: 500 })
  }
}
