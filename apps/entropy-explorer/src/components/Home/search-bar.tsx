"use client";

import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import type { ComponentProps } from "react";
import { Suspense } from "react";

import { useQuery } from "./use-query";
import type { ConstrainedOmit } from "../../type-utils";

export const SearchBar = (props: ComponentProps<typeof ResolvedSearchBar>) => (
  <Suspense fallback={<SearchInput isPending {...defaultProps} {...props} />}>
    <ResolvedSearchBar {...props} />
  </Suspense>
);

const ResolvedSearchBar = (
  props: ConstrainedOmit<
    ComponentProps<typeof SearchInput>,
    keyof typeof defaultProps | "value" | "onChange"
  >,
) => {
  const { search, setSearch } = useQuery();

  return (
    <SearchInput
      {...defaultProps}
      {...props}
      value={search}
      onChange={setSearch}
    />
  );
};

const defaultProps = {
  size: "sm",
  placeholder: "Sequence number, provider, sender or tx hash",
} as const;
