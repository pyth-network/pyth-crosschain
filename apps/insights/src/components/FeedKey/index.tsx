import base58 from "bs58";
import { useMemo, type ComponentProps } from "react";

import { CopyButton } from "../CopyButton";

type OwnProps = {
  feed: {
    product: {
      price_account: string;
    };
  };
};

type Props = Omit<
  ComponentProps<typeof CopyButton>,
  keyof OwnProps | "text" | "children"
> &
  OwnProps;

export const FeedKey = ({ feed, ...props }: Props) => {
  const key = useMemo(
    () => toHex(feed.product.price_account),
    [feed.product.price_account],
  );
  const truncatedKey = useMemo(
    () => toTruncatedHex(feed.product.price_account),
    [feed.product.price_account],
  );

  return (
    <CopyButton text={key} {...props}>
      {truncatedKey}
    </CopyButton>
  );
};

const toHex = (value: string) => toHexString(base58.decode(value));

const toTruncatedHex = (value: string) => {
  const hex = toHex(value);
  return `${hex.slice(0, 6)}...${hex.slice(-4)}`;
};

const toHexString = (byteArray: Uint8Array) =>
  `0x${Array.from(byteArray, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
