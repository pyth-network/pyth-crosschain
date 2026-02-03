import type { Nullish } from "@pythnetwork/shared-lib/types";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";

function getThemePreferenceMediaQuery() {
  return globalThis.window.matchMedia("(prefers-color-scheme: dark)");
}

/**
 * wrapped version of the useTheme() hook from "next-themes,"
 * this one also detect if a user has selected the "system" theme
 * and, if so, returns their current color-scheme theme preference
 * (which comes directly from their OS or from their browser's settings)
 */
export function useAppTheme() {
  /** state */
  const [darkQuery, setDarkQuery] =
    useState<Nullish<ReturnType<typeof getThemePreferenceMediaQuery>>>(
      undefined,
    );
  const [browserThemePreference, setBrowserThemePreference] = useState<
    "dark" | "light" | "system"
  >("system");

  /** hooks */
  const { theme, setTheme, ...rest } = useTheme();

  /** callbacks */
  const toggleTheme = useCallback(
    (explicitTheme?: typeof theme) => {
      if (explicitTheme) {
        setTheme(explicitTheme);
        return;
      }

      const currentTheme = theme ?? "system";
      if (currentTheme === "system") {
        setTheme("light");
      } else if (currentTheme === "light") {
        setTheme("dark");
      } else {
        setTheme("system");
      }
    },
    [setTheme, theme],
  );

  /** effects */
  useEffect(() => {
    setDarkQuery(getThemePreferenceMediaQuery());
  }, []);

  useEffect(() => {
    if (!darkQuery) return;

    // sync initial query
    setBrowserThemePreference(darkQuery.matches ? "dark" : "light");

    const handleChange = (e: MediaQueryListEvent) => {
      setBrowserThemePreference(e.matches ? "dark" : "light");
    };

    darkQuery.addEventListener("change", handleChange);

    return () => {
      darkQuery.removeEventListener("change", handleChange);
    };
  }, [darkQuery]);

  const effectiveTheme =
    !theme || theme === "system"
      ? (browserThemePreference as "dark" | "light")
      : (theme as "dark" | "light");

  return {
    ...rest,
    effectiveTheme,
    isSystem: !theme || theme === "system",
    theme,
    toggleTheme,
  };
}
