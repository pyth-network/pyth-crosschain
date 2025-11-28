/* eslint-disable unicorn/no-null */
import type { Nullish } from "@pythnetwork/shared-lib/types";
import type { PropsWithChildren } from "react";
import { createContext, use, useCallback, useMemo, useState } from "react";

import type {
  AllDataSourcesType,
  ApiTokensState,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import { ALL_DATA_SOURCES } from "../../schemas/pyth/pyth-pro-demo-schema";

export type ApiTokensContextVal = {
  tokens: ApiTokensState;
  updateApiToken: (
    dataSource: AllDataSourcesType,
    apiToken: Nullish<string>,
  ) => void;
};

const context = createContext<Nullish<ApiTokensContextVal>>(undefined);

export function PythProApiTokensProvider({ children }: PropsWithChildren) {
  /** state */
  const [tokens, setTokens] = useState<ApiTokensState>(
    () =>
      Object.fromEntries(
        ALL_DATA_SOURCES.options.map((dataSource) => [dataSource, null]),
      ) as Record<AllDataSourcesType, string | null>,
  );

  /** callbacks */
  const updateApiToken = useCallback<ApiTokensContextVal["updateApiToken"]>(
    (dataSource, apiToken) => {
      setTokens((prev) => ({
        ...prev,
        [dataSource]: apiToken,
      }));
    },
    [],
  );

  /** provider val */
  const providerVal = useMemo<ApiTokensContextVal>(
    () => ({
      tokens,
      updateApiToken,
    }),
    [tokens, updateApiToken],
  );

  return <context.Provider value={providerVal}>{children}</context.Provider>;
}

export function usePythProApiTokensContext() {
  const ctx = use(context);
  if (!ctx) {
    throw new Error(
      "unable to usePythProApiTokensContext() because no <PythProApiTokensProvider /> was found in the parent tree",
    );
  }

  return ctx;
}
