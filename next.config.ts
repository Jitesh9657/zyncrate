import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // ✅ Next.js 16 automatically uses the app directory and Turbopack
  // No need for experimental.appDir or experimental.turbopack anymore
};

export default nextConfig;
