export default {
  reactStrictMode: true,

  pageExtensions: ["ts", "tsx", "mdx"],

  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  redirects: async () => [
    {
      source: "/price-feeds/evm",
      destination: "/price-feeds/evm/getPriceNoOlderThan",
      permanent: false,
    },
  ],
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/i,
      use: ["@svgr/webpack"],
    });

    config.resolve.extensionAlias = {
      ".js": [".js", ".ts", ".tsx"],
    };

    return config;
  },

  headers: () => [
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
