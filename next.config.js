/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/blog.html', destination: '/blog', permanent: true },
      { source: '/buck-it.html', destination: '/playground', permanent: true }
    ];
  }
};
module.exports = nextConfig;