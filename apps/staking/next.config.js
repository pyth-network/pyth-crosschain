export default {
  headers: () => [
    {
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
      source: "/:path*",
    },
  ],

  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  pageExtensions: ["ts", "tsx", "mdx"],
  reactStrictMode: true,

  rewrites: () => [
    {
      destination:
        "https://web-api.pyth.network/publishers_ranking?cluster=pythnet",
      source: "/api/publishers-ranking",
    },
  ],

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
        as: "*.js",
        loaders: ["@svgr/webpack"],
      },
    },
  },
};
