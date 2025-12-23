/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const url = process.env.SUPABASE_URL
    if (!url) {
      return []
    }
    return [
      {
        source: '/api/auth/:path*',
        destination: `${url}/auth/v1/:path*`,
      },
      // 他にもREST APIやストレージをプロキシしたい場合は追加
      // {
      //   source: '/api/rest/:path*',
      //   destination: `${url}/rest/v1/:path*`
      // }
    ]
  },
}

module.exports = nextConfig
