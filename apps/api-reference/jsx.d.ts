/**
 * This file only exists because in react 19, the JSX namespace was moved under
 * the React export.  However, some libraries (e.g. react-markdown) still have
 * some things typed as `JSX.<Something>`.  Until those libraries update to
 * import the namespace correctly, we'll need this declaration file in place to
 * expose JSX via the old global location.
 */

import type { JSX as Jsx } from "react/jsx-runtime";

declare global {
  namespace JSX {
    type ElementClass = Jsx.ElementClass;
    type Element = Jsx.Element;
    type IntrinsicElements = Jsx.IntrinsicElements;
  }
}
