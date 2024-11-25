import { createRequire } from "node:module";

import type { StorybookConfig } from "@storybook/nextjs";

const resolve = createRequire(import.meta.url).resolve;

const config = {
  framework: "@storybook/nextjs",

  stories: [
    "../src/**/*.mdx",
    "../src/**/?(*.)story.tsx",
    "../src/**/?(*.)stories.tsx",
  ],

  features: {
    backgroundsStoryGlobals: true,
  },

  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-themes",
    {
      name: "@storybook/addon-styling-webpack",
      options: {
        rules: [
          {
            test: /\.s[ac]ss$/i,
            use: [
              "style-loader",
              {
                loader: "css-loader",
                options: {
                  modules: {
                    auto: true,
                    localIdentName: "[name]__[local]--[hash:base64:5]",
                  },
                  importLoaders: 1,
                  esModule: false,
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

  webpackFinal: (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      extensionAlias: {
        ".js": [".js", ".ts", ".tsx"],
      },
    },
  }),
} satisfies StorybookConfig;
export default config;
