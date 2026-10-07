import type { NextConfig } from "next";

/**
 * Paper Stish runs on a server (Vercel or any Node host): the app depends on
 * NextAuth's auth routes and on the Smart Edit API + database, which static
 * hosting cannot provide. `standalone` output keeps `npm run start` working
 * for self-hosting while Vercel deploys normally.
 */
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BASE_PATH: "",
  },
  output: "standalone",
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  devIndicators: false,
};

export default nextConfig;
