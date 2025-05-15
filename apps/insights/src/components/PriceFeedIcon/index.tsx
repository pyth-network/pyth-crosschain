import Generic from "cryptocurrency-icons/svg/color/generic.svg";
import type { ComponentProps, ComponentType } from "react";

import Commodities from "./commodities.svg";
import CryptoIndex from "./crypto-index.svg";
import CryptoRedemptionRate from "./crypto-redemption-rate.svg";
import Crypto from "./crypto.svg";
import Equity from "./equity.svg";
import Fx from "./fx.svg";
import { icons } from "./icons";
import styles from "./index.module.scss";
import Metal from "./metal.svg";
import Rates from "./rates.svg";

type OwnProps = {
  assetClass: string;
  symbol: string;
};
type Props = Omit<SVGProps, keyof OwnProps | "width" | "height" | "viewBox"> &
  OwnProps;

export const PriceFeedIcon = ({ assetClass, symbol, ...props }: Props) => {
  if (assetClass === "Crypto") {
    const firstPart = symbol.split(".")[1]?.split("/")[0];
    const Icon = firstPart ? (icons as SVGRecord)[firstPart] : undefined;
    return Icon ? (
      <Icon width="100%" height="100%" viewBox="0 0 32 32" {...props} />
    ) : (
      <GenericIcon assetClass={assetClass} {...props} />
    );
  } else {
    return <GenericIcon assetClass={assetClass} {...props} />;
  }
};

type GenericProps = ComponentProps<"svg"> & { assetClass: string };

const GenericIcon = ({ assetClass, ...props }: GenericProps) => {
  const Icon = ASSET_CLASS_TO_ICON[assetClass] ?? Generic;
  return (
    <Icon
      width="100%"
      height="100%"
      className={styles.generic}
      data-asset-class={assetClass}
      {...(!(assetClass in ASSET_CLASS_TO_ICON) && {
        viewBox: "0 0 32 32",
      })}
      {...props}
    />
  );
};

type SVGProps = ComponentProps<"svg">;
type SVGComponent = ComponentType<SVGProps>;
type SVGRecord = Record<string, SVGComponent>;

const ASSET_CLASS_TO_ICON: Record<string, SVGComponent> = {
  Commodities,
  "Crypto Index": CryptoIndex,
  "Crypto Redemption Rate": CryptoRedemptionRate,
  Crypto,
  Equity,
  FX: Fx,
  Metal,
  Rates,
};
