/** @type {import('next').NextConfig} */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const nextConfig = {
  compiler: {
    styledComponents: true,
  },
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  sassOptions: {
    includePaths: [
      path.join(
        __dirname,
        'styles',
      ),
    ],
  },
};

module.exports = nextConfig;
