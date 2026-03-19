"use client";

import { EntityList } from "@pythnetwork/component-library/EntityList";
import { SymbolPairTag } from "@pythnetwork/component-library/SymbolPairTag";
import type { RowConfig } from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import type { ReactNode } from "react";
import { useMemo } from "react";
import type { Cluster } from "../../services/pyth";
import type { Status } from "../../status";
import { AssetClassBadge } from "../AssetClassBadge";
import { usePriceComponentDrawer } from "../PriceComponentDrawer";
import { Score } from "../Score";
import styles from "./top-feeds-table.module.scss";

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
        cluster,
        feedKey: feed.key,
        name: (
          <SymbolPairTag
            className={styles.symbol}
            description={feed.description}
            displaySymbol={feed.displaySymbol}
            icon={feed.icon}
          />
        ),
        publisherKey,
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
        data: {
          asset: feed.name,
          assetClass: <AssetClassBadge>{feed.assetClass}</AssetClassBadge>,
          score: <Score score={feed.score} width={props.publisherScoreWidth} />,
        },
        header: feed.name,
        id: feed.symbol,
        onAction: () => {
          selectComponent(feed);
        },
        textValue: feed.symbol,
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
      className={styles.list ?? ""}
      fields={[
        { id: "score", name: "Score" },
        { id: "assetClass", name: "Asset Class" },
      ]}
      headerLoadingSkeleton={nameLoadingSkeleton}
      label={label}
      {...(props.isLoading ? { isLoading: true } : { rows: props.rows })}
    />
    <Table
      className={styles.table ?? ""}
      columns={[
        {
          alignment: "left",
          id: "score",
          name: "SCORE",
          width: publisherScoreWidth,
        },
        {
          alignment: "left",
          id: "asset",
          isRowHeader: true,
          loadingSkeleton: nameLoadingSkeleton,
          name: "ASSET",
        },
        {
          alignment: "right",
          id: "assetClass",
          name: "ASSET CLASS",
          width: 40,
        },
      ]}
      fill
      label={label}
      rounded
      {...(props.isLoading ? { isLoading: true } : { rows: props.rows })}
    />
  </>
);
