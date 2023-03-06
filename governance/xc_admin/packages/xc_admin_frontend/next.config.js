/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    externalDir: true,
  },
  webpack(config) {
    config.resolve.fallback = { fs: false }
    const fileLoaderRule = config.module.rules.find(
      (rule) => rule.test && rule.test.test('.svg')
    )
    fileLoaderRule.exclude = /\.inline\.svg$/
    config.module.rules.push({
      test: /\.inline\.svg$/,
      loader: require.resolve('@svgr/webpack'),
    })

    return config
  },
}

module.exports = nextConfig
