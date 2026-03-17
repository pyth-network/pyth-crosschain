"use client";

import { Paginator as PaginatorImpl } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import type { Props as SelectProps } from "@pythnetwork/component-library/Select";
import { Select } from "@pythnetwork/component-library/Select";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import { Suspense, useCallback, useMemo, useTransition } from "react";
import { useCollator } from "react-aria";

import type { ChainSlug } from "../../entropy-deployments";
import {
  CHAIN_LABELS,
  EntropyDeployments,
  getChainName,
  isSpecialChainKey,
  parseChainSlug,
} from "../../entropy-deployments";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../pages";
import { Status, StatusParams } from "../../requests";
import type { ConstrainedOmit } from "../../type-utils";
import { Status as StatusComponent } from "../Status";
import { ChainTag } from "./chain-tag";

export const SearchBar = (props: ComponentProps<typeof ResolvedSearchBar>) => (
  <Suspense fallback={<SearchInput isPending {...props} />}>
    <ResolvedSearchBar {...props} />
  </Suspense>
);

const ResolvedSearchBar = (
  props: ConstrainedOmit<
    ComponentProps<typeof SearchInput>,
    keyof ReturnType<typeof useSearchBar>
  >,
) => <SearchInput {...useSearchBar()} {...props} />;

const useSearchBar = () => {
  const search = useSearchParam({
    defaultValue: "",
    paramName: "search",
    parse: id,
    serialize: id,
  });

  return {
    defaultValue: search.value,
    isPending: search.isTransitioning,
    onChange: search.onChange,
  };
};

export const Paginator = (props: ComponentProps<typeof ResolvedPaginator>) => (
  <Suspense>
    <ResolvedPaginator {...props} />
  </Suspense>
);

const ResolvedPaginator = (
  props: ConstrainedOmit<
    ComponentProps<typeof PaginatorImpl>,
    keyof ReturnType<typeof usePaginator>
  >,
) => <PaginatorImpl {...usePaginator()} {...props} />;

const usePaginator = () => {
  const pageSize = useSearchParam({
    defaultValue: DEFAULT_PAGE_SIZE,
    paramName: "pageSize",
    parse: parseInt,
    serialize: toString,
  });
  const page = useSearchParam({
    defaultValue: 1,
    paramName: "page",
    parse: parseInt,
    preservePageOnChange: true,
    serialize: toString,
  });

  return {
    currentPage: page.value,
    isPageSizeTransitioning: pageSize.isTransitioning,
    isPageTransitioning: page.isTransitioning,
    onPageChange: page.onChange,
    onPageSizeChange: pageSize.onChange,
    pageSize: pageSize.value,
    pageSizeOptions: PAGE_SIZES as unknown as number[],
  };
};

export const StatusSelect = (
  props: ComponentProps<typeof ResolvedStatusSelect>,
) => (
  <Suspense fallback={<Select isPending options={[]} {...props} />}>
    <ResolvedStatusSelect {...props} />
  </Suspense>
);

const ResolvedStatusSelect = (
  props: ConstrainedOmit<
    SelectProps<{ id: Status | "all" }>,
    keyof ReturnType<typeof useStatusSelect>
  >,
) => <Select {...useStatusSelect()} {...props} />;

const useStatusSelect = () => {
  const status = useSearchParam({
    defaultValue: "all",
    paramName: "status",
    parse: parseStatus,
    serialize: serializeStatus,
  });

  return {
    buttonLabel:
      status.value === "all" ? (
        "Status"
      ) : (
        <StatusComponent size="xs" status={status.value} />
      ),
    isPending: status.isTransitioning,
    onSelectionChange: status.onChange,
    optionGroups: useMemo(
      () => [
        {
          name: "All",
          options: [{ id: "all" as const }],
        },
        {
          name: "Statuses",
          options: [
            { id: Status.Complete },
            { id: Status.Pending },
            { id: Status.Failed },
            { id: Status.CallbackError },
          ],
        },
      ],
      [],
    ),
    selectedKey: status.value,
    show: useCallback(
      (status: { id: Status | "all" }) =>
        status.id === "all" ? (
          "All"
        ) : (
          <StatusComponent size="xs" status={status.id} />
        ),
      [],
    ),
  };
};

