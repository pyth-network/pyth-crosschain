"use client";

import { ListboxButton } from "@headlessui/react";
import {
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useTheme } from "next-themes";
import { createElement } from "react";

import { useIsMounted } from "../../use-is-mounted";
import { Select } from "../Select";

const VALID_THEMES = ["system", "light", "dark"] as const;

const THEME_ICONS = {
  light: SunIcon,
  dark: MoonIcon,
  system: ComputerDesktopIcon,
};

const THEME_TEXT = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const buttonClasses =
  "grid place-content-center w-12 h-10 px-3 rounded text-neutral-500";

export const ColorThemeSelector = () => {
  const isMounted = useIsMounted();
  const {
    theme: themeFromNextThemes,
    setTheme,
    resolvedTheme: resolvedThemeFromNextThemes,
  } = useTheme();
  const theme = isValidTheme(themeFromNextThemes)
    ? themeFromNextThemes
    : "system";
  const resolvedTheme = isValidTheme(resolvedThemeFromNextThemes)
    ? resolvedThemeFromNextThemes
    : "system";

  return isMounted ? (
    <Select
      value={theme}
      onChange={setTheme}
      options={VALID_THEMES}
      renderOption={(theme) => (
        <>
          {createElement(THEME_ICONS[theme], {
            className:
              "h-5 text-neutral-500 group-data-[selected]:text-pythpurple-600 dark:text-neutral-400 dark:group-data-[selected]:text-pythpurple-400",
          })}
          <div>{THEME_TEXT[theme]}</div>
        </>
      )}
      renderButton={() => (
        <ListboxButton
          className={clsx(
            "hover:bg-neutral-100 dark:hover:bg-neutral-800",
            buttonClasses,
          )}
        >
          {createElement(THEME_ICONS[resolvedTheme], {
            className: "w-full stroke-2",
          })}
          <div className="sr-only">Select theme</div>
        </ListboxButton>
      )}
    />
  ) : (
    <div className={buttonClasses} />
  );
};

const isValidTheme = (
  theme: string | undefined,
): theme is (typeof VALID_THEMES)[number] =>
  theme !== undefined && (VALID_THEMES as readonly string[]).includes(theme);
