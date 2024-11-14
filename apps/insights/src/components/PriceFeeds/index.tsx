import Generic from "cryptocurrency-icons/svg/color/generic.svg";
import { Fragment } from "react";
import { z } from "zod";

import { columns } from "./columns";
import { Price } from "./prices";
import { Results } from "./results";
import { getIcon } from "../../icons";
import { client } from "../../pyth";

export const PriceFeeds = async () => {
  const priceFeeds = await getPriceFeeds();

  return (
    <Results
      label="Price Feeds"
      columns={columns}
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
    <div className="flex flex-row gap-3">
      <Icon className="size-6" width="100%" height="100%" viewBox="0 0 32 32" />
      <div className="flex flex-row items-center gap-1">
        <span className="font-medium">{firstPart}</span>
        {parts.map((part, i) => (
          <Fragment key={i}>
            <span className="font-light text-stone-600 dark:text-steel-400">
              /
            </span>
            <span className="opacity-60">{part}</span>
          </Fragment>
        ))}
      </div>
    </div>
  );
};

const AssetType = ({ children }: { children: string }) => (
  <span className="inline-block rounded-3xl border border-steel-900 px-2 text-[0.625rem] uppercase leading-4 text-steel-900 dark:border-steel-50 dark:text-steel-50">
    {children}
  </span>
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
