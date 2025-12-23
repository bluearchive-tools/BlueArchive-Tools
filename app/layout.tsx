// app/layout.tsx
import './globals.css'
import { Providers } from './providers'
import Header from '../components/Header'
import { M_PLUS_Rounded_1c } from 'next/font/google'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { config } from '@fortawesome/fontawesome-svg-core'
config.autoAddCss = false

const mplus = M_PLUS_Rounded_1c({
  weight: '500',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata = {
  title: 'BlueArchive Tools',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${mplus.variable} font-sans`}>
        {/* ここではあくまでサーバー→クライアントの橋渡しだけ */}
        <Providers>
          <Header />
          <main className="pt-2 pb-8">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
