import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@settleva/conditions",
    "@settleva/verification",
    "@settleva/providers",
    "@settleva/sdk"
  ]
};

export default nextConfig;
