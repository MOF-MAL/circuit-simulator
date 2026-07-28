import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.BUILD_TARGET === "electron" ? { output: "export" } : {}),
};

export default nextConfig;
