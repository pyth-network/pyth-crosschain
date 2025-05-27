"use client";

import clsx from "clsx";
import type { ComponentProps, ElementType } from "react";

import styles from "./index.module.scss";
import { Button } from "../unstyled/Button/index.jsx";
import { Link as UnstyledLink } from "../unstyled/Link/index.jsx";

type OwnProps = {
  invert?: boolean | undefined;
};
export type Props<T extends ElementType> = Omit<
  ComponentProps<T>,
  keyof OwnProps
> &
  OwnProps;

export const Link = (
  props: Props<typeof Button> | Props<typeof UnstyledLink>,
) =>
  "href" in props ? (
    <UnstyledLink {...mkProps(props)} />
  ) : (
    <Button {...mkProps(props)} />
  );

const mkProps = ({
  className,
  invert = false,
  ...otherProps
}: OwnProps & { className?: Parameters<typeof clsx>[0] }) => ({
  ...otherProps,
  "data-invert": invert ? "" : undefined,
  className: clsx(styles.link, className),
});