const parseStatus = (value: string) => {
  switch (value) {
    case StatusParams[Status.Pending]: {
      return Status.Pending;
    }
    case StatusParams[Status.CallbackError]: {
      return Status.CallbackError;
    }
    case StatusParams[Status.Complete]: {
      return Status.Complete;
    }
    case StatusParams[Status.Failed]: {
      return Status.Failed;
    }
    default: {
      return "all";
    }
  }
};

const serializeStatus = (value: ReturnType<typeof parseStatus>) =>
  value === "all" ? "" : StatusParams[value];

export const ChainSelect = (
  props: ComponentProps<typeof ResolvedChainSelect>,
) => (
  <Suspense fallback={<Select isPending options={[]} {...props} />}>
    <ResolvedChainSelect {...props} />
  </Suspense>
);

const ResolvedChainSelect = (
  props: ConstrainedOmit<
    SelectProps<{ id: ChainSlug }>,
    keyof ReturnType<typeof useChainSelect>
  >,
) => <Select {...useChainSelect()} {...props} />;

const useChainSelect = () => {
  const chain = useSearchParam<ChainSlug>({
    defaultValue: "all-mainnet",
    paramName: "chain",
    parse: parseChainSlug,
    serialize: toString,
  });
  const collator = useCollator();

  return {
    buttonLabel: getChainName(chain.value),
    isPending: chain.isTransitioning,
    onSelectionChange: chain.onChange,
    optionGroups: useMemo(
      () => [
        {
          name: "MAINNET",
          options: [
            { id: "all-mainnet" as const },
            ...entropyDeploymentsByNetwork(collator, false),
          ],
        },
        {
          name: "TESTNET",
          options: [
            { id: "all-testnet" as const },
            ...entropyDeploymentsByNetwork(collator, true),
          ],
        },
      ],
      [collator],
    ),
    selectedKey: chain.value,
    show: useCallback(
      (chain: { id: ChainSlug }) =>
        isSpecialChainKey(chain.id) ? (
          CHAIN_LABELS[chain.id]
        ) : (
          <ChainTag chain={EntropyDeployments[chain.id]} />
        ),
      [],
    ),
    textValue: useCallback(
      (chain: { id: ChainSlug }) => getChainName(chain.id),
      [],
    ),
    ...(!isSpecialChainKey(chain.value) && {
      icon: (
        <Image
          alt=""
          height={20}
          src={EntropyDeployments[chain.value].icon}
          width={20}
        />
      ),
    }),
  };
};

const entropyDeploymentsByNetwork = (
  collator: ReturnType<typeof useCollator>,
  isTestnet: boolean,
) =>
  Object.entries(EntropyDeployments)
    .map(([slug, chain]) => {
      return {
        ...chain,
        id: slug as keyof typeof EntropyDeployments,
      };
    })
    .filter((chain) => chain.isTestnet === isTestnet)
    .toSorted((a, b) => collator.compare(a.name, b.name));

const id = <T,>(value: T) => value;
// biome-ignore lint/suspicious/noShadowRestrictedNames: Helper function intentionally shadows global parseInt for consistency
const parseInt = (value: string) => Number.parseInt(value, 10);
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
// biome-ignore lint/suspicious/noShadowRestrictedNames: Helper function intentionally shadows global toString for consistency
const toString = <T extends { toString: () => string }>(value: T) =>
  value.toString();

const useSearchParam = <T,>({
  paramName,
  parse,
  defaultValue,
  preservePageOnChange,
  serialize,
}: {
  paramName: string;
  parse: (value: string) => T;
  defaultValue: T;
  preservePageOnChange?: boolean | undefined;
  serialize: (value: T) => string;
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isTransitioning, startTransition] = useTransition();

  const value = useMemo(() => {
    const paramValue = searchParams.get(paramName);
    return paramValue ? parse(paramValue) : defaultValue;
  }, [searchParams, paramName, parse, defaultValue]);

  return {
    isTransitioning,
    onChange: useCallback(
      (newValue: T) => {
        if (newValue !== value) {
          startTransition(() => {
            const params = new URLSearchParams(searchParams);
            if (newValue === defaultValue) {
              params.delete(paramName);
            } else {
              params.set(paramName, serialize(newValue));
              if (!preservePageOnChange) {
                params.delete("page");
              }
            }
            router.replace(`${pathname}?${params.toString()}`);
          });
        }
      },
      [
        searchParams,
        pathname,
        router,
        value,
        defaultValue,
        paramName,
        preservePageOnChange,
        serialize,
      ],
    ),
    value,
  };
};
