import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React Compiler (Next.js 16+)
  reactCompiler: true,

  // Turbopack configuration (Next.js 16+ default bundler)
  // Empty config silences the webpack/turbopack conflict warning
  // Turbopack handles chunk splitting automatically
  turbopack: {},

  // Server-side external packages (replaces webpack externals for SSR)
  serverExternalPackages: ['@mediapipe/tasks-vision'],

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/mediapipe-models/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname: '/npm/@mediapipe/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/outputs/**',
      },
    ],
    // Reduce image quality for faster loading (90% is visually indistinguishable)
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    formats: ['image/avif', 'image/webp'],
  },

  // Experimental optimizations
  experimental: {
    // Optimize package imports for tree-shaking
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@google/generative-ai',
    ],
  },

  // Webpack configuration for bundle optimization
  // Note: Only used when running with --webpack flag (Turbopack is default in Next.js 16)
  webpack: (config, { isServer }) => {
    // SSR externalization is now handled by serverExternalPackages above
    // This section is kept for webpack fallback compatibility

    // Optimize chunk splitting
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization?.splitChunks,
          cacheGroups: {
            // Separate heavy libraries into their own chunks
            mediapipe: {
              test: /[\\/]node_modules[\\/]@mediapipe[\\/]/,
              name: 'mediapipe',
              chunks: 'async',
              priority: 30,
              reuseExistingChunk: true,
            },
            gemini: {
              test: /[\\/]node_modules[\\/]@google[\\/]generative-ai[\\/]/,
              name: 'gemini',
              chunks: 'async',
              priority: 25,
              reuseExistingChunk: true,
            },
            framerMotion: {
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
              name: 'framer-motion',
              chunks: 'async',
              priority: 20,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }

    return config;
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Cache static assets aggressively
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Don't cache HTML pages
      {
        source: '/',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },

  // Logging for debugging (production only shows errors)
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },
};

export default nextConfig;
