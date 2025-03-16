import type { PublicKey } from "@solana/web3.js";
import type { HTMLAttributes } from "react";
import { useMemo } from "react";

type Props = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  children: PublicKey | `0x${string}`;
};

export const TruncatedKey = ({ children, ...props }: Props) => {
  const key = useMemo(() => {
    const isHex = typeof children === "string";
    const asString = isHex ? children : children.toBase58();
    return asString.slice(0, isHex ? 6 : 4) + ".." + asString.slice(-4);
  }, [children]);

  return <code {...props}>{key}</code>;
};
