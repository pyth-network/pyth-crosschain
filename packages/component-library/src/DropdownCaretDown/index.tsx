import type { ComponentProps } from "react";

export const DropdownCaretDown = (
  props: Omit<ComponentProps<"svg">, "xmlns" | "viewBox" | "fill">,
) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    width="1em"
    height="1em"
    fill="currentColor"
    {...props}
  >
    <path d="m13.346 9.284-3.125 3.125a.311.311 0 0 1-.442 0L6.654 9.284a.312.312 0 0 1 .221-.534h6.25a.312.312 0 0 1 .221.534Z" />
  </svg>
);
