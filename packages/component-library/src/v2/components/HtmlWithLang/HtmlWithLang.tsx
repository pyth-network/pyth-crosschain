import { useLocale } from "react-aria";

import type { HtmlWithLangProps } from "./types";

export function HtmlWithLang(props: HtmlWithLangProps) {
  const locale = useLocale();
  return <html lang={locale.locale} dir={locale.direction} {...props} />;
}
