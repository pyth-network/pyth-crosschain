"use client";

import { sans } from "@pythnetwork/fonts";
import clsx from "clsx";
import {
  type ComponentProps,
  type CSSProperties,
  useState,
  useEffect,
} from "react";

import {
  OverlayVisibleContextProvider,
  useIsOverlayVisible,
} from "../overlay-visible-context.js";

import "./base.scss";

export const Html = (props: ComponentProps<"html">) => (
  <OverlayVisibleContextProvider>
    <HtmlInner {...props} />
  </OverlayVisibleContextProvider>
);

const HtmlInner = ({ className, lang, ...props }: ComponentProps<"html">) => {
  const isOverlayVisible = useIsOverlayVisible();
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
      data-overlay-visible={isOverlayVisible ? "" : undefined}
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
