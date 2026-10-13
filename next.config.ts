import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

// 1. Read base path from site.config.json as baseline
let configBasePath = "";
try {
  const configPath = path.resolve(__dirname, "site.config.json");
  if (fs.existsSync(configPath)) {
    const siteConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    configBasePath = siteConfig.deployment?.basePath || siteConfig.basePath || "";
  }
} catch {
  // Use default
}

// 2. Allow environment variables to override site.config.json
let rawBasePath = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || configBasePath || "";
if (rawBasePath && !rawBasePath.startsWith("/")) {
  rawBasePath = "/" + rawBasePath;
}
if (rawBasePath.endsWith("/")) {
  rawBasePath = rawBasePath.slice(0, -1);
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "export",
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
        protocol: "https",
        hostname: "artmaxstudio.ro",
        port: "",
        pathname: "/**",
      },
    ],
  },
  // Adding a custom webpack function forces Next.js to use Webpack instead of Turbopack
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
