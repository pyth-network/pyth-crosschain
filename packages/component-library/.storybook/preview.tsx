import { sans } from "@pythnetwork/fonts";
import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview, Decorator } from "@storybook/react";
import { useEffect, type ComponentType } from "react";

import "./tailwind.css";

const preview = {
  parameters: {
    backgrounds: { disable: true },
    actions: { argTypesRegex: "^on[A-Z].*" },
  },
} satisfies Preview;

export default preview;

const withRootClasses = (...classes: string[]): Decorator => {
  const WithRootClasses = (Story: ComponentType) => {
    useEffect(() => {
      const root = document.querySelector("html");
      const classList = classes
        .flatMap((cls) => cls.split(" "))
        .filter(Boolean);
      if (root) {
        root.classList.add(...classList);
        return () => {
          root.classList.remove(...classList);
        };
      } else {
        return;
      }
    }, []);
    return <Story />;
  };
  return WithRootClasses;
};

export const decorators: Decorator[] = [
  withRootClasses("font-sans antialiased", sans.variable),
  withThemeByClassName({
    themes: {
      white: "light bg-white text-steel-900",
      light: "light bg-beige-100 text-steel-900",
      dark: "dark bg-steel-800 text-steel-50",
      darker: "dark bg-steel-900 text-steel-50",
    },
    defaultTheme: "light",
  }),
];
