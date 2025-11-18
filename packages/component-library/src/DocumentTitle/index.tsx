import { useEffect, useRef } from "react";

type DocumentTitleProps = {
  /**
   * set this if you want to keep the existing
   * title but want some dynamic content prepended
   * to it
   */
  prefix?: boolean;

  /**
   * set this if you want to explicitly fully-reset the
   * page title and want to fully control it.
   */
  title: string;
};

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
    if (prefix) {
      document.title = `${title} | ${initialPageTitleRef.current}`;
    } else if (title) {
      document.title = title;
    }
  }, [prefix, title]);

  // eslint-disable-next-line unicorn/no-null
  return null;
}
