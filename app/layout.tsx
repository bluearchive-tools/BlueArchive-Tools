// app/layout.tsx
import './globals.css'
import { Providers } from './providers'
import Header from '../components/Header'
import Footer from '../components/Footer'

export const metadata = {
  title: 'BlueArchive Tools',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {/* ここではあくまでサーバー→クライアントの橋渡しだけ */}
        <Providers>
          <Header />
          <main className="pt-16 pb-16">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
