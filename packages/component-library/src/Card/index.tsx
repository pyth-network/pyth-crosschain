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
import { UnstyledButton } from "../UnstyledButton/index.js";
import { UnstyledLink } from "../UnstyledLink/index.js";

export const VARIANTS = ["primary", "secondary", "tertiary"] as const;

type OwnProps = {
  variant?: (typeof VARIANTS)[number] | undefined;
  icon?: ReactNode | undefined;
  title?: ReactNode | undefined;
  toolbar?: ReactNode | ReactNode[] | undefined;
  footer?: ReactNode | undefined;
};

export type Props<T extends ElementType> = Omit<
  ComponentProps<T>,
  keyof OwnProps
> &
  OwnProps;

export const Card = (
  props:
    | Props<"div">
    | Props<typeof UnstyledLink>
    | Props<typeof UnstyledButton>,
) => {
  const overlayState = use(OverlayTriggerStateContext);

  if (overlayState !== null || "onPress" in props) {
    return <UnstyledButton {...cardProps(props)} />;
  } else if ("href" in props) {
    return <UnstyledLink {...cardProps(props)} />;
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
