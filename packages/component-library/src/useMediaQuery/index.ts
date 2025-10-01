import { useEffect, useState } from 'react';

import styles from './index.module.scss';

export const MEDIA_BREAKPOINTS: Record<string, string> = {
  sm: styles.breakpointSm ?? "0",
  md: styles.breakpointMd ?? "0",
  lg: styles.breakpointLg ?? "0",
  xl: styles.breakpointXl ?? "0",
  "2xl": styles.breakpoint2Xl ?? "0",
}

const mediaQuery = (breakpoint: string) => `(min-width: ${breakpoint})`

export const useMediaQueryBreakpoint = (breakpoint: keyof typeof MEDIA_BREAKPOINTS, callback?: (matches: boolean) => void) => {
  return useMediaQuery(mediaQuery(MEDIA_BREAKPOINTS[breakpoint] ?? ''), callback);
}

export const useMediaQuery = (query: string, callback?: (matches: boolean) => void) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = globalThis.window.matchMedia(query);

    setMatches(media.matches);

    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
      callback?.(event.matches);
    };

    media.addEventListener("change", listener);

    return () => {
      media.removeEventListener("change", listener);
    };
  }, [query, callback]);

  return matches;
};
