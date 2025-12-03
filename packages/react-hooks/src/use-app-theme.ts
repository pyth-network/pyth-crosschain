"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

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
  /** refs */
  const darkQueryRef = useRef(getThemePreferenceMediaQuery());

  /** state */
  const [browserThemePreference, setBrowserThemePreference] = useState<
    "dark" | "light"
  >(darkQueryRef.current.matches ? "dark" : "light");

  /** hooks */
  const { theme, ...rest } = useTheme();

  /** effects */
  useEffect(() => {
    const { current: mediaQuery } = darkQueryRef;

    const handleChange = (e: MediaQueryListEvent) => {
      setBrowserThemePreference(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return {
    ...rest,
    theme: (!theme || theme === "system"
      ? browserThemePreference
      : theme) as typeof browserThemePreference,
  };
}
