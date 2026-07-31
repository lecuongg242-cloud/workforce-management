import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Thu muc cha co lockfile rieng nen Next doan sai goc workspace — chi ro o day
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
