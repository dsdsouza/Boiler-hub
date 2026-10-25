import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optional deployment identity for framework asset requests.
  deploymentId: process.env.NEXT_DEPLOYMENT_ID,
};

export default nextConfig;
