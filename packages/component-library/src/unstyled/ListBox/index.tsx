"use client";

import type { ComponentProps } from "react";
import { ListBoxItem as BaseListBoxItem } from "react-aria-components";

import { usePrefetch } from "../../use-prefetch.js";

export { ListBox, ListBoxSection } from "react-aria-components";

type ListBoxItemProps<T extends object> = ComponentProps<
  typeof BaseListBoxItem<T>
> & {
  prefetch?: Parameters<typeof usePrefetch>[0]["prefetch"];
};

export const ListBoxItem = <T extends Element>({
  ref,
  prefetch,
  onHoverStart,
  ...props
}: ListBoxItemProps<T>) => {
  const prefetchProps = usePrefetch<T>({
    href: props.href,
    prefetch,
    onHoverStart,
    ref,
  });

  return <BaseListBoxItem {...props} {...prefetchProps} />;
};
