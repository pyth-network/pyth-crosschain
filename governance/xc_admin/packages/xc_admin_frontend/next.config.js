/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  turbopack: {
    resolveAlias: {
      fs: {
        /**
         * HACK ALERT: There are some react hooks
         * that are importing things from @coral-xyz/anchor,
         * which is a huge offender of including node-only deps
         * in its library, even if it's supposed to have isomorphic exports.
         * Since the "correct" fix would require substantial rearchitecting
         * of this project, shimming accidental node imports with an
         * empty module is what we'll use
         */
        browser: './turbopack-hacks/empty.ts',
      },
    },
    resolveExtensions: [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.mts',
      '.mjs',
      '.cts',
      '.cjs',
    ],
    rules: {
      '*.inline.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
}

export default nextConfig
