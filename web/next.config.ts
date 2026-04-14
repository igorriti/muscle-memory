import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  webpack: (config) => {
    config.resolve.alias['muscle-memory'] = path.resolve(__dirname, '../src/index.ts');
    return config;
  },
};

export default nextConfig;
