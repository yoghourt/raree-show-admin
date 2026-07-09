import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/works/:workId/scenes/:path*",
        destination: "/works/:workId/reading-routes/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
