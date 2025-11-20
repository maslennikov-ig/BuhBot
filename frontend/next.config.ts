import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for optimal Docker deployment
  // This creates a minimal production server with all dependencies bundled
  output: 'standalone',
};

export default nextConfig;
