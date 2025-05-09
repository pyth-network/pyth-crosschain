import { useLogger } from "@pythnetwork/component-library/useLogger";
import { useQueryStates, parseAsString, parseAsStringEnum } from "nuqs";
import { useCallback, useMemo } from "react";

import { EntropyDeployments } from "../../entropy-deployments";
import { Status } from "../../requests";

const StatusParams = {
  [Status.Pending]: "pending",
  [Status.Complete]: "complete",
  [Status.CallbackError]: "callback-error",
} as const;

const queryParams = {
  status: parseAsStringEnum<(typeof StatusParams)[Status]>(
    Object.values(StatusParams),
  ),
  search: parseAsString.withDefault(""),
  chain: parseAsStringEnum<keyof typeof EntropyDeployments>(
    Object.keys(EntropyDeployments) as (keyof typeof EntropyDeployments)[],
  ),
};

export const useQuery = () => {
  const logger = useLogger();
  const [{ search, chain, status }, setQuery] = useQueryStates(queryParams);

  const updateQuery = useCallback(
    (newQuery: Parameters<typeof setQuery>[0]) => {
      setQuery(newQuery).catch((error: unknown) => {
        logger.error("Failed to update query", error);
      });
    },
    [setQuery, logger],
  );

  const setSearch = useCallback(
    (newSearch: string) => {
      updateQuery({ search: newSearch });
    },
    [updateQuery],
  );

  const setChain = useCallback(
    (newChain: keyof typeof EntropyDeployments | "all") => {
      // eslint-disable-next-line unicorn/no-null
      updateQuery({ chain: newChain === "all" ? null : newChain });
    },
    [updateQuery],
  );

  const setStatus = useCallback(
    (newStatus: Status | "all") => {
      updateQuery({
        // eslint-disable-next-line unicorn/no-null
        status: newStatus === "all" ? null : StatusParams[newStatus],
      });
    },
    [updateQuery],
  );

  return {
    search,
    chain,
    status: useMemo(() => {
      switch (status) {
        case "pending": {
          return Status.Pending;
        }
        case "callback-error": {
          return Status.CallbackError;
        }
        case "complete": {
          return Status.Complete;
        }
        // eslint-disable-next-line unicorn/no-null
        case null: {
          // eslint-disable-next-line unicorn/no-null
          return null;
        }
      }
    }, [status]),
    setSearch,
    setChain,
    setStatus,
  };
};
