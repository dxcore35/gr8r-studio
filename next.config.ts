import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  agentRules: false,
  output: 'standalone',
  pageExtensions: ['ts', 'tsx'],
};

export default nextConfig;
