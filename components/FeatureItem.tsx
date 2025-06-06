'use client'

import { useTheme } from './ThemeProvider'

export default function FeatureItem({ children }: { children: React.ReactNode }) {
  const { dark } = useTheme()
  return (
    <div className={`rounded-lg border p-3 ${dark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-gray-100 border-gray-300'}`}>
      {children}
    </div>
  )
}
