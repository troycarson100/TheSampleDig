import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Don't bundle playwright (native/binary deps); resolve at runtime
  serverExternalPackages: ["playwright"],
  // Avoid PackFileCacheStrategy ENOENT rename errors (path with spaces / cache dir race)
  webpack: (config, { dev }) => {
    if (dev) config.cache = { type: "memory" };
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
    ],
  },
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
              // AdSense: pagead2.googlesyndication.com (not covered by www.google.com)
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.youtube.com https://www.google.com https://pagead2.googlesyndication.com https://www.googleadservices.com https://www.googletagservices.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://www.googleapis.com https://www.youtube.com https://youtube.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://www.google.com https://www.googleadservices.com https://adservice.google.com",
              "frame-src 'self' https://www.youtube.com https://youtube.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://pagead2.googlesyndication.com",
              "media-src 'self' https://www.youtube.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
