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
}

module.exports = nextConfig
