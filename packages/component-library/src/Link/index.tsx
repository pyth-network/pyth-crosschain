import clsx from "clsx";
import type { LinkProps } from "react-aria-components";

import { UnstyledLink } from "../UnstyledLink/index.js";

export const Link = ({ className, ...props }: LinkProps) => (
  <UnstyledLink
    className={clsx(
      "underline outline-0 outline-offset-4 outline-inherit data-[disabled]:cursor-not-allowed data-[disabled]:text-stone-400 data-[disabled]:no-underline data-[focus-visible]:outline-2 hover:no-underline dark:data-[disabled]:text-steel-400",
      className,
    )}
    {...props}
  />
);
