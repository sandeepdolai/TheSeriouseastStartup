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
  poweredByHeader: false,
  async rewrites() {
    // Keep the reference landing page as the public homepage while preserving
    // the existing interactive app at /create and /website-templates.
    return {
      beforeFiles: [
        { source: "/", destination: "/landing/index.html" },
      ],
    };
  },
  async headers() {
    return [
      {
        // The Rose GLB is a public static asset. Permit the script-only,
        // sandboxed srcDoc editor iframe (opaque origin) to fetch it.
        source: "/models/rose.glb",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  reactStrictMode: false,
  devIndicators: false,
};

export default nextConfig;
