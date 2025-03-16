"use client";

import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { Copy } from "@phosphor-icons/react/dist/ssr/Copy";
import { useLogger } from "@pythnetwork/app-logger";
import { Button } from "@pythnetwork/component-library/unstyled/Button";
import clsx from "clsx";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useState } from "react";

import styles from "./index.module.scss";

const COPY_INDICATOR_TIME = 1000;

type OwnProps = {
  text: string;
};

type Props = Omit<
  ComponentProps<typeof Button>,
  keyof OwnProps | "onPress" | "afterIcon"
> &
  OwnProps;

export const CopyButton = ({ text, children, className, ...props }: Props) => {
  const [isCopied, setIsCopied] = useState(false);
  const logger = useLogger();
  const copy = useCallback(() => {
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
      }, COPY_INDICATOR_TIME);
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
      {...(isCopied && { "data-is-copied": true })}
      {...props}
    >
      {(...args) => (
        <>
          {typeof children === "function" ? children(...args) : children}
          <div className={styles.iconContainer}>
            <Copy className={styles.copyIcon} />
            <Check className={styles.checkIcon} />
          </div>
        </>
      )}
    </Button>
  );
};
