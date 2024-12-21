import { useMemo, type ComponentProps } from "react";

import { toHex, truncateHex } from "../../hex";
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
  const truncatedKey = useMemo(() => truncateHex(key), [key]);

  return (
    <CopyButton text={key} {...props}>
      {truncatedKey}
    </CopyButton>
  );
};
