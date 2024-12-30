import Generic from "cryptocurrency-icons/svg/color/generic.svg";
import type { ComponentProps } from "react";

import { icons } from "./icons";

type OwnProps = {
  symbol: string;
};
type Props = Omit<
  ComponentProps<typeof Generic>,
  keyof OwnProps | "width" | "height" | "viewBox"
> &
  OwnProps;

export const PriceFeedIcon = ({ symbol, ...props }: Props) => {
  const firstPart = symbol.split("/")[0];
  const Icon =
    firstPart && firstPart in icons
      ? icons[firstPart as keyof typeof icons]
      : Generic;

  return <Icon width="100%" height="100%" viewBox="0 0 32 32" {...props} />;
};
