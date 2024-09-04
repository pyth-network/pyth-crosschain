import clsx from "clsx";
import { useMemo, type HTMLAttributes } from "react";

import Pyth from "./pyth.svg";
import { tokensToString } from "../../tokens";

type Props = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  children: bigint;
};

export const Tokens = ({ children, className, ...props }: Props) => {
  const value = useMemo(() => tokensToString(children), [children]);

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-[0.25em] align-top",
        className,
      )}
      {...props}
    >
      <Pyth className="aspect-square size-[1em]" />
      <span>{value}</span>
    </span>
  );
};
