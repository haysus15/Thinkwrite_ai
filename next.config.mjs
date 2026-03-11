/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['three'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: '/academic/study-materials',
        destination: '/academic/study-hub?tab=ingest',
        permanent: true,
      },
      {
        source: '/academic/study-library',
        destination: '/academic/study-hub?tab=library',
        permanent: true,
      },
      {
        source: '/academic-studio',
        destination: '/academic-studio/welcome',
        permanent: true,
      },
      {
        source: '/academic-studio/study-library',
        destination: '/academic/study-hub?tab=library',
        permanent: true,
      },
      {
        source: '/academic-studio/quiz/:id',
        destination: '/academic/quiz/:id',
        permanent: true,
      },
      {
        source: '/academic-studio/dashboard',
        has: [{ type: 'query', key: 'workspace', value: 'agenda' }],
        destination: '/academic/agenda',
        permanent: false,
      },
      {
        source: '/academic-studio/dashboard',
        has: [{ type: 'query', key: 'workspace', value: 'dashboard' }],
        destination: '/academic/dashboard',
        permanent: false,
      },
      {
        source: '/academic-studio/dashboard',
        has: [{ type: 'query', key: 'workspace', value: 'assignments' }],
        destination: '/academic/assignments',
        permanent: false,
      },
      {
        source: '/academic-studio/dashboard',
        has: [{ type: 'query', key: 'workspace', value: 'syllabi' }],
        destination: '/academic/syllabi',
        permanent: false,
      },
      {
        source: '/academic-studio/dashboard',
        has: [{ type: 'query', key: 'workspace', value: 'paper-workflow' }],
        destination: '/academic/paper-workflow',
        permanent: false,
      },
      {
        source: '/academic-studio/dashboard',
        has: [{ type: 'query', key: 'workspace', value: 'coding-review' }],
        destination: '/academic/coding-review',
        permanent: false,
      },
      {
        source: '/academic-studio/dashboard',
        has: [{ type: 'query', key: 'workspace', value: 'math-mode' }],
        destination: '/academic/math-mode',
        permanent: false,
      },
      {
        source: '/academic-studio/dashboard',
        has: [{ type: 'query', key: 'workspace', value: 'mathmode' }],
        destination: '/academic/math-mode',
        permanent: false,
      },
      {
        source: '/academic-studio/dashboard',
        has: [{ type: 'query', key: 'workspace', value: 'paper workflow' }],
        destination: '/academic/paper-workflow',
        permanent: false,
      },
      {
        source: '/academic-studio/dashboard',
        has: [{ type: 'query', key: 'workspace', value: 'coding review' }],
        destination: '/academic/coding-review',
        permanent: false,
      },
      {
        source: '/academic-studio/dashboard',
        has: [{ type: 'query', key: 'workspace', value: 'paperworkflow' }],
        destination: '/academic/paper-workflow',
        permanent: false,
      },
      {
        source: '/academic-studio/dashboard',
        has: [{ type: 'query', key: 'workspace', value: 'codingreview' }],
        destination: '/academic/coding-review',
        permanent: false,
      },
      {
        source: '/academic-studio/dashboard',
        destination: '/academic/dashboard',
        permanent: false,
      },
    ];
  },
  experimental: {
    // appDir is stable in Next.js 15, no longer needed
  }
}
export default nextConfig
