"use client";

import clsx from "clsx";
import type { ComponentProps } from "react";
import { Button as ReactAriaButton } from "react-aria-components";

import { Link } from "../Link";

type VariantProps = {
  variant?: "secondary" | undefined;
  size?: "small" | "nopad" | "noshrink" | undefined;
};

type ButtonProps = Omit<ComponentProps<typeof ReactAriaButton>, "isDisabled"> &
  VariantProps & {
    isLoading?: boolean | undefined;
    isDisabled?: boolean | undefined;
  };

export const Button = ({
  isLoading,
  variant,
  size,
  isDisabled,
  className,
  ...props
}: ButtonProps) => (
  <ReactAriaButton
    isDisabled={isLoading === true || isDisabled === true}
    className={clsx(
      "disabled:border-neutral-50/10 disabled:bg-neutral-50/10 disabled:text-white/60",
      isLoading ? "cursor-wait" : "disabled:cursor-not-allowed",
      baseClassName({ variant, size }),
      className,
    )}
    {...props}
  />
);

type LinkButtonProps = ComponentProps<typeof Link> & VariantProps;

export const LinkButton = ({
  variant,
  size,
  className,
  ...props
}: LinkButtonProps) => (
  <Link
    className={clsx(baseClassName({ variant, size }), className)}
    {...props}
  />
);

const baseClassName = (props: VariantProps) =>
  clsx(
    "border border-pythpurple-600 hover:bg-pythpurple-600/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400",
    variantClassName(props.variant),
    sizeClassName(props.size),
  );

const variantClassName = (variant: VariantProps["variant"]) => {
  switch (variant) {
    case "secondary": {
      return "bg-pythpurple-600/20";
    }
    case undefined: {
      return "bg-pythpurple-600/50";
    }
  }
};

const sizeClassName = (size: VariantProps["size"]) => {
  switch (size) {
    case "small": {
      return "text-sm px-2 sm:px-3 py-1";
    }
    case "nopad": {
      return "px-0 py-0";
    }
    case "noshrink": {
      return "px-8 py-2";
    }
    case undefined: {
      return "px-2 sm:px-4 md:px-8 py-2";
    }
  }
};
