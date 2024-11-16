"use client";

import { Copy, Check } from "@phosphor-icons/react/dist/ssr";
import { useLogger } from "@pythnetwork/app-logger";
import { UnstyledButton } from "@pythnetwork/component-library/UnstyledButton";
import clsx from "clsx";
import { type ComponentProps, useCallback, useEffect, useState } from "react";

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
      isDisabled={isCopied}
      className={clsx(
        "group/copy-button mx-[-0.5em] -mt-0.5 inline-block whitespace-nowrap rounded-md px-[0.5em] py-0.5 outline-none outline-0 outline-steel-600 transition data-[hovered]:bg-black/5 data-[focus-visible]:outline-2 dark:outline-steel-300 dark:data-[hovered]:bg-white/10",
        className,
      )}
      {...(isCopied && { "data-is-copied": true })}
      {...props}
    >
      {(...args) => (
        <>
          <span>
            {typeof children === "function" ? children(...args) : children}
          </span>
          <span className="relative top-[0.125em] ml-1 inline-block">
            <span className="opacity-50 transition-opacity duration-100 group-data-[is-copied]/copy-button:opacity-0">
              <Copy className="size-[1em]" />
              <div className="sr-only">Copy to clipboard</div>
            </span>
            <Check className="absolute inset-0 text-green-600 opacity-0 transition-opacity duration-100 group-data-[is-copied]/copy-button:opacity-100" />
          </span>
        </>
      )}
    </UnstyledButton>
  );
};
