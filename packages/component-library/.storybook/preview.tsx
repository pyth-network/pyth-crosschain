import type { Decorator, Preview } from "@storybook/react";
import { useEffect } from "react";

import "../src/v2/v2-theme.css";
import { BodyProviders } from "../src/AppShell/body-providers.jsx";
import { sans } from "../src/AppShell/fonts";
import { RootProviders } from "../src/AppShell/index.jsx";
import shellStyles from "../src/AppShell/index.module.scss";
import styles from "./storybook.module.scss";

const preview = {
  globalTypes: {
    background: {
      description: "Background",
      toolbar: {
        dynamicTitle: true,
        icon: "switchalt",
        items: [
          { icon: "switchalt", title: "Primary", value: "primary" },
          { icon: "contrast", title: "Secondary", value: "secondary" },
        ],
        title: "Background",
      },
    },
    theme: {
      description: "Theme",
      toolbar: {
        dynamicTitle: true,
        icon: "sun",
        items: [
          { icon: "sun", title: "Light", value: "light" },
          { icon: "moon", title: "Dark", value: "dark" },
        ],
        title: "Theme",
      },
    },
  },
  initialGlobals: {
    background: "primary",
    theme: "light",
  },
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    layout: "centered",
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
