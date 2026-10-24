import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Preserve Vercel's deployment identity on framework asset requests.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.NEXT_DEPLOYMENT_ID,
};

export default nextConfig;
