/** @type {import('next').NextConfig} */
const config = {
  experimental: {
    useCache: true,
  },
  reactStrictMode: true,

  pageExtensions: ["ts", "tsx", "mdx"],

  reactCompiler: true,

  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  turbopack: {
    resolveExtensions: [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".mts",
      ".mjs",
      ".cts",
      ".cjs",
    ],
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },

  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "X-XSS-Protection",
          value: "1; mode=block",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=2592000",
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "Permissions-Policy",
          value:
            "vibrate=(), geolocation=(), midi=(), notifications=(), push=(), sync-xhr=(), microphone=(), camera=(), magnetometer=(), gyroscope=(), speaker=(), vibrate=(), fullscreen=self",
        },
      ],
    },
  ],
};
export default config;
