import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@medcore/types'],

  // Tree-shake lucide-react icons so only the icons actually used are bundled
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@medcore/types': path.join(__dirname, '../../packages/types/src/index.ts'),
    };

    // Split heavy vendor libraries into separate named chunks so the browser
    // caches them independently and never re-downloads them on navigation.
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...(config.optimization?.splitChunks || {}),
          cacheGroups: {
            ...(config.optimization?.splitChunks?.cacheGroups || {}),
            // Firebase SDK (large — isolate so app shell stays tiny)
            firebase: {
              test: /[\\/]node_modules[\\/](firebase|@firebase)[\\/]/,
              name: 'vendor-firebase',
              chunks: 'all',
              priority: 30,
              enforce: true,
            },
            // Lucide icons (wide tree but mostly cached after first visit)
            lucide: {
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
              name: 'vendor-lucide',
              chunks: 'all',
              priority: 25,
              enforce: true,
            },
            // All other node_modules merged into a single stable vendor chunk
            vendors: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendor-common',
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }

    return config;
  },

  async headers() {
    return [
      // Service worker must always be fresh
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      // Next.js content-hashed static assets are immutable — cache for 1 year
      // The service worker also caches these, giving instant loads on low-network.
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Fonts and images (long-lived)
      {
        source: '/:path*.woff2',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:path*.(png|jpg|jpeg|svg|webp|ico)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
    ];
  },
};

export default nextConfig;

