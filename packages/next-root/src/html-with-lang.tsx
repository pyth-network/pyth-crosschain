"use client";

import { Html } from "@pythnetwork/component-library/Html";
import type { ComponentProps } from "react";
import { useLocale } from "react-aria";

type HtmlWithLangProps = Omit<ComponentProps<"html">, "lang">;

export const HtmlWithLang = (props: HtmlWithLangProps) => {
  const locale = useLocale();
  return <Html lang={locale.locale} dir={locale.direction} {...props} />;
};
