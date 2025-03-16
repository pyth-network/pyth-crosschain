import { Transition } from "@headlessui/react";
import { ClipboardDocumentIcon, CheckIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import type { HTMLAttributes } from "react";
import { useMemo, useCallback, useEffect, useState } from "react";
import type { OffsetOrPosition } from "shiki";

import style from "./style.module.css";
import type { SupportedLanguage } from "./supported-language";
import { useHighlightedCode } from "./use-highlighted-code";
import { getLogger } from "../../browser-logger";
import { Button } from "../Button";

export * from "./supported-language";

type CodeProps = {
  language?: SupportedLanguage | undefined;
  children: string;
  dimRange?: readonly [OffsetOrPosition, OffsetOrPosition] | undefined;
};

export const Code = ({ language, children, dimRange }: CodeProps) => {
  const chompedCode = useMemo(() => chomp(children), [children]);

  return (
    <div className="group relative">
      <CopyButton className="absolute right-4 top-4 opacity-0 transition group-hover:opacity-100">
        {chompedCode}
      </CopyButton>
      <HighlightedCode
        language={language}
        className={style.code}
        dimRange={dimRange}
      >
        {chompedCode}
      </HighlightedCode>
    </div>
  );
};

const chomp = (text: string) => {
  const splitText = text.split("\n");
  const firstNonemptyLine = splitText.findIndex((line) => line.trim() !== "");
  const lastNonemptyLine = splitText.findLastIndex(
    (line) => line.trim() !== "",
  );
  return splitText.slice(firstNonemptyLine, lastNonemptyLine + 1).join("\n");
};

type CopyButtonProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  children: string;
};

const CopyButton = ({ children, className, ...props }: CopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard
      .writeText(children)
      .then(() => {
        setIsCopied(true);
      })
      .catch((error: unknown) => {
        /* TODO do something here? */
        getLogger().error(error);
      });
  }, [children]);

  useEffect(() => {
    setIsCopied(false);
  }, [children]);

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
    <div
      className={clsx("bg-neutral-100 dark:bg-neutral-800", className)}
      {...props}
    >
      <Button
        onClick={copy}
        className="rounded-md p-2 text-neutral-800 dark:text-neutral-300"
      >
        <ClipboardDocumentIcon className="size-4" />
        <div className="sr-only">Copy code to clipboaord</div>
      </Button>
      <Transition
        show={isCopied}
        as="div"
        className="absolute inset-0 rounded-md border border-green-500 bg-green-50 p-2 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-500"
        enter="transition-opacity duration-150"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-150"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <CheckIcon className="size-4 stroke-2" />
      </Transition>
    </div>
  );
};

type HighlightedCodeProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  language?: SupportedLanguage | undefined;
  children: string;
  dimRange?: readonly [OffsetOrPosition, OffsetOrPosition] | undefined;
};

const HighlightedCode = ({
  language,
  children,
  dimRange,
  className,
  ...props
}: HighlightedCodeProps) => {
  const highlightedCode = useHighlightedCode(language, children, dimRange);

  return (
    <div
      className={clsx("overflow-hidden rounded-md", className)}
      {...props}
      {...(highlightedCode
        ? {
            dangerouslySetInnerHTML: { __html: highlightedCode },
          }
        : {
            children: (
              <pre className="shiki">
                <code>
                  {children.split("\n").map((line, i) => (
                    <div key={i} className="line">
                      {line}
                    </div>
                  ))}
                </code>
              </pre>
            ),
          })}
    />
  );
};
