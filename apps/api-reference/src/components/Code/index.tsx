import { Transition } from "@headlessui/react";
import { ClipboardDocumentIcon, CheckIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useMemo, useCallback, type HTMLAttributes } from "react";
import { useRef, useEffect, useState } from "react";

import type { Highlighter, SupportedLanguage } from "./shiki";
import style from "./style.module.css";
import { getLogger } from "../../browser-logger";
import { Button } from "../Button";

export type { SupportedLanguage } from "./shiki";

type CodeProps = {
  language: SupportedLanguage;
  children: string;
};

export const Code = ({ language, children }: CodeProps) => {
  const chompedCode = useMemo(() => chomp(children), [children]);

  return (
    <div className="group relative">
      <CopyButton className="absolute right-4 top-4 opacity-0 transition group-hover:opacity-100">
        {chompedCode}
      </CopyButton>
      <HighlightedCode language={language} className={style.code}>
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
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
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
      <Transition
        show={isCopied}
        enter="transition-opacity duration-150"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-150"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="absolute size-full rounded-md border border-green-500 bg-green-50 p-2 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-500">
          <CheckIcon className="size-4 stroke-2" />
        </div>
      </Transition>
      <Button
        onClick={copy}
        className="rounded-md p-2 text-neutral-800 dark:text-neutral-300"
      >
        <ClipboardDocumentIcon className="size-4" />
        <div className="sr-only">Copy code to clipboaord</div>
      </Button>
    </div>
  );
};

type HighlightedCodeProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  language: SupportedLanguage;
  children: string;
};

const HighlightedCode = ({
  language,
  children,
  ...props
}: HighlightedCodeProps) => {
  const highlightedCode = useHighlightedCode(language, children);

  return highlightedCode ? (
    <div dangerouslySetInnerHTML={{ __html: highlightedCode }} {...props} />
  ) : (
    <div {...props}>
      <pre className="shiki">
        <code>
          {children.split("\n").map((line, i) => (
            <div key={i} className="line">
              {line}
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
};

const useHighlightedCode = (language: SupportedLanguage, code: string) => {
  const [highlightedCode, setHighlightedCode] = useState<string | undefined>(
    undefined,
  );
  const highlighter = useRef<Highlighter | undefined>(undefined);

  useEffect(() => {
    if (highlighter.current) {
      setHighlightedCode(highlighter.current.highlight(language, code));
      return;
    } else {
      const { cancel, load } = createShikiLoader();
      load()
        .then((newHighlighter) => {
          if (newHighlighter) {
            highlighter.current = newHighlighter;
            setHighlightedCode(newHighlighter.highlight(language, code));
          }
        })
        .catch((error: unknown) => {
          // TODO report these errors somewhere
          getLogger().error(error);
        });
      return cancel;
    }
  }, [code, language]);

  return highlightedCode;
};

const createShikiLoader = () => {
  let cancelled = false;
  return {
    load: async () => {
      const { getHighlighter } = await import("./shiki");
      if (cancelled) {
        return;
      } else {
        const highlighter = await getHighlighter();
        // Typescript narrows optimistically, meaning that by the time the code
        // reaches this point, typescript things that `cancelled` can only be
        // `false`.  However, that's not actually true and some other code could
        // have called `cancel` during the `await` and flipped `cancelled` to
        // false, so we should check it here too.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        return cancelled ? undefined : highlighter;
      }
    },
    cancel: () => {
      cancelled = true;
    },
  };
};
