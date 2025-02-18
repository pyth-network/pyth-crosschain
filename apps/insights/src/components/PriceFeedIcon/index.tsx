import Generic from "cryptocurrency-icons/svg/color/generic.svg";
import type { ComponentProps } from "react";

import { icons } from "./icons";

type OwnProps = {
  assetClass: string;
  symbol: string;
};
type Props = Omit<
  ComponentProps<typeof Generic>,
  keyof OwnProps | "width" | "height" | "viewBox"
> &
  OwnProps;

export const PriceFeedIcon = ({ assetClass, symbol, ...props }: Props) => {
  const Icon = getIcon(assetClass, symbol);
  return <Icon width="100%" height="100%" viewBox="0 0 32 32" {...props} />;
};

const getIcon = (assetClass: string, symbol: string) => {
  if (assetClass === "Crypto") {
    const firstPart = symbol.split("/")[0];
    return firstPart && firstPart in icons
      ? icons[firstPart as keyof typeof icons]
      : Generic;
  } else {
    return Generic;
  }
};
