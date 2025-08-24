/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Legacy paths → modern routes
  async redirects() {
    return [
      { source: '/blog.html', destination: '/blog', permanent: true },
      { source: '/buck-it.html', destination: '/playground', permanent: true },
      // Optional niceties:
      { source: '/buck-it', destination: '/playground', permanent: true },
    ];
  },

  // Light caching for static assets during migration
  async headers() {
    return [
      {
        source: '/css/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=600, must-revalidate' }],
      },
      {
        source: '/scripts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=600, must-revalidate' }],
      },
      {
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, immutable' }],
      },
      {
        source: '/images/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, immutable' }],
      },
    ];
  },

  // Don’t block builds while migrating (flip off later)
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

module.exports = nextConfig;
