"use client";

import type { ComponentProps } from "react";
import { useLocale } from "react-aria";

type HtmlWithLangProps = Omit<ComponentProps<"html">, "lang">;

export const HtmlWithLang = (props: HtmlWithLangProps) => {
  const locale = useLocale();
  return <html lang={locale.locale} dir={locale.direction} {...props} />;
};
