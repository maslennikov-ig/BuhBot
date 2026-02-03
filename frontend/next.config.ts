import type { NextConfig } from 'next';
import packageJson from './package.json' with { type: 'json' };

// Backend URL from environment or default
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

const nextConfig: NextConfig = {
  // Expose app version to client-side code
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  // Enable standalone output for optimal Docker deployment
  // This creates a minimal production server with all dependencies bundled
  output: 'standalone',

  // Proxy /api requests to backend server in development
  async rewrites() {
    return [
      {
        source: '/api/trpc/:path*',
        destination: `${BACKEND_URL}/api/trpc/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
