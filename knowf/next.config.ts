import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    console.log("Webpack build environment:", {
      buildId,
      dev,
      isServer,
    });
    return config;
  },
};

export default nextConfig;
