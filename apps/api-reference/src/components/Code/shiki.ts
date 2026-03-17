import type { DecorationItem, HighlighterCore } from "shiki/core";
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import javascript from "shiki/langs/javascript.mjs";
import json from "shiki/langs/json.mjs";
import solidity from "shiki/langs/solidity.mjs";
import darkPlus from "shiki/themes/dark-plus.mjs";
import lightPlus from "shiki/themes/light-plus.mjs";

import type { SupportedLanguage } from "./supported-language";

export type Highlighter = {
  highlight: (
    lang: SupportedLanguage | undefined,
    code: string,
    options?: HighlightOptions,
  ) => string;
};

export type HighlightOptions = {
  decorations?: DecorationItem[] | undefined;
};

export const getHighlighter = async (): Promise<Highlighter> => {
  const highlighterCore = await createHighlighterCore({
    engine: createOnigurumaEngine(() => import("shiki/wasm")),
    langs: [javascript, solidity, json],
    themes: [darkPlus, lightPlus],
  });

  return {
    highlight: (
      lang: SupportedLanguage | undefined,
      code: string,
      options?: HighlightOptions,
    ) => highlight(highlighterCore, lang, code, options),
  };
};

const highlight = (
  highlighter: HighlighterCore,
  lang: SupportedLanguage | undefined,
  code: string,
  options?: HighlightOptions,
) =>
  highlighter.codeToHtml(code, {
    lang: lang ?? "text",
    themes: {
      dark: "dark-plus",
      light: "light-plus",
    },
    ...(options?.decorations && { decorations: options.decorations }),
  });
