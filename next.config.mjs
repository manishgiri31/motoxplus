/** @type {import('next').NextConfig} */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://motoxplus.com";
const IS_PROD = process.env.NODE_ENV === "production";

const securityHeaders = [
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referrer policy
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Permissions policy — deny unused browser APIs
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()",
  },
  // HSTS — 2 years, include subdomains + preload. Prod-only: the dev server
  // is plain HTTP, and a browser that ever receives this header for
  // localhost will force-upgrade all future localhost requests to HTTPS,
  // breaking local dev until the HSTS entry is manually cleared.
  ...(IS_PROD
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
  // Legacy XSS filter
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // DNS prefetch control
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js inline scripts + Razorpay checkout SDK
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://cdn.razorpay.com",
      "style-src 'self' 'unsafe-inline'",
      // Images: self, blob, data URIs, R2 CDN, Unsplash
      "img-src 'self' blob: data: https://*.r2.dev https://pub-966fa80d99d64e388b250232523a507f.r2.dev https://images.unsplash.com https://motoxplus.com",
      "font-src 'self'",
      // API calls: self + Razorpay APIs
      "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com",
      // Razorpay checkout iframe
      "frame-src https://api.razorpay.com https://checkout.razorpay.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      // Prod-only: would force dev's plain-HTTP fetches/RSC requests to HTTPS
      ...(IS_PROD ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
  },
];

const nextConfig = {
  // Hide "X-Powered-By: Next.js" response header
  poweredByHeader: false,

  // Compress responses (gzip) — Nginx will handle brotli on top
  compress: true,

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Aggressive caching for Next.js static assets (_next/static)
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // No caching for API routes
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },

  async redirects() {
    return [
      // Force www → non-www (adjust if you prefer www)
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.motoxplus.com" }],
        destination: "https://motoxplus.com/:path*",
        permanent: true,
      },
    ];
  },

  images: {
    // Use WebP/AVIF for all Next.js optimized images
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "pub-966fa80d99d64e388b250232523a507f.r2.dev",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "motoxplus.com",
      },
    ],
  },

  experimental: {
    // Packages that should not be bundled for server components
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs", "sharp"],
    // Optimize package imports (tree-shake icon libs, etc.)
    optimizePackageImports: ["lucide-react", "framer-motion", "@radix-ui/react-dialog"],
  },

  // Webpack customization
  webpack(config, { isServer }) {
    // Suppress "Critical dependency" warnings from ioredis/optional deps
    config.ignoreWarnings = [
      { module: /node_modules\/ioredis/ },
    ];
    return config;
  },
};

export default nextConfig;
