import { useLogger } from "@pythnetwork/component-library/useLogger";
import { useQueryStates, parseAsString, parseAsStringEnum } from "nuqs";
import { useCallback } from "react";

import { EntropyDeployments } from "../../entropy-deployments";

const queryParams = {
  search: parseAsString.withDefault(""),
  chain: parseAsStringEnum<keyof typeof EntropyDeployments>(
    Object.keys(EntropyDeployments) as (keyof typeof EntropyDeployments)[],
  ),
};

export const useQuery = () => {
  const logger = useLogger();
  const [{ search, chain }, setQuery] = useQueryStates(queryParams);

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
    (newChain: keyof typeof EntropyDeployments | undefined) => {
      // eslint-disable-next-line unicorn/no-null
      updateQuery({ chain: newChain ?? null });
    },
    [updateQuery],
  );

  return {
    search,
    chain,
    setSearch,
    setChain,
  };
};
