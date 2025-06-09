"use client";

import { Paginator as PaginatorImpl } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import type { Props as SelectProps } from "@pythnetwork/component-library/Select";
import { Select } from "@pythnetwork/component-library/Select";
import Image from "next/image";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { Suspense, useCallback, useMemo, useTransition } from "react";
import { useCollator } from "react-aria";

import {
  EntropyDeployments,
  isValidDeployment,
} from "../../entropy-deployments";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../pages";
import { Status, StatusParams } from "../../requests";
import type { ConstrainedOmit } from "../../type-utils";
import { Status as StatusComponent } from "../Status";
import styles from "./search-controls.module.scss";

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
    paramName: "search",
    parse: id,
    defaultValue: "",
    serialize: id,
  });

  return {
    onChange: search.onChange,
    defaultValue: search.value,
    isPending: search.isTransitioning,
  };
};

export const Paginator = (props: ComponentProps<typeof ResolvedPaginator>) => (
  <Suspense fallback={<Paginator {...props} />}>
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
    paramName: "pageSize",
    parse: parseInt,
    defaultValue: DEFAULT_PAGE_SIZE,
    serialize: toString,
  });
  const page = useSearchParam({
    paramName: "page",
    parse: parseInt,
    defaultValue: 1,
    preservePageOnChange: true,
    serialize: toString,
  });

  return {
    currentPage: page.value,
    onPageChange: page.onChange,
    isPageTransitioning: page.isTransitioning,
    onPageSizeChange: pageSize.onChange,
    isPageSizeTransitioning: pageSize.isTransitioning,
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
    paramName: "status",
    parse: parseStatus,
    defaultValue: "all",
    serialize: serializeStatus,
  });

  return {
    selectedKey: status.value,
    onSelectionChange: status.onChange,
    isPending: status.isTransitioning,
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
    show: useCallback(
      (status: { id: Status | "all" }) =>
        status.id === "all" ? (
          "All"
        ) : (
          <StatusComponent size="xs" status={status.id} />
        ),
      [],
    ),
    buttonLabel:
      status.value === "all" ? (
        "Status"
      ) : (
        <StatusComponent size="xs" status={status.value} />
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

type Deployment =
  | ReturnType<typeof entropyDeploymentsByNetwork>[number]
  | { id: "all" };

export const ChainSelect = (
  props: ComponentProps<typeof ResolvedChainSelect>,
) => (
  <Suspense fallback={<Select isPending options={[]} {...props} />}>
    <ResolvedChainSelect {...props} />
  </Suspense>
);

const ResolvedChainSelect = (
  props: ConstrainedOmit<
    SelectProps<Deployment>,
    keyof ReturnType<typeof useChainSelect>
  >,
) => <Select {...useChainSelect()} {...props} />;

const useChainSelect = () => {
  const chain = useSearchParam({
    paramName: "chain",
    parse: parseChain,
    defaultValue: "all",
    serialize: toString,
  });
  const collator = useCollator();

  return {
    selectedKey: chain.value,
    onSelectionChange: chain.onChange,
    isPending: chain.isTransitioning,
    buttonLabel:
      chain.value === "all"
        ? "All Chains"
        : EntropyDeployments[chain.value].name,
    optionGroups: useMemo(
      () => [
        {
          name: "ALL",
          options: [{ id: "all" as const }],
          hideLabel: true,
        },
        {
          name: "MAINNET",
          options: entropyDeploymentsByNetwork(collator, false),
        },
        {
          name: "TESTNET",
          options: entropyDeploymentsByNetwork(collator, true),
        },
      ],
      [collator],
    ),
    show: useCallback(
      (chain: Deployment) =>
        chain.id === "all" ? (
          "All Chains"
        ) : (
          <div className={styles.chainSelectItem}>
            <Image alt={chain.name} src={chain.icon} width={20} height={20} />
            {chain.name}
          </div>
        ),
      [],
    ),
    textValue: useCallback(
      (chain: Deployment) => (chain.id === "all" ? "All" : chain.name),
      [],
    ),
    ...(chain.value !== "all" && {
      icon: (
        <Image
          alt={EntropyDeployments[chain.value].name}
          src={EntropyDeployments[chain.value].icon}
          width={20}
          height={20}
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
        id: Number.parseInt(slug, 10) as keyof typeof EntropyDeployments,
      };
    })
    .filter((chain) => chain.isTestnet === isTestnet)
    .toSorted((a, b) => collator.compare(a.name, b.name));

const id = <T,>(value: T) => value;
const parseInt = (value: string) => Number.parseInt(value, 10);
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
const toString = <T extends { toString: () => string }>(value: T) =>
  value.toString();

const parseChain = (value: string) => {
  if (value === "all") {
    return "all";
  } else {
    const parsedId = Number.parseInt(value, 10);
    return isValidDeployment(parsedId) ? parsedId : "all";
  }
};

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
    value,
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
        startTransition,
        defaultValue,
        paramName,
        preservePageOnChange,
        serialize,
      ],
    ),
  };
};
