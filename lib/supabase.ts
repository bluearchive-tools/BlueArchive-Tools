// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,       // → '/api/auth'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,  // 変更不要
  {
    auth: {
      detectSessionInUrl: true,
      persistSession:    true,
      autoRefreshToken:  true,
    }
  }
)
