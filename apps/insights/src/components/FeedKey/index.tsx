import { useMemo, type ComponentProps } from "react";

import { toHex, truncateHex } from "../../hex";
import { CopyButton } from "../CopyButton";

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
