"use client";

import { Sun, Moon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@pythnetwork/component-library/Button";
import clsx from "clsx";
import { useTheme } from "next-themes";
import { type ComponentProps, useCallback } from "react";

type Props = Omit<
  ComponentProps<typeof Button>,
  "beforeIcon" | "variant" | "size" | "hideText" | "children" | "onPress"
>;

export const ThemeSwitch = (props: Props) => {
  const { theme, setTheme } = useTheme();

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <Button
      variant="ghost"
      size="sm"
      hideText
      onPress={toggleTheme}
      beforeIcon={Icon}
      {...props}
    >
      Dark mode
    </Button>
  );
};

const Icon = ({ className, ...props }: ComponentProps<typeof Sun>) => (
  <>
    <Sun className={clsx("hidden dark:block", className)} {...props} />
    <Moon className={clsx("dark:hidden", className)} {...props} />
  </>
);
