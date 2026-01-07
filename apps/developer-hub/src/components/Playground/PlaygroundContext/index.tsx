"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import type { PlaygroundConfig } from "../types";
import { DEFAULT_CONFIG } from "../types";

/**
 * Context value type for the Playground
 */
type PlaygroundContextValue = {
  /** Current playground configuration state */
  config: PlaygroundConfig;
  /** Update one or more config fields */
  updateConfig: (partial: Partial<PlaygroundConfig>) => void;
};

const PlaygroundContext = createContext<PlaygroundContextValue | undefined>(
  undefined,
);

type PlaygroundProviderProps = {
  children: ReactNode;
  /** Optional initial config to override defaults */
  initialConfig?: Partial<PlaygroundConfig>;
};

/**
 * Provider component for Playground state management.
 * Wrap your playground components with this to enable context access.
 */
export function PlaygroundProvider({
  children,
  initialConfig,
}: PlaygroundProviderProps) {
  const [config, setConfig] = useState<PlaygroundConfig>(() => ({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  }));

  const updateConfig = useCallback((partial: Partial<PlaygroundConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const value = useMemo(
    () => ({
      config,
      updateConfig,
    }),
    [config, updateConfig],
  );

  return (
    <PlaygroundContext.Provider value={value}>
      {children}
    </PlaygroundContext.Provider>
  );
}

/**
 * Hook to access Playground context.
 * Must be used within a PlaygroundProvider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { config, updateConfig } = usePlaygroundContext();
 *
 *   return (
 *     <input
 *       value={config.accessToken}
 *       onChange={(e) => updateConfig({ accessToken: e.target.value })}
 *     />
 *   );
 * }
 * ```
 */
export function usePlaygroundContext(): PlaygroundContextValue {
  const context = useContext(PlaygroundContext);

  if (context === undefined) {
    throw new Error(
      "usePlaygroundContext must be used within a PlaygroundProvider",
    );
  }

  return context;
}
