/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['firebasestorage.googleapis.com'],
  },
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cityz-kit'}.firebaseapp.com/__/auth/:path*`,
      },
    ];
  },
}

module.exports = nextConfig
