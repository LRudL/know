import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    console.log("Build environment:", {
      nodeVersion: process.version,
      nextVersion: process.env.NEXT_RUNTIME,
      env: process.env.NODE_ENV,
    });
    console.log("Build environment details:", {
      cwd: process.cwd(),
      dirname: __dirname,
      files: require("fs").readdirSync(process.cwd()),
      parentFiles: require("fs").readdirSync(".."),
      envVars: {
        VERCEL: process.env.VERCEL,
        VERCEL_ENV: process.env.VERCEL_ENV,
        VERCEL_URL: process.env.VERCEL_URL,
      },
    });
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.join(__dirname, "src"),
    };
    return config;
  },
};

export default nextConfig;
