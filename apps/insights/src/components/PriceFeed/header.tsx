import { ListDashes } from "@phosphor-icons/react/dist/ssr/ListDashes";
import { Breadcrumbs } from "@pythnetwork/component-library/Breadcrumbs";
import { Button } from "@pythnetwork/component-library/Button";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import { SymbolPairTag } from "@pythnetwork/component-library/SymbolPairTag";
import { Suspense } from "react";

import { Cluster } from "../../services/pyth";
import { AssetClassBadge } from "../AssetClassBadge";
import { Cards } from "../Cards";
import { Explain } from "../Explain";
import { FeedKey } from "../FeedKey";
import { LiveConfidence, LiveLastUpdated, LivePrice } from "../LivePrices";
import {
  PriceFeedChangePercent,
  YesterdaysPricesProvider,
} from "../PriceFeedChangePercent";
import { PriceFeedIcon } from "../PriceFeedIcon";
import { PriceName } from "../PriceName";
import { getFeed } from "./get-feed";
import styles from "./header.module.scss";
import { PriceFeedSelect } from "./price-feed-select";
import { ReferenceData } from "./reference-data";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export const PriceFeedHeader = ({ params }: Props) => (
  <Suspense fallback={<PriceFeedHeaderImpl isLoading />}>
    <ResolvedPriceFeedHeader params={params} />
  </Suspense>
);

const ResolvedPriceFeedHeader = async ({ params }: Props) => (
  <PriceFeedHeaderImpl {...(await getFeed(params))} />
);

type PriceFeedHeaderImplProps =
  | { isLoading: true }
  | ({
      isLoading?: false | undefined;
    } & Awaited<ReturnType<typeof getFeed>>);

const PriceFeedHeaderImpl = (props: PriceFeedHeaderImplProps) => (
  <section className={styles.header}>
    <div className={styles.headerRow}>
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/price-feeds", label: "Price Feeds" },
          {
            label: props.isLoading ? (
              <Skeleton width={30} />
            ) : (
              props.feed.product.display_symbol
            ),
          },
        ]}
        label="Breadcrumbs"
      />
      {props.isLoading ? (
        <Skeleton width={15} />
      ) : (
        <AssetClassBadge className={styles.assetClassBadge}>
          {props.feed.product.asset_type}
        </AssetClassBadge>
      )}
    </div>
    <div className={styles.headerRow}>
      <PriceFeedSelect
        className={styles.priceFeedSelect}
        {...(props.isLoading
          ? { isLoading: true }
          : {
              feeds: props.feeds
                .filter((item) => item.symbol !== props.symbol)
                .map((item) => ({
                  assetClass: item.product.asset_type,
                  description: item.product.description,
                  displaySymbol: item.product.display_symbol,
                  icon: <PriceFeedIcon assetClass={item.product.asset_type} />,
                  key: item.product.price_account,
                  symbol: item.symbol,
                })),
            })}
      >
        <SymbolPairTag
          {...(props.isLoading
            ? { isLoading: true }
            : {
                description: props.feed.product.description,
                displaySymbol: props.feed.product.display_symbol,
                grow: true,
                icon: (
                  <PriceFeedIcon assetClass={props.feed.product.asset_type} />
                ),
              })}
        />
      </PriceFeedSelect>
      <SymbolPairTag
        className={styles.priceFeedTag}
        {...(props.isLoading
          ? { isLoading: true }
          : {
              description: props.feed.product.description,
              displaySymbol: props.feed.product.display_symbol,
              icon: (
                <PriceFeedIcon assetClass={props.feed.product.asset_type} />
              ),
            })}
      />
      <div className={styles.rightGroup}>
        {props.isLoading ? (
          <Skeleton width={30} />
        ) : (
          <FeedKey
            className={styles.feedKey ?? ""}
            feedKey={props.feed.product.price_account}
          />
        )}
        <Button
          beforeIcon={<ListDashes />}
          isPending={props.isLoading}
          size="sm"
          variant="outline"
          {...(!props.isLoading && {
            drawer: {
              contents: (
                <ReferenceData
                  feed={{
                    assetClass: props.feed.product.asset_type,
                    base: props.feed.product.base,
                    cmsSymbol: props.feed.product.cms_symbol,
                    contractId: props.feed.product.contract_id,
                    country: props.feed.product.country,
                    cqsSymbol: props.feed.product.cqs_symbol,
                    description: props.feed.product.description,
                    displaySymbol: props.feed.product.display_symbol,
                    exponent: props.feed.price.exponent,
                    feedKey: props.feed.product.price_account,
                    genericSymbol: props.feed.product.generic_symbol,
                    lastSlot: props.feed.price.lastSlot,
                    minPublishers: props.feed.price.minPublishers,
                    nasdaqSymbol: props.feed.product.nasdaq_symbol,
                    numComponentPrices: props.feed.price.numComponentPrices,
                    numQuoters: props.feed.price.numQuoters,
                    quoteCurrency: props.feed.product.quote_currency,
                    schedule: props.feed.product.schedule,
                    symbol: props.feed.symbol,
                    tenor: props.feed.product.tenor,
                    validSlot: props.feed.price.validSlot,
                    weeklySchedule: props.feed.product.weekly_schedule,
                  }}
                />
              ),
              fill: true,
              title: "Reference Data",
            },
          })}
        >
          Reference Data
        </Button>
      </div>
    </div>
    <Cards>
      <StatCard
        header={
          props.isLoading ? (
            <Skeleton width={30} />
          ) : (
            <>
              Aggregated{" "}
              <PriceName assetClass={props.feed.product.asset_type} />
            </>
          )
        }
        stat={
          props.isLoading ? (
            <Skeleton width={20} />
          ) : (
            <LivePrice
              cluster={Cluster.Pythnet}
              feedKey={props.feed.product.price_account}
              updatePageTitle
            />
          )
        }
        variant="primary"
      />
      <StatCard
        corner={
          <Explain size="xs" title="Confidence">
            <p>
              <b>Confidence</b> is how far from the aggregate price Pyth
              believes the true price might be. It reflects a combination of the
              confidence of individual quoters and how well individual quoters
              agree with each other.
            </p>
            <Button
              href="https://docs.pyth.network/price-feeds/best-practices#confidence-intervals"
              size="xs"
              target="_blank"
              variant="solid"
            >
              Learn more
            </Button>
          </Explain>
        }
        header="Confidence"
        stat={
          props.isLoading ? (
            <Skeleton width={20} />
          ) : (
            <LiveConfidence
              cluster={Cluster.Pythnet}
              feedKey={props.feed.product.price_account}
            />
          )
        }
      />
      <StatCard
        header={
          props.isLoading ? (
            <Skeleton width={30} />
          ) : (
            <>
              1-Day <PriceName assetClass={props.feed.product.asset_type} />{" "}
              Change
            </>
          )
        }
        stat={
          props.isLoading ? (
            <Skeleton width={20} />
          ) : (
            <YesterdaysPricesProvider
              feeds={{ [props.feed.symbol]: props.feed.product.price_account }}
            >
              <PriceFeedChangePercent
                feedKey={props.feed.product.price_account}
              />
            </YesterdaysPricesProvider>
          )
        }
      />
      <StatCard
        header="Last Updated"
        stat={
          props.isLoading ? (
            <Skeleton width={20} />
          ) : (
            <LiveLastUpdated
              cluster={Cluster.Pythnet}
              feedKey={props.feed.product.price_account}
            />
          )
        }
      />
    </Cards>
  </section>
);
