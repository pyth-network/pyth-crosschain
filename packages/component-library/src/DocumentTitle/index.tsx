import { useEffect, useRef } from "react";

type DocumentTitleProps = Partial<{
  /**
   * set this if you want to keep the existing
   * title but want some dynamic content prepended
   * to it
   */
  prefix: string;

  /**
   * set this if you want to explicitly fully-reset the
   * page title and want to fully control it.
   */
  title: string;
}>;

/**
 * updates the html document.title property
 * to whatever you need.
 * useful if you want to hagve the title become dynamic,
 * based on user actions or current page information or
 * events
 */
export function DocumentTitle({ prefix, title }: DocumentTitleProps) {
  /** refs */
  const initialPageTitleRef = useRef(document.title);

  /** effects */
  useEffect(() => {
    if (prefix && title) {
      throw new Error(
        "<DocumentTitle /> supports either the prefix or title prop, but not both at the same time",
      );
    }
    if (prefix) {
      document.title = `${prefix} | ${initialPageTitleRef.current}`;
    } else if (title) {
      document.title = title;
    }
  }, [prefix, title]);

  // eslint-disable-next-line unicorn/no-null
  return null;
}
