"use client";

import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { Copy } from "@phosphor-icons/react/dist/ssr/Copy";
import clsx from "clsx";
import type { ComponentProps } from "react";

import { Button } from "../unstyled/Button/index.jsx";
import { useCopy } from "../useCopy";
import styles from "./index.module.scss";

type OwnProps = {
  text: string;
  iconOnly?: boolean | undefined;
};

type Props = Omit<
  ComponentProps<typeof Button>,
  keyof OwnProps | "onPress" | "afterIcon"
> &
  OwnProps;

export const CopyButton = ({
  text,
  iconOnly,
  children,
  className,
  ...props
}: Props) => {
  const { isCopied, copy } = useCopy(text);
  return (
    <Button
      onPress={copy}
      className={clsx(styles.copyButton, className)}
      data-is-copied={isCopied ? "" : undefined}
      data-icon-only={iconOnly ? "" : undefined}
      {...props}
    >
      {(...args) => (
        <>
          <span className={styles.contents}>
            {typeof children === "function"
              ? children(...args)
              : (children ?? "Copy")}
          </span>
          <div className={styles.iconContainer}>
            <Copy className={styles.copyIcon} />
            <Check className={styles.checkIcon} />
          </div>
        </>
      )}
    </Button>
  );
};
