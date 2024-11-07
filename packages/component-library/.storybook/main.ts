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

  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-themes",
    {
      name: "@storybook/addon-styling-webpack",
      options: {
        rules: [
          {
            test: /\.css$/,
            use: [
              "style-loader",
              {
                loader: "css-loader",
                options: { importLoaders: 1 },
              },
              {
                loader: "postcss-loader",
                options: { implementation: resolve("postcss") },
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
