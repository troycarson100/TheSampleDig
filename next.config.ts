import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Suppress CSP warnings for NextAuth v5 beta (it uses dynamic code evaluation)
  // This is a known issue with NextAuth v5 beta and will be fixed in stable release
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.youtube.com https://www.google.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://www.googleapis.com https://www.youtube.com https://youtube.com",
              "frame-src 'self' https://www.youtube.com https://youtube.com",
              "media-src 'self' https://www.youtube.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
