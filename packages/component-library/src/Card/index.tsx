"use client";

import clsx from "clsx";
import {
  type ComponentProps,
  type ElementType,
  type ReactNode,
  use,
} from "react";
import { OverlayTriggerStateContext } from "react-aria-components";

import styles from "./index.module.scss";
import { Button } from "../unstyled/Button/index.js";
import { Link } from "../unstyled/Link/index.js";

export const VARIANTS = ["primary", "secondary", "tertiary"] as const;

type OwnProps = {
  variant?: (typeof VARIANTS)[number] | undefined;
  icon?: ReactNode | undefined;
  title?: ReactNode | undefined;
  toolbar?: ReactNode | ReactNode[] | undefined;
  footer?: ReactNode | undefined;
  nonInteractive?: boolean | undefined;
};

export type Props<T extends ElementType> = Omit<
  ComponentProps<T>,
  keyof OwnProps
> &
  OwnProps;

export const Card = (
  props:
    | (Props<"div"> & { nonInteractive?: true })
    | Props<typeof Link>
    | Props<typeof Button>,
) => {
  const overlayState = use(OverlayTriggerStateContext);

  if (props.nonInteractive) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { nonInteractive, ...otherProps } = props;
    return <div {...cardProps(otherProps)} />;
  } else if ("href" in props) {
    return <Link {...cardProps(props)} />;
  } else if (overlayState !== null || "onPress" in props) {
    return <Button {...cardProps(props)} />;
  } else {
    return <div {...cardProps(props)} />;
  }
};

const cardProps = <T extends ElementType>({
  className,
  variant = "secondary",
  children,
  icon,
  title,
  toolbar,
  footer,
  ...props
}: Props<T>) => ({
  ...props,
  "data-variant": variant,
  className: clsx(styles.card, className),
  children: (
    <>
      <div className={styles.cardHoverBackground} />
      {(Boolean(icon) || Boolean(title) || Boolean(toolbar)) && (
        <div className={styles.header}>
          <h2 className={styles.title}>
            {icon && <div className={styles.icon}>{icon}</div>}
            {title}
          </h2>
          <div className={styles.toolbar}>{toolbar}</div>
        </div>
      )}
      {children}
      {footer && <div className={styles.footer}>{footer}</div>}
    </>
  ),
});
