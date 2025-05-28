// app/layout.tsx
import './globals.css'
import { Providers } from './providers'

export const metadata = {
  title: 'My App',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {/* ここではあくまでサーバー→クライアントの橋渡しだけ */}
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
