import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Render starter instances can run out of memory during
    // "Collecting page data" when Next spawns many workers.
    cpus: 1,
  },
};

export default nextConfig;
