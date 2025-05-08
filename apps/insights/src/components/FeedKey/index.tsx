import { CopyButton } from "@pythnetwork/component-library/CopyButton";
import type { ComponentProps } from "react";
import { useMemo } from "react";

import { toHex, truncateHex } from "../../hex";

type OwnProps = {
  feedKey: string;
};

type Props = Omit<
  ComponentProps<typeof CopyButton>,
  keyof OwnProps | "text" | "children"
> &
  OwnProps;

export const FeedKey = ({ feedKey, ...props }: Props) => {
  const hexKey = useMemo(() => toHex(feedKey), [feedKey]);
  const truncatedKey = useMemo(() => truncateHex(hexKey), [hexKey]);

  return (
    <CopyButton text={hexKey} {...props}>
      {truncatedKey}
    </CopyButton>
  );
};
