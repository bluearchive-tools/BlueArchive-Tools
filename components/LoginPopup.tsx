'use client'

import { useEffect, useState } from 'react'
import { useSession } from '@supabase/auth-helpers-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons'

export default function LoginPopup() {
  const session = useSession()
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!session) {
      setVisible(true)
      setTimeout(() => setOpen(true), 20)
    }
  }, [session])

  const close = () => {
    setOpen(false)
    setTimeout(() => setVisible(false), 200)
  }

  if (session || !visible) return null

  return (
    <div
      className={`fixed top-20 inset-x-0 flex justify-center pointer-events-none z-20 transition-all duration-200 ${open ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
    >
      <div className="relative bg-yellow-200 text-black rounded shadow p-4 pointer-events-auto max-w-md w-full mx-4 flex items-start gap-2">
        <FontAwesomeIcon icon={faCircleExclamation} className="text-yellow-600 mt-1" />
        <p className="flex-1 text-sm">ログインするともっと便利に利用できます！</p>
        <button onClick={close} className="absolute top-1 right-1" aria-label="close">
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>
    </div>
  )
}
