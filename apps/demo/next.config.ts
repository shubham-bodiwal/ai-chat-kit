import type { NextConfig } from "next";

const config: NextConfig = {
  // The kit is consumed as TypeScript source inside the workspace; no prebuild step needed.
  transpilePackages: ["@ai-chat-kit/react"],
};

export default config;
