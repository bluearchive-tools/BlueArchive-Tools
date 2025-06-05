import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function GET() {
  const noticesDir = path.join(process.cwd(), 'notices')
  let files: string[]
  try {
    files = await fs.readdir(noticesDir)
  } catch {
    return NextResponse.json([])
  }
  files.sort()
  const notices = await Promise.all(
    files.map(async (name) => ({
      id: name,
      content: await fs.readFile(path.join(noticesDir, name), 'utf-8'),
    }))
  )
  return NextResponse.json(notices)
}
