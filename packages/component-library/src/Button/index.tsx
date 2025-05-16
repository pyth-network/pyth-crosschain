import clsx from "clsx";
import type {
  ComponentProps,
  ElementType,
  ComponentType,
  ReactNode,
} from "react";

import styles from "./index.module.scss";
import { Button as UnstyledButton } from "../unstyled/Button/index.jsx";
import { Link } from "../unstyled/Link/index.jsx";

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

export type Props<T extends ElementType> = Omit<
  ComponentProps<T>,
  keyof OwnProps
> &
  OwnProps;

export const Button = (
  props: Props<typeof UnstyledButton> | Props<typeof Link>,
) =>
  "href" in props ? (
    <Link {...buttonProps(props)} />
  ) : (
    <UnstyledButton {...buttonProps(props)} />
  );

const buttonProps = ({
  variant = "primary",
  size = "md",
  rounded = false,
  className,
  children,
  beforeIcon: BeforeIcon,
  afterIcon: AfterIcon,
  hideText = false,
  ...otherProps
}: OwnProps & { className?: Parameters<typeof clsx>[0] }) => ({
  ...otherProps,
  "data-variant": variant,
  "data-size": size,
  "data-rounded": rounded ? "" : undefined,
  "data-text-hidden": hideText ? "" : undefined,
  className: clsx(styles.button, className),
  children: (
    <>
      {BeforeIcon !== undefined && <BeforeIcon className={styles.icon} />}
      <span className={styles.text}>{children}</span>
      {AfterIcon !== undefined && <AfterIcon className={styles.icon} />}
    </>
  ),
});

const Icon = ({ icon: IconComponent }: { icon: Icon }) => (
  <IconComponent className={styles.icon} />
);

type Icon = ComponentType<{ className?: string | undefined }>;
