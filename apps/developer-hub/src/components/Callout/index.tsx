"use client";

import { Link } from "@pythnetwork/component-library/unstyled/Link";
import clsx from "clsx";
import type { ComponentProps, ElementType, ReactNode } from "react";

import styles from "./index.module.scss";

export const VARIANTS = [
  "default",
  "primary",
  "secondary",
  "tertiary",
  "error",
  "info",
  "warning",
  "important",
  "success",
] as const;

type OwnProps = {
  variant?: (typeof VARIANTS)[number] | undefined;
  icon?: ReactNode | undefined;
  nonInteractive?: boolean | undefined;
};

export type Props<T extends ElementType> = Omit<
  ComponentProps<T>,
  keyof OwnProps
> &
  OwnProps;

export const Callout = (
  props: (Props<"div"> & { nonInteractive?: true }) | Props<typeof Link>,
) => {
  if (props.nonInteractive) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { nonInteractive, ...otherProps } = props;
    return <div {...calloutProps(otherProps)} />;
  } else if ("href" in props) {
    return <Link {...calloutProps(props)} />;
  } else {
    return <div {...calloutProps(props)} />;
  }
};

const calloutProps = <T extends ElementType>({
  className,
  variant = "default",
  children,
  icon,
  ...props
}: Props<T>) => ({
  ...props,
  "data-variant": variant,
  className: clsx(styles.callout, className),
  children: (
    <>
      <div className={styles.hover} />
      <div className={styles.body}>
        {Boolean(icon) && <div className={styles.icon}>{icon}</div>}
        <div>
          {children}
        </div>
      </div>
    </>
  ),
});
