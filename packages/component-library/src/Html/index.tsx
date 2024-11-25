import { sans } from "@pythnetwork/fonts";
import clsx from "clsx";
import type { ComponentProps } from "react";

import "./base.scss";

export const Html = ({ className, lang, ...props }: ComponentProps<"html">) => (
  <html lang={lang} className={clsx(sans.className, className)} {...props} />
);
