import { ClipboardDocumentIcon, CheckIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "react-aria-components";

import { useLogger } from "../../hooks/use-logger";

type CopyButtonProps = ComponentProps<typeof Button> & {
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
      isDisabled={isCopied}
      className={clsx(
        "group mx-[-0.25em] -mt-0.5 inline-block rounded-md px-[0.25em] py-0.5 transition hover:bg-white/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400",
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
          <span className="relative top-[0.125em] ml-[0.25em] inline-block">
            <span className="opacity-50 transition-opacity duration-100 group-data-[is-copied]:opacity-0">
              <ClipboardDocumentIcon className="size-[1em]" />
              <div className="sr-only">Copy to clipboard</div>
            </span>
            <CheckIcon className="absolute inset-0 text-green-600 opacity-0 transition-opacity duration-100 group-data-[is-copied]:opacity-100" />
          </span>
        </>
      )}
    </Button>
  );
};
