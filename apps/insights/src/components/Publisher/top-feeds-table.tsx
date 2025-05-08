"use client";

import { EntityList } from "@pythnetwork/component-library/EntityList";
import type { RowConfig } from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import type { ReactNode } from "react";
import { useMemo } from "react";

import styles from "./top-feeds-table.module.scss";
import type { Cluster } from "../../services/pyth";
import type { Status } from "../../status";
import { AssetClassBadge } from "../AssetClassBadge";
import { usePriceComponentDrawer } from "../PriceComponentDrawer";
import { PriceFeedTag } from "../PriceFeedTag";
import { Score } from "../Score";

type Props =
  | LoadingTopFeedsTableImplProps
  | (ResolvedTopFeedsTableProps & { isLoading?: false | undefined });

export const TopFeedsTable = (props: Props) =>
  props.isLoading ? (
    <TopFeedsTableImpl {...props} />
  ) : (
    <ResolvedTopFeedsTable {...props} />
  );

type ResolvedTopFeedsTableProps = BaseTopFeedsTableImplProps & {
  publisherKey: string;
  cluster: Cluster;
  feeds: {
    key: string;
    symbol: string;
    displaySymbol: string;
    description: string;
    assetClass: string;
    score: number;
    rank: number;
    status: Status;
    firstEvaluation: Date;
    icon: ReactNode;
    href: string;
  }[];
};

const ResolvedTopFeedsTable = ({
  cluster,
  feeds,
  publisherKey,
  ...props
}: ResolvedTopFeedsTableProps) => {
  const drawerComponents = useMemo(
    () =>
      feeds.map((feed) => ({
        name: (
          <PriceFeedTag
            displaySymbol={feed.displaySymbol}
            description={feed.description}
            icon={feed.icon}
          />
        ),
        publisherKey,
        feedKey: feed.key,
        cluster,
        ...feed,
      })),
    [feeds, cluster, publisherKey],
  );

  const { selectComponent } = usePriceComponentDrawer({
    components: drawerComponents,
  });

  const rows = useMemo(
    () =>
      drawerComponents.map((feed) => ({
        id: feed.symbol,
        textValue: feed.symbol,
        header: feed.name,
        data: {
          asset: feed.name,
          assetClass: <AssetClassBadge>{feed.assetClass}</AssetClassBadge>,
          score: <Score width={props.publisherScoreWidth} score={feed.score} />,
        },
        onAction: () => {
          selectComponent(feed);
        },
      })),
    [drawerComponents, props.publisherScoreWidth, selectComponent],
  );

  return <TopFeedsTableImpl rows={rows} {...props} />;
};

type BaseTopFeedsTableImplProps = {
  publisherScoreWidth: number;
  label: string;
  nameLoadingSkeleton: ReactNode;
};
type LoadingTopFeedsTableImplProps = BaseTopFeedsTableImplProps & {
  isLoading: true;
};
type LoadedTopFeedsTableImplProps = BaseTopFeedsTableImplProps & {
  isLoading?: false | undefined;
  rows: (RowConfig<"score" | "asset" | "assetClass"> & {
    textValue: string;
    header: ReactNode;
  })[];
};
type TopFeedsTableImplProps =
  | LoadingTopFeedsTableImplProps
  | LoadedTopFeedsTableImplProps;

const TopFeedsTableImpl = ({
  publisherScoreWidth,
  label,
  nameLoadingSkeleton,
  ...props
}: TopFeedsTableImplProps) => (
  <>
    <EntityList
      label={label}
      className={styles.list ?? ""}
      headerLoadingSkeleton={nameLoadingSkeleton}
      fields={[
        { id: "score", name: "Score" },
        { id: "assetClass", name: "Asset Class" },
      ]}
      {...(props.isLoading ? { isLoading: true } : { rows: props.rows })}
    />
    <Table
      label={label}
      rounded
      fill
      className={styles.table ?? ""}
      columns={[
        {
          id: "score",
          name: "SCORE",
          alignment: "left",
          width: publisherScoreWidth,
        },
        {
          id: "asset",
          name: "ASSET",
          isRowHeader: true,
          alignment: "left",
          loadingSkeleton: nameLoadingSkeleton,
        },
        {
          id: "assetClass",
          name: "ASSET CLASS",
          alignment: "right",
          width: 40,
        },
      ]}
      {...(props.isLoading ? { isLoading: true } : { rows: props.rows })}
    />
  </>
);
