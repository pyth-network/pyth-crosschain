import { createRequire } from "node:module";

import type { StorybookConfig } from "@storybook/nextjs";

const resolve = createRequire(import.meta.url).resolve;

const config = {
  addons: [
    "@storybook/addon-themes",
    {
      name: "@storybook/addon-styling-webpack",
      options: {
        rules: [
          {
            test: /\.s?[ac]ss$/i,
            use: [
              "style-loader",
              {
                loader: "css-loader",
                options: {
                  esModule: false,
                  importLoaders: 1,
                  modules: {
                    auto: true,
                    exportLocalsConvention: "as-is",
                    localIdentName: "[name]__[local]--[hash:base64:5]",
                  },
                },
              },
              {
                loader: "sass-loader",
                options: { implementation: resolve("sass") },
              },
            ],
          },
        ],
      },
    },
  ],

  features: {
    backgrounds: true,
    measure: false,
  },
  framework: "@storybook/nextjs",

  stories: [
    "../src/**/*.mdx",
    "../src/**/?(*.)story.tsx",
    "../src/**/?(*.)stories.tsx",
  ],

  webpackFinal: (config) => {
    config.resolve = {
      ...config.resolve,
      extensionAlias: {
        ...config.resolve?.extensionAlias,
        ".js": [".js", ".ts"],
        ".jsx": [".jsx", ".tsx"],
      },
    };

    for (const rule of config.module?.rules ?? []) {
      if (
        typeof rule === "object" &&
        rule !== null &&
        rule.test instanceof RegExp &&
        rule.test.test(".svg")
      ) {
        rule.exclude = /\.svg$/i;
      }
    }

    config.module = {
      ...config.module,
      rules: [
        ...(config.module?.rules ?? []),
        {
          test: /\.svg$/i,
          use: ["@svgr/webpack"],
        },
      ],
    };

    return config;
  },
} satisfies StorybookConfig;
export default config;
