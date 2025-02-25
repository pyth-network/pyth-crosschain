"use client";

import { sans } from "@pythnetwork/fonts";
import clsx from "clsx";
import {
  type CSSProperties,
  type ComponentProps,
  useState,
  useEffect,
} from "react";

import "./base.scss";

export const Html = ({ className, lang, ...props }: ComponentProps<"html">) => {
  const scrollbarWidth = useScrollbarWidth();

  return (
    <html
      lang={lang}
      className={clsx(sans.className, className)}
      style={
        {
          "--scrollbar-width": `${scrollbarWidth.toString()}px`,
        } as CSSProperties
      }
      {...props}
    />
  );
};

const DEFAULT_SCROLLBAR_WIDTH = 0;

const useScrollbarWidth = () => {
  const [scrollbarWidth, setScrollbarWidth] = useState(DEFAULT_SCROLLBAR_WIDTH);

  useEffect(() => {
    const scrollDiv = document.createElement("div");
    scrollDiv.style.overflow = "scroll";
    document.body.append(scrollDiv);
    setScrollbarWidth(scrollDiv.offsetWidth - scrollDiv.clientWidth);
    scrollDiv.remove();
  }, []);

  return scrollbarWidth;
};
