import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone',
  // basePath removed - user visits domain root artmaxstudio.ro which maps to artmax-app folder
  experimental: {
    // Force Webpack by NOT enabling any Turbo-only flags
  },
  images: {
    unoptimized: true,
  },
  // Adding a custom webpack function forces Next.js to use Webpack instead of Turbopack
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
