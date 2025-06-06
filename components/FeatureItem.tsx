'use client'

import { useTheme } from './ThemeProvider'

export default function FeatureItem({
  title,
  description,
}: {
  title: string
  description: string
}) {
  const { dark } = useTheme()
  return (
    <div
      className={`rounded-lg border p-3 space-y-1 ${dark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-gray-100 border-gray-300'}`}
    >
      <h3 className="text-md font-semibold">{title}</h3>
      <p className="text-sm">{description}</p>
    </div>
  )
}
