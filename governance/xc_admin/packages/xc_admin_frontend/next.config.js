const path = require('node:path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  webpack(config, { isServer }) {
    config.experiments = { asyncWebAssembly: true, layers: true }
    config.resolve.fallback = { fs: false }
    const fileLoaderRule = config.module.rules.find(
      (rule) => rule.test && rule.test?.test?.('.svg')
    )
    fileLoaderRule.exclude = /\.inline\.svg$/
    config.module.rules.push({
      test: /\.inline\.svg$/,
      loader: require.resolve('@svgr/webpack'),
    })

    config.resolve.alias = {
      ...config.resolve.alias,
      '@images': path.resolve(__dirname, 'images/'),
    }

    // make Next.js aware of how to import uncompiled TypeScript files
    // from our component-library and other shared packages
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.jsx': ['.tsx', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    }

    return config
  },
}

module.exports = nextConfig
