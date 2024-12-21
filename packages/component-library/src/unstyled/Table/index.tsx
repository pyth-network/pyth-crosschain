"use client";

import type { ComponentProps } from "react";
import { Row as BaseRow } from "react-aria-components";

import { usePrefetch } from "../../use-prefetch.js";

export {
  type SortDescriptor,
  Cell,
  Column,
  Table,
  TableBody,
  TableHeader,
} from "react-aria-components";

type RowProps<T extends object> = ComponentProps<typeof BaseRow<T>> & {
  prefetch?: Parameters<typeof usePrefetch>[0]["prefetch"];
};

export const Row = <T extends object>({
  ref,
  prefetch,
  onHoverStart,
  ...props
}: RowProps<T>) => {
  const prefetchProps = usePrefetch<HTMLTableRowElement>({
    href: props.href,
    prefetch,
    onHoverStart,
    ref: ref,
  });

  return <BaseRow {...props} {...prefetchProps} />;
};
