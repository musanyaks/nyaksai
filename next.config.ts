import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // NEXT_DIST_DIR lets packaging scripts run `next build` into a separate folder
  // (e.g. while a dev server is using the default .next). Unset in normal use.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
