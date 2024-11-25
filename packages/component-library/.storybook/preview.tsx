import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview, Decorator } from "@storybook/react";

import "../src/Html/base.scss";
import styles from "./storybook.module.scss";

const preview = {
  parameters: {
    backgrounds: {
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
  withThemeByClassName({
    themes: {
      Light: styles.light ?? "",
      Dark: styles.dark ?? "",
    },
    defaultTheme: "Light",
  }),
];
