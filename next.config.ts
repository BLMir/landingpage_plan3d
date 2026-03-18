import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export',
  images: {
    unoptimized: true,
  },
  // @ts-ignore - Turbopack root config for workspace resolution
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
