"use client";

import type { Nullish } from "@pythnetwork/shared-lib/types";
import clsx from "clsx";
import type { ComponentProps } from "react";

import { classes } from "./Badge.styles";
import type { BadgeSize, BadgeStyle, BadgeVariant } from "./types";

type Props = ComponentProps<"span"> & {
  size?: Nullish<BadgeSize>;
  style?: Nullish<BadgeStyle>;
  variant?: Nullish<BadgeVariant>;
};

export const Badge = ({
  className,
  variant = "neutral",
  size = "md",
  style = "filled",
  children,
  ...props
}: Props) => (
  <span
    className={clsx(classes.root, className)}
    data-variant={variant}
    data-size={size}
    data-style={style}
    {...props}
  >
    {children}
  </span>
);
