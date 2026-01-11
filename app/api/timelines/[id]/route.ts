import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

export async function PUT(request: NextRequest) {
  try {
    const {
      season,
      score,
      guide,
      formationStatus,
      armor,
      difficulty,
      formation,
    } = (await request.json()) as {
      season?: string
      score?: string
      guide?: boolean
      formationStatus?: string
      armor?: string
      difficulty?: string
      formation?: string
    }
    if (!season) {
      return NextResponse.json({ success: false }, { status: 400 })
    }
    const id = request.nextUrl.pathname.split('/').pop()!
    const table = season ? `tl_${season.toLowerCase()}` : 'tl_unknown'
    const update: Record<string, unknown> = {}
    if (score !== undefined) update.score = score
    if (guide !== undefined) update.guide = guide
    if (formationStatus !== undefined)
      update.formation_status = formationStatus
    if (armor !== undefined) update.armor = armor
    if (difficulty !== undefined) update.difficulty = difficulty
    if (formation !== undefined) update.formation = formation
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
