const MiniCssExtractPlugin = require('mini-css-extract-plugin');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Apply mini-css-extract-plugin on the client side only
      config.plugins.push(
        new MiniCssExtractPlugin({
          filename: 'static/css/[name].[contenthash].css',
          chunkFilename: 'static/css/[id].[contenthash].css',
        })
      );
    }
    
    return config;
  },
  // Add other Next.js configuration options as needed
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [
      'token.metaswap.codefi.network', // For token logos
      'avatars.githubusercontent.com',
      'raw.githubusercontent.com',
    ],
    unoptimized: true // For handling dynamic image URLs
  }
};

module.exports = nextConfig;
