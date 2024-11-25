import Generic from "cryptocurrency-icons/svg/color/generic.svg";
import { Fragment } from "react";
import { z } from "zod";

import styles from "./index.module.scss";
import { Price } from "./prices";
import { Results } from "./results";
import { getIcon } from "../../icons";
import { client } from "../../pyth";

export const PriceFeeds = async () => {
  const priceFeeds = await getPriceFeeds();

  return (
    <Results
      priceFeeds={priceFeeds.map(({ symbol, product }) => ({
        symbol,
        key: product.price_account,
        displaySymbol: product.display_symbol,
        data: {
          asset: <AssetName>{product.display_symbol}</AssetName>,
          assetType: <AssetType>{product.asset_type}</AssetType>,
          price: <Price account={product.price_account} />,
          uptime: 43,
          deviation: 56,
          staleness: 46,
        },
      }))}
    />
  );
};

const AssetName = ({ children }: { children: string }) => {
  const [firstPart, ...parts] = children.split("/");
  const Icon = firstPart ? (getIcon(firstPart) ?? Generic) : Generic;
  return (
    <div className={styles.assetName}>
      <Icon
        className={styles.icon}
        width="100%"
        height="100%"
        viewBox="0 0 32 32"
      />
      <div className={styles.name}>
        <span className={styles.firstPart}>{firstPart}</span>
        {parts.map((part, i) => (
          <Fragment key={i}>
            <span className={styles.divider}>/</span>
            <span className={styles.part}>{part}</span>
          </Fragment>
        ))}
      </div>
    </div>
  );
};

const AssetType = ({ children }: { children: string }) => (
  <span className={styles.assetType}>{children}</span>
);

const getPriceFeeds = async () => {
  const data = await client.getData();
  return priceFeedsSchema.parse(
    data.symbols.map((symbol) => ({
      symbol,
      product: data.productFromSymbol.get(symbol),
    })),
  );
};

const priceFeedsSchema = z.array(
  z.object({
    symbol: z.string(),
    product: z.object({
      display_symbol: z.string(),
      asset_type: z.string(),
      price_account: z.string(),
    }),
  }),
);
