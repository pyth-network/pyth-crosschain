"use client";

import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { Copy } from "@phosphor-icons/react/dist/ssr/Copy";
import { useLogger } from "@pythnetwork/app-logger";
import {
  type Props as ButtonProps,
  Button,
} from "@pythnetwork/component-library/Button";
import clsx from "clsx";
import { type ElementType, useCallback, useEffect, useState } from "react";

import styles from "./index.module.scss";

type OwnProps = {
  text: string;
};

type Props<T extends ElementType> = Omit<
  ButtonProps<T>,
  keyof OwnProps | "onPress" | "afterIcon"
> &
  OwnProps;

export const CopyButton = <T extends ElementType>({
  text,
  children,
  className,
  ...props
}: Props<T>) => {
  const [isCopied, setIsCopied] = useState(false);
  const logger = useLogger();
  const copy = useCallback(() => {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setIsCopied(true);
      })
      .catch((error: unknown) => {
        /* TODO do something here? */
        logger.error(error);
      });
  }, [text, logger]);

  useEffect(() => {
    setIsCopied(false);
  }, [text]);

  useEffect(() => {
    if (isCopied) {
      const timeout = setTimeout(() => {
        setIsCopied(false);
      }, 2000);
      return () => {
        clearTimeout(timeout);
      };
    } else {
      return;
    }
  }, [isCopied]);

  return (
    <Button
      onPress={copy}
      className={clsx(styles.copyButton, className)}
      afterIcon={({ className, ...props }) => (
        <div className={clsx(styles.iconContainer, className)} {...props}>
          <Copy className={styles.copyIcon} />
          <Check className={styles.checkIcon} />
        </div>
      )}
      {...(isCopied && { "data-is-copied": true })}
      {...props}
    >
      {children}
    </Button>
  );
};
