// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// ブラウザ判定
const isBrowser = typeof window !== 'undefined'

// サーバーでは必ず SUPABASE_URL を、
// ブラウザでは NEXT_PUBLIC_SUPABASE_URL を使う
const supabaseUrl = isBrowser
  ? process.env.NEXT_PUBLIC_SUPABASE_URL!
  : process.env.SUPABASE_URL!

if (!supabaseUrl) {
  throw new Error('Missing Supabase URL env var')
}

const supabaseKey = isBrowser
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  : process.env.SUPABASE_ANON_KEY!

if (!supabaseKey) {
  throw new Error('Missing Supabase anon key env var')
}
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    detectSessionInUrl: true,
    persistSession:    true,
    autoRefreshToken:  true,
  }
})
