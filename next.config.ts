import type { NextConfig } from "next";

// Read and sanitize BASE_PATH from environment variable
let rawBasePath = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || '';
if (rawBasePath && !rawBasePath.startsWith('/')) {
  rawBasePath = '/' + rawBasePath;
}
if (rawBasePath.endsWith('/')) {
  rawBasePath = rawBasePath.slice(0, -1);
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'export',
  trailingSlash: true,
  ...(rawBasePath ? { basePath: rawBasePath, assetPrefix: rawBasePath } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: rawBasePath,
  },
  experimental: {
    // Force Webpack by NOT enabling any Turbo-only flags
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'artmaxstudio.ro',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Adding a custom webpack function forces Next.js to use Webpack instead of Turbopack
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
