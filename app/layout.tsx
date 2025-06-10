// app/layout.tsx
import './globals.css'
import { Providers } from './providers'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { M_PLUS_1p } from 'next/font/google'

const mplus = M_PLUS_1p({ weight: '500', subsets: ['latin'], display: 'swap' })

export const metadata = {
  title: 'BlueArchive Tools',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={mplus.className}>
        {/* ここではあくまでサーバー→クライアントの橋渡しだけ */}
        <Providers>
          <Header />
          <main className="pt-4 pb-16">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
