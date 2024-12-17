import { sans } from "@pythnetwork/fonts";
import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview, Decorator } from "@storybook/react";
import clsx from "clsx";

import "../src/Html/base.scss";
import styles from "./storybook.module.scss";
import { OverlayVisibleContextProvider } from "../src/overlay-visible-context.js";

const preview = {
  parameters: {
    backgrounds: {
      grid: {
        cellSize: 4,
        cellAmount: 4,
      },
      options: [
        { name: "Primary", value: "var(--primary-background)" },
        { name: "Secondary", value: "var(--secondary-background)" },
      ],
    },
    actions: { argTypesRegex: "^on[A-Z].*" },
  },
  initialGlobals: {
    backgrounds: { value: "Primary" },
  },
} satisfies Preview;

export default preview;

export const decorators: Decorator[] = [
  (Story) => (
    <OverlayVisibleContextProvider>
      <Story />
    </OverlayVisibleContextProvider>
  ),
  withThemeByClassName({
    themes: {
      Light: clsx(sans.className, styles.light),
      Dark: clsx(sans.className, styles.dark),
    },
    defaultTheme: "Light",
  }),
];
