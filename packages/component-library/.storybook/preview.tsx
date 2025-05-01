import { sans } from "@pythnetwork/fonts";
import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview, Decorator } from "@storybook/react";
import clsx from "clsx";

import "../src/Html/base.scss";
import styles from "./storybook.module.scss";
import { MainContent } from "../src/MainContent";

const preview = {
  parameters: {
    layout: "fullscreen",
    backgrounds: {
      disable: true,
    },
    actions: { argTypesRegex: "^on[A-Z].*" },
  },
} satisfies Preview;

export default preview;

export const decorators: Decorator[] = [
  (Story) => (
    <MainContent className={clsx(sans.className, styles.mainContent)}>
      <Story />
    </MainContent>
  ),
  withThemeByClassName({
    themes: {
      Light: styles.light ?? "",
      "Light (Secondary Background)": clsx(styles.light, styles.secondary),
      Dark: styles.dark ?? "",
      "Dark (Secondary Background)": clsx(styles.dark, styles.secondary),
    },
    defaultTheme: "Light",
  }),
];
