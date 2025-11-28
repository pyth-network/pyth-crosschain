/* eslint-disable unicorn/no-null */
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { useLocalStorageValue } from "@react-hookz/web";
import type { PropsWithChildren } from "react";
import { createContext, use, useCallback, useMemo } from "react";

import type {
  AllDataSourcesType,
  ApiTokensState,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import { ALL_DATA_SOURCES } from "../../schemas/pyth/pyth-pro-demo-schema";

const API_TOKEN_STORAGE_KEY = "__pyth-pro-demo-api-token-storage__";

export type ApiTokensContextVal = {
  tokens: ApiTokensState;
  updateApiToken: (
    dataSource: AllDataSourcesType,
    apiToken: Nullish<string>,
  ) => void;
};

const context = createContext<Nullish<ApiTokensContextVal>>(undefined);

const initialState = Object.fromEntries(
  ALL_DATA_SOURCES.options.map((dataSource) => [dataSource, null]),
) as Record<AllDataSourcesType, string | null>;

export function PythProApiTokensProvider({ children }: PropsWithChildren) {
  /** hooks */
  const { set: setTokens, value: tokens = initialState } =
    useLocalStorageValue<ApiTokensState>(API_TOKEN_STORAGE_KEY, {
      defaultValue: initialState,
    });

  /** callbacks */
  const updateApiToken = useCallback<ApiTokensContextVal["updateApiToken"]>(
    (dataSource, apiToken) => {
      setTokens((prev) => ({
        ...(prev ?? initialState),
        [dataSource]: apiToken,
      }));
    },
    [setTokens],
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
