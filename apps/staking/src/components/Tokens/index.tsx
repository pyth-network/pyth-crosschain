import { useMemo } from "react";

import Pyth from "./pyth.svg";
import { tokensToString } from "../../tokens";

type Props = {
  children: bigint;
};

export const Tokens = ({ children }: Props) => {
  const value = useMemo(() => tokensToString(children), [children]);

  return (
    <span className="inline-flex items-center gap-0.5 align-top">
      <Pyth className="aspect-square h-[1em]" />
      <span>{value}</span>
    </span>
  );
};
