"use client";

import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { Button } from "@pythnetwork/component-library/Button";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { useMemo } from "react";
import { useIsSSR } from "react-aria";

import { useToggleSearchDialog } from "./search-dialog";

export const SearchButton = () => {
  const toggleSearchDialog = useToggleSearchDialog();
  return (
    <Button
      onPress={toggleSearchDialog}
      beforeIcon={MagnifyingGlass}
      variant="outline"
      size="sm"
      rounded
    >
      <SearchText />
    </Button>
  );
};

const SearchText = () => {
  const isSSR = useIsSSR();
  return isSSR ? <Skeleton width={7} /> : <SearchTextImpl />;
};

const SearchTextImpl = () => {
  // This component can only ever render in the client so we can safely ignore
  // this eslint rule.
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  const isMac = useMemo(() => navigator.userAgent.includes("Mac"), []);
  return isMac ? "⌘ K" : "Ctrl K";
};
