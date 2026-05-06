import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/find-ustaz', destination: '/find-tutor', permanent: true },
      { source: '/ustaz/:id', destination: '/tutor/:id', permanent: true },
      { source: '/register-ustaz', destination: '/register/tutor', permanent: true },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "luoanlixeldvtfpeofkt.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
