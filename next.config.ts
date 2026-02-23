import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  experimental: {
    // Force Webpack by NOT enabling any Turbo-only flags
  },
  // Adding a custom webpack function forces Next.js to use Webpack instead of Turbopack
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
