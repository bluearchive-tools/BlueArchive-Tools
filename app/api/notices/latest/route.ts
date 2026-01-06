import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function GET() {
  const noticesDir = path.join(process.cwd(), 'notices')
  let files: string[]
  try {
    files = await fs.readdir(noticesDir)
  } catch {
    return NextResponse.json({ id: null, content: '' })
  }
  if (files.length === 0) {
    return NextResponse.json({ id: null, content: '' })
  }
  files.sort()
  const latest = files[files.length - 1]
  const content = await fs.readFile(path.join(noticesDir, latest), 'utf-8')
  return NextResponse.json({ id: latest, content })
}
