"use client";

import { parse } from "bcp-47";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { I18nProvider as I18nProviderBase, useIsSSR } from "react-aria";

const SUPPORTED_LANGUAGES = new Set(["en"]);
const DEFAULT_LOCALE = "en-US";

export const I18nProvider = (
  props: Omit<ComponentProps<typeof I18nProviderBase>, "locale">,
) => {
  const isSSR = useIsSSR();
  const locale = useMemo(
    () =>
      isSSR
        ? DEFAULT_LOCALE
        : (globalThis.navigator.languages.find((locale) => {
            const language = parse(locale).language;
            return (
              language !== undefined &&
              language !== null &&
              SUPPORTED_LANGUAGES.has(language)
            );
          }) ?? DEFAULT_LOCALE),
    [isSSR],
  );

  return <I18nProviderBase locale={locale} {...props} />;
};
