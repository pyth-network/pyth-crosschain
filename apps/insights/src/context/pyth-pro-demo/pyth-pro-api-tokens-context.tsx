import type { Nullish } from "@pythnetwork/shared-lib/types";
import type { PropsWithChildren } from "react";
import { createContext, use, useCallback, useMemo, useState } from "react";

import type {
  AllDataSourcesType,
  ApiTokensState,
} from "../../schemas/pyth/pyth-pro-demo-schema";

export type ApiTokensContextVal = ApiTokensState & {
  updateApiToken: (
    dataSource: AllDataSourcesType,
    apiToken: Nullish<string>,
  ) => void;
};

const context = createContext<Nullish<ApiTokensContextVal>>(undefined);

export function PythProApiTokensProvider({ children }: PropsWithChildren) {
  /** state */
  const [apiTokens, setApiTokens] = useState<ApiTokensState>({});

  /** callbacks */
  const updateApiToken = useCallback<ApiTokensContextVal["updateApiToken"]>(
    (dataSource, apiToken) => {
      setApiTokens((prev) => ({
        ...prev,
        [dataSource]: apiToken,
      }));
    },
    [],
  );

  /** provider val */
  const providerVal = useMemo<ApiTokensContextVal>(
    () => ({
      ...apiTokens,
      updateApiToken,
    }),
    [apiTokens, updateApiToken],
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
