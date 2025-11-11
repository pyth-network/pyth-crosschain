import { useEffect, useMemo, useRef, useState } from "react";
import { UAParser } from "ua-parser-js";

import { usePrevious } from "./use-previous.js";

function safeGetUserAgent() {
  // this guards against this blowing up in SSR
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return globalThis.window?.navigator?.userAgent ?? "";
}

type UseDetectBrowserInfoOpts = Partial<{
  /**
   * how often to check and see if the user agent has updated
   */
  checkInterval: number;
}>;

const DEFAULT_CHECK_INTERVAL = 1000; // one secondrt

/**
 * returns relevant information about the user's browser, OS and Arch,
 * using the super popular ua-parser-js library:
 * npm i ua-parser-js
 */
export function useDetectBrowserInfo(opts?: UseDetectBrowserInfoOpts) {
  /** props */
  const { checkInterval = DEFAULT_CHECK_INTERVAL } = opts ?? {};

  /** state */
  const [userAgent, setUserAgent] = useState(() => safeGetUserAgent());

  /** hooks */
  const prevUserAgent = usePrevious(userAgent);

  /** refs */
  const prevUserAgentRef = useRef(prevUserAgent);

  /** memos */
  const details = useMemo(
    () => (userAgent ? UAParser(userAgent) : undefined),
    [userAgent],
  );

  /** effects */
  useEffect(() => {
    prevUserAgentRef.current = prevUserAgent;
  });

  useEffect(() => {
    // in case somebody is spoofing their user agent using
    // some type of browser extension, we check the user agent periodically
    // to see if it's changed, and if it has, we update what we have
    const userAgentCheckInterval = setInterval(() => {
      const ua = safeGetUserAgent();

      if (ua !== prevUserAgentRef.current) {
        setUserAgent(ua);
      }
    }, checkInterval);

    return () => {
      clearInterval(userAgentCheckInterval);
    };
  }, [checkInterval]);

  return useMemo(() => {
    if (!details) return;

    const lowerOsName = details.os.name?.toLowerCase() ?? "";
    const isMacOS = lowerOsName === "macos";
    const isWindows = lowerOsName === "windows" || lowerOsName === "win";

    return {
      ...details,
      isLinux: !isMacOS && !isWindows,
      isMacOS,
      isWindows,
    };
  }, []);
}
