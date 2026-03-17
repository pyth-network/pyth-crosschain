import { useLocale } from "react-aria";

import type { HtmlWithLangProps } from "./types";

export function HtmlWithLang(props: HtmlWithLangProps) {
  const locale = useLocale();
  return <html dir={locale.direction} lang={locale.locale} {...props} />;
}
