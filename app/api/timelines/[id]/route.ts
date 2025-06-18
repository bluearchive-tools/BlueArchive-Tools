import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

export async function PUT(request: NextRequest) {
  try {
    const { season, score, guide, formationStatus } = (await request.json()) as {
      season?: string
      score?: string
      guide?: boolean
      formationStatus?: string
    }
    if (!season) {
      return NextResponse.json({ success: false }, { status: 400 })
    }
    const id = request.nextUrl.pathname.split('/').slice(-2)[0]
    const table = season ? `tl_${season.toLowerCase()}` : 'tl_unknown'
    const update: Record<string, unknown> = {}
    if (score !== undefined) update.score = score
    if (guide !== undefined) update.guide = guide
    if (formationStatus !== undefined)
      update.formation_status = formationStatus
    const { error } = await supabase
      .from(table)
      .update(update)
      .eq('id', Number(id))
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
