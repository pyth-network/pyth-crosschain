"use client";

import { useEffect, useState } from "react";

/**
 * detects which color-scheme is active by checking
 * to see which color scheme is present on the body,
 * and if one isn't available, falling back to
 * the user's system preference
 */
export function useDetectThemePreference() {
  /** state */
  const [themePreference, setThemePreference] = useState<
    "dark" | "light" | undefined
  >(undefined);

  /** effects */
  useEffect(() => {
    const prefersDarkQuery = globalThis.window.matchMedia(
      "(prefers-color-scheme: dark)",
    );
    const bodyColorScheme = (getComputedStyle(globalThis.document.body)
      .colorScheme || undefined) as typeof themePreference | undefined;

    setThemePreference(
      bodyColorScheme ?? (prefersDarkQuery.matches ? "dark" : "light"),
    );

    const mo = new MutationObserver(() => {
      debugger;
      const { colorScheme } = getComputedStyle(globalThis.document.body);
      if (!colorScheme) return;
      setThemePreference(colorScheme as typeof themePreference);
    });

    mo.observe(globalThis.document.body, {
      attributeFilter: ["style"],
      attributes: true,
    });

    return () => {
      mo.disconnect();
    };
  }, []);

  return { themePreference };
}
