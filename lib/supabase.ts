// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// Node.js かブラウザかを判定
const isBrowser = typeof window !== 'undefined'

// サーバーサイド実行時には絶対 URL を。Vercel 等では env に SUPABASE_URL を設定しておく。
// ブラウザ実行時には NEXT_PUBLIC_SUPABASE_URL（= '/api/auth'）を使う。
const supabaseUrl = isBrowser
  ? process.env.NEXT_PUBLIC_SUPABASE_URL!
  : process.env.SUPABASE_URL!

// 認証・データ読み書きに共通して使えるキー（匿名キーで OK）
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
})
