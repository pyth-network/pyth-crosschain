"use client";

import type { ComponentProps } from "react";
import { useLocale } from "react-aria";

type HtmlWithLangProps = Omit<ComponentProps<"html">, "lang">;

export const HtmlWithLang = (props: HtmlWithLangProps) => {
  const locale = useLocale();
  return <html dir={locale.direction} lang={locale.locale} {...props} />;
};
