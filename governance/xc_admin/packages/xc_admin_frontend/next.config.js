const path = require('path')

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

    return config
  },
}

module.exports = nextConfig
