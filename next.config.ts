import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Don't bundle these (native/binary deps or ESM submodules that break webpack);
  // resolve them at runtime instead.
  serverExternalPackages: ["playwright", "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"],
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
              // Meta Pixel: connect.facebook.net (fbevents.js) + www.facebook.com (/tr beacon)
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.youtube.com https://www.google.com https://pagead2.googlesyndication.com https://www.googleadservices.com https://www.googletagservices.com https://connect.facebook.net",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://www.googleapis.com https://www.youtube.com https://youtube.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://www.google.com https://www.googleadservices.com https://adservice.google.com https://www.facebook.com https://connect.facebook.net",
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
