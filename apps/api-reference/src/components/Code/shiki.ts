import {
  type HighlighterCore,
  getHighlighterCore as shikiGetHighlighterCore,
} from "shiki/core";
import javascript from "shiki/langs/javascript.mjs";
import solidity from "shiki/langs/solidity.mjs";
import darkPlus from "shiki/themes/dark-plus.mjs";
import lightPlus from "shiki/themes/light-plus.mjs";
import loadWasm from "shiki/wasm";

export type Highlighter = {
  highlight: (lang: SupportedLanguage, code: string) => string;
};

export type SupportedLanguage = "javascript" | "solidity";

export const getHighlighter = async (): Promise<Highlighter> => {
  const highlighterCore = await shikiGetHighlighterCore({
    langs: [javascript, solidity],
    themes: [darkPlus, lightPlus],
    loadWasm,
  });

  return {
    highlight: (lang: SupportedLanguage, code: string) =>
      highlight(highlighterCore, lang, code),
  };
};

const highlight = (
  highlighter: HighlighterCore,
  lang: SupportedLanguage,
  code: string,
) =>
  highlighter.codeToHtml(code, {
    lang,
    themes: {
      light: "light-plus",
      dark: "dark-plus",
    },
  });
