import type { Preview, Decorator } from "@storybook/react";
import { useEffect } from "react";

import styles from "./storybook.module.scss";
import { BodyProviders } from "../src/AppShell/body-providers.jsx";
import { sans } from "../src/AppShell/fonts";
import { RootProviders } from "../src/AppShell/index.jsx";
import shellStyles from "../src/AppShell/index.module.scss";

const preview = {
  globalTypes: {
    theme: {
      description: "Theme",
      toolbar: {
        title: "Theme",
        icon: "sun",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
    background: {
      description: "Background",
      toolbar: {
        title: "Background",
        icon: "switchalt",
        items: [
          { value: "primary", title: "Primary", icon: "switchalt" },
          { value: "secondary", title: "Secondary", icon: "contrast" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    background: "primary",
    theme: "light",
  },
  parameters: {
    layout: "centered",
    actions: { argTypesRegex: "^on[A-Z].*" },
    nextjs: {
      appDirectory: true,
      navigation: {
        segments: [],
      },
    },
  },
} satisfies Preview;

export default preview;

export const decorators: Decorator[] = [
  (Story, { globals, parameters }) => {
    useEffect(() => {
      document.documentElement.classList.add(
        sans.className,
        shellStyles.html ?? "",
      );
      document.body.classList.add(shellStyles.body ?? "");
    }, []);
    return (
      <RootProviders>
        {globals.bare ? (
          <Story />
        ) : (
          <BodyProviders
            className={styles.contents ?? ""}
            {...(isValidTheme(globals.theme) && { theme: globals.theme })}
            {...(typeof parameters.layout === "string" && {
              "data-layout": parameters.layout,
            })}
            {...(typeof globals.background === "string" && {
              "data-background": globals.background,
            })}
          >
            <Story />
          </BodyProviders>
        )}
      </RootProviders>
    );
  },
];

const isValidTheme = (theme: unknown): theme is "light" | "dark" =>
  theme === "light" || theme === "dark";
