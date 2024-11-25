import clsx from "clsx";
import type { ComponentType, ReactNode } from "react";
import {
  type ButtonProps as BaseButtonProps,
  type LinkProps as BaseLinkProps,
} from "react-aria-components";

import styles from "./index.module.scss";
import { UnstyledButton } from "../UnstyledButton/index.js";
import { UnstyledLink } from "../UnstyledLink/index.js";

export const VARIANTS = [
  "primary",
  "secondary",
  "solid",
  "outline",
  "ghost",
  "success",
  "danger",
] as const;
export const SIZES = ["xs", "sm", "md", "lg"] as const;

type OwnProps = {
  variant?: (typeof VARIANTS)[number] | undefined;
  size?: (typeof SIZES)[number] | undefined;
  rounded?: boolean | undefined;
  hideText?: boolean | undefined;
  children: ReactNode;
  beforeIcon?: Icon | undefined;
  afterIcon?: Icon | undefined;
};

export type ButtonProps = Omit<BaseButtonProps, keyof OwnProps> & OwnProps;

export const Button = (props: ButtonProps) => (
  <UnstyledButton {...buttonProps(props)} />
);

export type ButtonLinkProps = Omit<BaseLinkProps, keyof OwnProps> & OwnProps;

export const ButtonLink = (props: ButtonLinkProps) => (
  <UnstyledLink {...buttonProps(props)} />
);

type ButtonImplProps = OwnProps & {
  className?: Parameters<typeof clsx>[0];
};

const buttonProps = ({
  variant = "primary",
  size = "md",
  rounded = false,
  className,
  children,
  beforeIcon,
  afterIcon,
  hideText = false,
  ...inputProps
}: ButtonImplProps) => ({
  ...inputProps,
  "data-variant": variant,
  "data-size": size,
  "data-rounded": rounded ? "" : undefined,
  "data-text-hidden": hideText ? "" : undefined,
  className: clsx(styles.button, className),
  children: (
    <>
      {beforeIcon !== undefined && <Icon icon={beforeIcon} />}
      <span className={styles.text}>{children}</span>
      {afterIcon !== undefined && <Icon icon={afterIcon} />}
    </>
  ),
});

const Icon = ({ icon: IconComponent }: { icon: Icon }) => (
  <span className={styles.iconWrapper}>
    <IconComponent className={styles.icon} />
  </span>
);

type Icon = ComponentType<{ className?: string | undefined }>;
