import type { NextConfig } from "next";

// Next's webpack dev bundles evaluate module code with eval(), and dev HMR opens
// a websocket back to localhost. Without these two allowances in development the
// browser blocks the dev bundle, React never hydrates, and the local site renders
// as static HTML with nothing clickable. Neither is ever emitted in production.
const isDevelopment = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${
    isDevelopment ? " ws://localhost:* http://localhost:*" : ""
  }`,
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
