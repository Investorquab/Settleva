import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@settleva/conditions",
    "@settleva/verification",
    "@settleva/providers",
    "@settleva/sdk"
  ],
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"]
    };
    return config;
  }
};

export default nextConfig;
