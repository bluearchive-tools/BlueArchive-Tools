'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import PageHelpButton from '../../../components/PageHelpButton'

export default function ProfileSetup() {
  const session = useSession()
  const supabase = useSupabaseClient()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!session) {
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .maybeSingle()
      if (data?.username) {
        setUsername(data.username)
      }
      setLoading(false)
    }
    load()
  }, [session, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) return
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      alert('ユーザー名は3〜20文字の英数字、-_のみ使用できます。')
      return
    }
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, username }, { onConflict: 'id' })
    if (error) {
      alert(error.message)
    } else {
      router.push('/')
    }
  }

  if (!session || loading) {
    return <p>Loading...</p>
  }

  return (
    <main className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-bold">ユーザー名設定</h2>
        <PageHelpButton pageKey="profile-setup" />
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="border px-2 py-1"
          required
        />
        <button type="submit" className="bg-blue-500 text-white px-4 py-1 rounded">
          登録
        </button>
      </form>
    </main>
  )
}
