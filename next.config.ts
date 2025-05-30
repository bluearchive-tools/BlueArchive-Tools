/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: `${process.env.SUPABASE_URL}/auth/v1/:path*`
      },
      // 他にもREST APIやストレージをプロキシしたい場合は追加a
      // {
      //   source: '/api/rest/:path*',
      //   destination: `${process.env.SUPABASE_URL}/rest/v1/:path*`
      // }
    ]
  },

  // ここを追加
  async headers() {
    return [
      {
        source: '/api/auth/:path*',
        headers: [
          {
            key: 'apikey',
            value: process.env.SUPABASE_ANON_KEY!
          },
          {
            key: 'Authorization',
            value: `Bearer ${process.env.SUPABASE_ANON_KEY!}`
          }
        ]
      }
    ];
  }
}

module.exports = nextConfig
