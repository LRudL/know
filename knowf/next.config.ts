import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    console.log("Build environment:", {
      nodeVersion: process.version,
      nextVersion: process.env.NEXT_RUNTIME,
      env: process.env.NODE_ENV,
    });
    return config;
  },
};

export default nextConfig;
