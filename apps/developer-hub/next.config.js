import { createMDX } from "fumadocs-mdx/next";

const config = {
  headers: async () => [
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

  async redirects() {
    return [
      {
        destination: "/",
        permanent: true,
        source: "/home",
      },
      // First version of docs site -> third version
      {
        destination:
          "/price-feeds/core/use-real-time-data/pull-integration/evm",
        permanent: true,
        source: "/evm",
      },

      // Second version of docs site -> third version
      {
        destination: "/metrics/:path*",
        permanent: true,
        source: "/documentation/metrics/:path*",
      },
      {
        destination: "/price-feeds/core/how-pyth-works/:slug*",
        permanent: true,
        source: "/documentation/how-pyth-works/:slug*",
      },
      {
        destination: "/price-feeds/core/use-historic-price-data",
        permanent: true,
        source: "/documentation/benchmarks",
      },
      {
        destination: "/price-feeds/core/publish-data/:slug*",
        permanent: true,
        source: "/documentation/publish-data/:slug*",
      },
      {
        destination: "/price-feeds/core/solana-price-feeds/:slug*",
        permanent: true,
        source: "/documentation/solana-price-feeds/:slug*",
      },
      {
        destination: "/whitepaper/:slug*",
        permanent: true,
        source: "/documentation/whitepaper/:slug*",
      },
      {
        destination: "/security",
        permanent: true,
        source: "/documentation/security",
      },
      {
        destination: "/entropy",
        permanent: true,
        source: "/documentation/entropy",
      },
      {
        destination: "/entropy/protocol-design",
        permanent: true,
        source: "/documentation/entropy/protocol-design",
      },
      {
        destination: "/entropy/best-practices",
        permanent: true,
        source: "/documentation/entropy/best-practices",
      },
      {
        destination: "/entropy/generate-random-numbers-evm",
        permanent: true,
        source: "/documentation/entropy/solidity-sdk",
      },
      {
        destination: "/entropy/generate-random-numbers-evm",
        permanent: true,
        source: "/documentation/entropy/evm",
      },
      {
        destination: "/price-feeds/core/pythnet-price-feeds",
        permanent: true,
        source: "/documentation/pythnet-price-feeds",
      },
      {
        destination: "/price-feeds/core/pull-updates",
        permanent: true,
        source: "/documentation/pythnet-price-feeds/on-demand",
      },
      {
        destination: "/price-feeds/core/best-practices",
        permanent: true,
        source: "/documentation/pythnet-price-feeds/best-practices",
      },
      {
        destination: "/price-feeds/core/best-practices",
        permanent: true,
        source: "/price-feeds/pythnet-price-feeds/best-practices",
      },
      {
        destination: "/price-feeds/core/pull-updates",
        permanent: true,
        source: "/price-feeds/pythnet-price-feeds/pull-updates",
      },
      {
        destination: "/price-feeds/core/best-practices",
        permanent: true,
        source: "/price-feeds/solana-price-feeds/best-practices",
      },
      {
        destination: "/price-feeds/core/how-pyth-works/hermes",
        permanent: true,
        source: "/documentation/pythnet-price-feeds/hermes",
      },
      {
        destination: "/price-feeds/core/how-pyth-works/hermes",
        permanent: true,
        source: "/pythnet-price-feeds/hermes",
      },
      {
        destination:
          "/price-feeds/core/schedule-price-updates/using-price-pusher",
        permanent: true,
        source: "/documentation/pythnet-price-feeds/scheduler",
      },
      {
        destination:
          "/price-feeds/core/schedule-price-updates/using-price-pusher",
        permanent: true,
        source: "/price-feeds/schedule-price-updates/using-scheduler",
      },
      {
        destination: "/price-feeds/core/fetch-price-updates",
        permanent: true,
        source: "/documentation/pythnet-price-feeds/off-chain",
      },
      {
        destination: "/price-feeds/core/fetch-price-updates",
        permanent: true,
        source: "/price-feeds/use-real-time-data/off-chain",
      },
      {
        destination:
          "/price-feeds/core/use-real-time-data/pull-integration/evm",
        permanent: true,
        source: "/documentation/pythnet-price-feeds/evm",
      },
      {
        destination: "/price-feeds",
        permanent: true,
        source: "/documentation",
      },
      {
        destination: "/price-feeds/core/api-reference/:slug*",
        permanent: true,
        source: "/api-explorer/:slug*",
      },
      {
        destination: "/price-feeds/core/schedule-price-updates/using-gelato",
        permanent: true,
        source: "/guides/how-to-schedule-price-updates-with-gelato",
      },
      {
        destination: "/price-feeds/core/create-tradingview-charts",
        permanent: true,
        source: "/guides/how-to-create-tradingview-charts",
      },
      {
        destination: "/oracle-integrity-staking/reward-examples",
        permanent: true,
        source: "/home/oracle-integrity-staking/examples",
      },
      {
        destination: "/price-feeds",
        permanent: true,
        source: "/guides",
      },

      // Lazer (top-level) to Pyth Pro Redirects - MUST come before general price-feeds redirects
      {
        destination: "/price-feeds/pro",
        permanent: true,
        source: "/lazer",
      },
      {
        destination: "/price-feeds/pro/:path*",
        permanent: true,
        source: "/lazer/:path*",
      },

      // Explicitly map legacy lazer paths under /price-feeds to Pro - MUST come before general price-feeds redirects
      {
        destination: "/price-feeds/pro",
        permanent: true,
        source: "/price-feeds/lazer",
      },
      {
        destination: "/price-feeds/pro/:path*",
        permanent: true,
        source: "/price-feeds/lazer/:path*",
      },

      {
        destination: "/price-feeds/core/:path",
        permanent: true,
        source: String.raw`/price-feeds/:path((?!core(?:/|$|\.mdx?$)|pro(?:/|$|\.mdx?$)|hip-3-service(?:/|$|\.mdx?$)).*)`,
      },

      // HIP-3 redirect - fumadocs meta.json links prepend parent path
      {
        destination: "/price-feeds/hip-3-service",
        permanent: true,
        source: "/price-feeds/core/hip-3-service",
      },

      // some other price feed redirects
      {
        destination: "/price-feeds/core/push-feeds",
        permanent: true,
        source: "/price-feeds/sponsored-feeds",
      },
      {
        destination: "/price-feeds/core/push-feeds",
        permanent: true,
        source: "/price-feeds/core/sponsored-feeds",
      },
      {
        destination:
          "/price-feeds/core/use-real-time-data/pull-integration/:path",
        permanent: true,
        source:
          "/price-feeds/use-real-time-data/:path((?!pull-integration(?:/|$)).*)",
      },
      {
        destination:
          "/price-feeds/core/use-real-time-data/pull-integration/:path",
        permanent: true,
        source:
          "/price-feeds/core/use-real-time-data/:path((?!pull-integration(?:/|$)|push-integration(?:/|$)|index(?:/|$)).*)",
      },
      {
        destination: "/price-feeds/core/use-historic-price-data",
        permanent: true,
        source: "/benchmarks",
      },
      {
        destination: "/price-feeds/core/create-tradingview-charts",
        permanent: true,
        source: "/benchmarks/how-to-create-tradingview-charts",
      },
      {
        destination: "/price-feeds/core/api-reference",
        permanent: true,
        source: "/benchmarks/api-instances",
      },
      {
        destination: "/price-feeds/core/rate-limits",
        permanent: true,
        source: "/benchmarks/rate-limits",
      },

      // External API reference redirects (non-permanent)
      {
        destination: "https://api-reference.pyth.network/price-feeds/evm/:slug",
        permanent: false,
        source: "/price-feeds/api-reference/evm/:slug",
      },
      {
        destination: "https://api-reference.pyth.network/price-feeds/evm/",
        permanent: false,
        source: "/price-feeds/api-reference/evm",
      },
    ];
  },

  // Rewrite .mdx and .md URLs to serve raw markdown for LLM consumption
  async rewrites() {
    return [
      {
        destination: "/mdx/:path*",
        source: "/:path*.mdx",
      },
      {
        destination: "/mdx/:path*",
        source: "/:path*.md",
      },
    ];
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
        as: "*.js",
        loaders: ["@svgr/webpack"],
      },
    },
  },
};

const withMDX = createMDX();

export default withMDX(config);
