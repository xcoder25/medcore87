import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@medcore/types'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@medcore/types': path.join(__dirname, '../../packages/types/src/index.ts'),
    };
    return config;
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ];
  },
};

export default nextConfig;
