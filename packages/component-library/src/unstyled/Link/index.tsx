"use client";

import type { ComponentProps } from "react";
import { Link as BaseLink } from "react-aria-components";

import { usePrefetch } from "../../use-prefetch.js";

export type Props = ComponentProps<typeof BaseLink> & {
  prefetch?: Parameters<typeof usePrefetch>[0]["prefetch"];
};

export const Link = ({
  prefetch,
  ref,
  onHoverStart,
  onPressStart,
  ...props
}: Props) => {
  const prefetchProps = usePrefetch<HTMLAnchorElement>({
    href: props.href,
    prefetch,
    onHoverStart,
    onPressStart,
    ref,
  });

  return <BaseLink {...props} {...prefetchProps} />;
};
