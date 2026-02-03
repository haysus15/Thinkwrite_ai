/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['three'],
  experimental: {
    // appDir is stable in Next.js 15, no longer needed
  }
}
export default nextConfig
