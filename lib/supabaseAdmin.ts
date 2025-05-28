// lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,       // 'https://<project>.supabase.co'
  process.env.SUPABASE_ANON_KEY!
)
