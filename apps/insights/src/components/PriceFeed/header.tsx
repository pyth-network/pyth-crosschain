import { ListDashes } from "@phosphor-icons/react/dist/ssr/ListDashes";
import { Breadcrumbs } from "@pythnetwork/component-library/Breadcrumbs";
import { Button } from "@pythnetwork/component-library/Button";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import { Suspense } from "react";

import styles from "./header.module.scss";
import { PriceFeedSelect } from "./price-feed-select";
import { ReferenceData } from "./reference-data";
import { Cluster } from "../../services/pyth";
import { AssetClassBadge } from "../AssetClassBadge";
import { Cards } from "../Cards";
import { Explain } from "../Explain";
import { FeedKey } from "../FeedKey";
import { LivePrice, LiveConfidence, LiveLastUpdated } from "../LivePrices";
import {
  YesterdaysPricesProvider,
  PriceFeedChangePercent,
} from "../PriceFeedChangePercent";
import { PriceFeedIcon } from "../PriceFeedIcon";
import { PriceFeedTag } from "../PriceFeedTag";
import { PriceName } from "../PriceName";
import { getFeed } from "./get-feed";

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
  <PriceFeedHeaderImpl {...await getFeed(params)} />
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
        label="Breadcrumbs"
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
                  symbol: item.symbol,
                  assetClass: item.product.asset_type,
                  description: item.product.description,
                  displaySymbol: item.product.display_symbol,
                  key: item.product.price_account,
                  icon: (
                    <PriceFeedIcon
                      assetClass={item.product.asset_type}
                      symbol={item.symbol}
                    />
                  ),
                })),
            })}
      >
        <PriceFeedTag
          {...(props.isLoading
            ? { isLoading: true }
            : {
                description: props.feed.product.description,
                displaySymbol: props.feed.product.display_symbol,
                icon: (
                  <PriceFeedIcon
                    assetClass={props.feed.product.asset_type}
                    symbol={props.feed.symbol}
                  />
                ),
              })}
        />
      </PriceFeedSelect>
      <PriceFeedTag
        className={styles.priceFeedTag}
        {...(props.isLoading
          ? { isLoading: true }
          : {
              description: props.feed.product.description,
              displaySymbol: props.feed.product.display_symbol,
              icon: (
                <PriceFeedIcon
                  assetClass={props.feed.product.asset_type}
                  symbol={props.feed.symbol}
                />
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
          variant="outline"
          size="sm"
          beforeIcon={<ListDashes />}
          isPending={props.isLoading}
          {...(!props.isLoading && {
            drawer: {
              fill: true,
              title: "Reference Data",
              contents: (
                <ReferenceData
                  feed={{
                    symbol: props.feed.symbol,
                    feedKey: props.feed.product.price_account,
                    assetClass: props.feed.product.asset_type,
                    base: props.feed.product.base,
                    description: props.feed.product.description,
                    country: props.feed.product.country,
                    quoteCurrency: props.feed.product.quote_currency,
                    tenor: props.feed.product.tenor,
                    cmsSymbol: props.feed.product.cms_symbol,
                    cqsSymbol: props.feed.product.cqs_symbol,
                    nasdaqSymbol: props.feed.product.nasdaq_symbol,
                    genericSymbol: props.feed.product.generic_symbol,
                    weeklySchedule: props.feed.product.weekly_schedule,
                    schedule: props.feed.product.schedule,
                    contractId: props.feed.product.contract_id,
                    displaySymbol: props.feed.product.display_symbol,
                    exponent: props.feed.price.exponent,
                    numComponentPrices: props.feed.price.numComponentPrices,
                    numQuoters: props.feed.price.numQuoters,
                    minPublishers: props.feed.price.minPublishers,
                    lastSlot: props.feed.price.lastSlot,
                    validSlot: props.feed.price.validSlot,
                  }}
                />
              ),
            },
          })}
        >
          Reference Data
        </Button>
      </div>
    </div>
    <Cards>
      <StatCard
        variant="primary"
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
              feedKey={props.feed.product.price_account}
              cluster={Cluster.Pythnet}
            />
          )
        }
      />
      <StatCard
        header="Confidence"
        stat={
          props.isLoading ? (
            <Skeleton width={20} />
          ) : (
            <LiveConfidence
              feedKey={props.feed.product.price_account}
              cluster={Cluster.Pythnet}
            />
          )
        }
        corner={
          <Explain size="xs" title="Confidence">
            <p>
              <b>Confidence</b> is how far from the aggregate price Pyth
              believes the true price might be. It reflects a combination of the
              confidence of individual quoters and how well individual quoters
              agree with each other.
            </p>
            <Button
              size="xs"
              variant="solid"
              href="https://docs.pyth.network/price-feeds/best-practices#confidence-intervals"
              target="_blank"
            >
              Learn more
            </Button>
          </Explain>
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
              feedKey={props.feed.product.price_account}
              cluster={Cluster.Pythnet}
            />
          )
        }
      />
    </Cards>
  </section>
);
