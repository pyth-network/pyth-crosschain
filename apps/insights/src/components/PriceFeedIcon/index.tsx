"use client";

import type { ComponentProps } from "react";

import Commodities from "./commodities.svg";
import CryptoIndex from "./crypto-index.svg";
import CryptoRedemptionRate from "./crypto-redemption-rate.svg";
import Crypto from "./crypto.svg";
import Eco from "./eco.svg";
import Equity from "./equity.svg";
import Fx from "./fx.svg";
import styles from "./index.module.scss";
import Metal from "./metal.svg";
import Rates from "./rates.svg";

type OwnProps = {
  assetClass: string;
};
type Props = Omit<SVGProps, keyof OwnProps | "width" | "height" | "viewBox"> &
  OwnProps;

export const PriceFeedIcon = ({ assetClass, ...props }: Props) => {
  switch (assetClass) {
    case "Crypto":
    case "Crypto NAV": {
      return <GenericIcon assetClass="Crypto" {...props} />;
    }
    default: {
      return assetClassHasIcon(assetClass) ? (
        <GenericIcon assetClass={assetClass} {...props} />
      ) : // eslint-disable-next-line unicorn/no-null
      null;
    }
  }
};

type GenericProps = ComponentProps<"svg"> & {
  assetClass: keyof typeof ASSET_CLASS_TO_ICON;
};

const GenericIcon = ({ assetClass, ...props }: GenericProps) => {
  const Icon = ASSET_CLASS_TO_ICON[assetClass];
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

const ASSET_CLASS_TO_ICON = {
  Commodities,
  "Crypto Index": CryptoIndex,
  "Crypto Redemption Rate": CryptoRedemptionRate,
  Crypto,
  ECO: Eco,
  Equity,
  FX: Fx,
  Metal,
  Rates,
} as const;

const assetClassHasIcon = (
  assetClass: string,
): assetClass is keyof typeof ASSET_CLASS_TO_ICON =>
  Object.keys(ASSET_CLASS_TO_ICON).includes(assetClass);
