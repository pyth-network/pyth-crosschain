import path from "node:path";
import { fileURLToPath } from "node:url";

import { createMDX } from "fumadocs-mdx/next";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  reactStrictMode: true,
  pageExtensions: ["ts", "tsx", "mdx"],

  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/i,
      use: ["@svgr/webpack"],
    });

    // make Next.js aware of how to import uncompiled TypeScript files
    // from our component-library and other shared packages
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".jsx": [".tsx", ".jsx"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    };

    // Resolve workspace dependencies for pyth-solana-receiver
    // Point to the built dist folders or source if not built
    const priceServicePath = path.resolve(
      __dirname,
      "../../price_service/sdk/js",
    );
    const solanaUtilsPath = path.resolve(
      __dirname,
      "../../target_chains/solana/sdk/js/solana_utils",
    );

    config.resolve.alias = {
      ...config.resolve.alias,
      "@pythnetwork/price-service-sdk": priceServicePath,
      "@pythnetwork/solana-utils": solanaUtilsPath,
    };

    // Also add to modules to help with resolution
    if (!config.resolve.modules) {
      config.resolve.modules = ["node_modules"];
    }
    config.resolve.modules.push(priceServicePath, solanaUtilsPath);

    return config;
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

  async redirects() {
    return [
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
      // First version of docs site -> third version
      {
        source: "/evm",
        destination:
          "/price-feeds/core/use-real-time-data/pull-integration/evm",
        permanent: true,
      },

      // Second version of docs site -> third version
      {
        source: "/documentation/metrics/:path*",
        destination: "/metrics/:path*",
        permanent: true,
      },
      {
        source: "/documentation/how-pyth-works/:slug*",
        destination: "/price-feeds/core/how-pyth-works/:slug*",
        permanent: true,
      },
      {
        source: "/documentation/benchmarks",
        destination: "/price-feeds/core/use-historic-price-data",
        permanent: true,
      },
      {
        source: "/documentation/publish-data/:slug*",
        destination: "/price-feeds/core/publish-data/:slug*",
        permanent: true,
      },
      {
        source: "/documentation/solana-price-feeds/:slug*",
        destination: "/price-feeds/core/solana-price-feeds/:slug*",
        permanent: true,
      },
      {
        source: "/documentation/whitepaper/:slug*",
        destination: "/whitepaper/:slug*",
        permanent: true,
      },
      {
        source: "/documentation/security",
        destination: "/security",
        permanent: true,
      },
      {
        source: "/documentation/entropy",
        destination: "/entropy",
        permanent: true,
      },
      {
        source: "/documentation/entropy/protocol-design",
        destination: "/entropy/protocol-design",
        permanent: true,
      },
      {
        source: "/documentation/entropy/best-practices",
        destination: "/entropy/best-practices",
        permanent: true,
      },
      {
        source: "/documentation/entropy/solidity-sdk",
        destination: "/entropy/generate-random-numbers-evm",
        permanent: true,
      },
      {
        source: "/documentation/entropy/evm",
        destination: "/entropy/generate-random-numbers-evm",
        permanent: true,
      },
      {
        source: "/documentation/pythnet-price-feeds",
        destination: "/price-feeds/core/pythnet-price-feeds",
        permanent: true,
      },
      {
        source: "/documentation/pythnet-price-feeds/on-demand",
        destination: "/price-feeds/core/pull-updates",
        permanent: true,
      },
      {
        source: "/documentation/pythnet-price-feeds/best-practices",
        destination: "/price-feeds/core/best-practices",
        permanent: true,
      },
      {
        source: "/price-feeds/pythnet-price-feeds/best-practices",
        destination: "/price-feeds/core/best-practices",
        permanent: true,
      },
      {
        source: "/price-feeds/pythnet-price-feeds/pull-updates",
        destination: "/price-feeds/core/pull-updates",
        permanent: true,
      },
      {
        source: "/price-feeds/solana-price-feeds/best-practices",
        destination: "/price-feeds/core/best-practices",
        permanent: true,
      },
      {
        source: "/documentation/pythnet-price-feeds/hermes",
        destination: "/price-feeds/core/how-pyth-works/hermes",
        permanent: true,
      },
      {
        source: "/pythnet-price-feeds/hermes",
        destination: "/price-feeds/core/how-pyth-works/hermes",
        permanent: true,
      },
      {
        source: "/documentation/pythnet-price-feeds/scheduler",
        destination:
          "/price-feeds/core/schedule-price-updates/using-price-pusher",
        permanent: true,
      },
      {
        source: "/price-feeds/schedule-price-updates/using-scheduler",
        destination:
          "/price-feeds/core/schedule-price-updates/using-price-pusher",
        permanent: true,
      },
      {
        source: "/documentation/pythnet-price-feeds/off-chain",
        destination: "/price-feeds/core/fetch-price-updates",
        permanent: true,
      },
      {
        source: "/price-feeds/use-real-time-data/off-chain",
        destination: "/price-feeds/core/fetch-price-updates",
        permanent: true,
      },
      {
        source: "/documentation/pythnet-price-feeds/evm",
        destination:
          "/price-feeds/core/use-real-time-data/pull-integration/evm",
        permanent: true,
      },
      {
        source: "/documentation",
        destination: "/price-feeds",
        permanent: true,
      },
      {
        source: "/api-explorer/:slug*",
        destination: "/price-feeds/core/api-reference/:slug*",
        permanent: true,
      },
      {
        source: "/guides/how-to-schedule-price-updates-with-gelato",
        destination: "/price-feeds/core/schedule-price-updates/using-gelato",
        permanent: true,
      },
      {
        source: "/guides/how-to-create-tradingview-charts",
        destination: "/price-feeds/core/create-tradingview-charts",
        permanent: true,
      },
      {
        source: "/home/oracle-integrity-staking/examples",
        destination: "/oracle-integrity-staking/reward-examples",
        permanent: true,
      },
      {
        source: "/guides",
        destination: "/price-feeds",
        permanent: true,
      },

      // Lazer (top-level) to Pyth Pro Redirects - MUST come before general price-feeds redirects
      {
        source: "/lazer",
        destination: "/price-feeds/pro",
        permanent: true,
      },
      {
        source: "/lazer/:path*",
        destination: "/price-feeds/pro/:path*",
        permanent: true,
      },

      // Explicitly map legacy lazer paths under /price-feeds to Pro - MUST come before general price-feeds redirects
      {
        source: "/price-feeds/lazer",
        destination: "/price-feeds/pro",
        permanent: true,
      },
      {
        source: "/price-feeds/lazer/:path*",
        destination: "/price-feeds/pro/:path*",
        permanent: true,
      },

      {
        source:
          "/price-feeds/:path((?!core(?:/|$)|pro(?:/|$)|hip-3-service(?:/|$)).*)",
        destination: "/price-feeds/core/:path",
        permanent: true,
      },

      // HIP-3 redirect - fumadocs meta.json links prepend parent path
      {
        source: "/price-feeds/core/hip-3-service",
        destination: "/price-feeds/hip-3-service",
        permanent: true,
      },

      // some other price feed redirects
      {
        source: "/price-feeds/sponsored-feeds",
        destination: "/price-feeds/core/push-feeds",
        permanent: true,
      },
      {
        source: "/price-feeds/core/sponsored-feeds",
        destination: "/price-feeds/core/push-feeds",
        permanent: true,
      },
      {
        source:
          "/price-feeds/use-real-time-data/:path((?!pull-integration(?:/|$)).*)",
        destination:
          "/price-feeds/core/use-real-time-data/pull-integration/:path",
        permanent: true,
      },
      {
        source:
          "/price-feeds/core/use-real-time-data/:path((?!pull-integration(?:/|$)|push-integration(?:/|$)|index(?:/|$)).*)",
        destination:
          "/price-feeds/core/use-real-time-data/pull-integration/:path",
        permanent: true,
      },
      {
        source: "/benchmarks",
        destination: "/price-feeds/core/use-historic-price-data",
        permanent: true,
      },
      {
        source: "/benchmarks/how-to-create-tradingview-charts",
        destination: "/price-feeds/core/create-tradingview-charts",
        permanent: true,
      },
      {
        source: "/benchmarks/api-instances",
        destination: "/price-feeds/core/api-reference",
        permanent: true,
      },
      {
        source: "/benchmarks/rate-limits",
        destination: "/price-feeds/core/rate-limits",
        permanent: true,
      },

      // External API reference redirects (non-permanent)
      {
        source: "/price-feeds/api-reference/evm/:slug",
        destination: "https://api-reference.pyth.network/price-feeds/evm/:slug",
        permanent: false,
      },
      {
        source: "/price-feeds/api-reference/evm",
        destination: "https://api-reference.pyth.network/price-feeds/evm/",
        permanent: false,
      },
    ];
  },
};

const withMDX = createMDX();

export default withMDX(config);
