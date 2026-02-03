/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['three'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // appDir is stable in Next.js 15, no longer needed
  }
}
export default nextConfig
