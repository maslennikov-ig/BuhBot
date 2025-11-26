import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for optimal Docker deployment
  // This creates a minimal production server with all dependencies bundled
  output: 'standalone',
  
  // Proxy /api requests to backend server in development
  async rewrites() {
    return [
      {
        source: '/api/trpc/:path*',
        destination: 'http://localhost:3001/api/trpc/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
