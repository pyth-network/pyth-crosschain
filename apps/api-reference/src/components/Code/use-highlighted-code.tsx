"use client";

import type { ReactNode, RefObject } from "react";
import {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useRef,
} from "react";
import type { OffsetOrPosition } from "shiki";

import type { Highlighter } from "./shiki";
import type { SupportedLanguage } from "./supported-language";
import { getLogger } from "../../browser-logger";

const HighlighterContext = createContext<
  undefined | RefObject<undefined | Highlighter>
>(undefined);

export const HighlighterProvider = ({
  children,
}: {
  children: ReactNode | ReactNode[];
}) => {
  const highlighterRef = useRef<undefined | Highlighter>(undefined);
  return (
    <HighlighterContext.Provider value={highlighterRef}>
      {children}
    </HighlighterContext.Provider>
  );
};

const useHighlighter = () => {
  const highlighter = useContext(HighlighterContext);

  if (highlighter === undefined) {
    throw new Error(
      "The `HighlighterProvider` component must be used to initialized the highlighter!",
    );
  }

  return highlighter;
};

export const useHighlightedCode = (
  language: SupportedLanguage | undefined,
  code: string,
  dimRange?: readonly [OffsetOrPosition, OffsetOrPosition],
) => {
  const highlighter = useHighlighter();
  const decorations = useMemo(
    () =>
      dimRange
        ? [
            {
              start: dimRange[0],
              end: dimRange[1],
              properties: {
                class: "opacity-40 group-hover:opacity-100 transition",
              },
            },
          ]
        : undefined,
    [dimRange],
  );
  const [highlightedCode, setHighlightedCode] = useState<string | undefined>(
    highlighter.current
      ? highlighter.current.highlight(language, code, { decorations })
      : undefined,
  );

  useEffect(() => {
    if (highlighter.current) {
      setHighlightedCode(
        highlighter.current.highlight(language, code, { decorations }),
      );
      return;
    } else {
      const { cancel, load } = createShikiLoader();
      load()
        .then((newHighlighter) => {
          if (newHighlighter) {
            highlighter.current = newHighlighter;
            setHighlightedCode(
              newHighlighter.highlight(language, code, { decorations }),
            );
          }
        })
        .catch((error: unknown) => {
          // TODO report these errors somewhere
          getLogger().error(error);
        });
      return cancel;
    }
  }, [code, language, decorations, highlighter]);

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
