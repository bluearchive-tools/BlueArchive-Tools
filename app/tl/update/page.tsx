import { notFound } from 'next/navigation'
import TLFetchClient from './TLFetchClient'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export default async function Page() {
  const supabase = createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  // 「ログイン済みかつ admin=true だけアクセス可」にしたいので
  // 未ログインも含めて 404 扱いにしています（導線があるなら redirect に変えてOK）
  if (!user) {
    notFound()
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('admin')
    .eq('id', user.id)
    .single()

  if (!profile?.admin) {
    notFound()
  }

  return <TLFetchClient />
}
