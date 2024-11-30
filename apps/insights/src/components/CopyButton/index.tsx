"use client";

import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { Copy } from "@phosphor-icons/react/dist/ssr/Copy";
import { useLogger } from "@pythnetwork/app-logger";
import { UnstyledButton } from "@pythnetwork/component-library/UnstyledButton";
import clsx from "clsx";
import { type ComponentProps, useCallback, useEffect, useState } from "react";

import styles from "./index.module.scss";

type CopyButtonProps = ComponentProps<typeof UnstyledButton> & {
  text: string;
};

export const CopyButton = ({
  text,
  children,
  className,
  ...props
}: CopyButtonProps) => {
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
    <UnstyledButton
      onPress={copy}
      className={clsx(styles.copyButton, className)}
      {...(isCopied && { "data-is-copied": true })}
      {...props}
    >
      {(...args) => (
        <>
          <span>
            {typeof children === "function" ? children(...args) : children}
          </span>
          <span className={styles.iconContainer}>
            <Copy className={styles.copyIcon} />
            <Check className={styles.checkIcon} />
          </span>
        </>
      )}
    </UnstyledButton>
  );
};
