'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'

export default function ProfileSetup() {
  const session = useSession()
  const supabase = useSupabaseClient()
  const router = useRouter()
  const [username, setUsername] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) return
    const { error } = await supabase.from('profiles').insert({
      id: session.user.id,
      username,
    })
    if (!error) {
      router.push('/')
    } else {
      alert(error.message)
    }
  }

  if (!session) {
    return <p>Loading...</p>
  }

  return (
    <main className="p-4">
      <h2 className="text-lg font-bold mb-4">ユーザー名登録</h2>
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
