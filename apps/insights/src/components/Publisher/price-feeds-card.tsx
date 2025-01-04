"use client";

import { Badge } from "@pythnetwork/component-library/Badge";
import { Card } from "@pythnetwork/component-library/Card";
import { Paginator } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import {
  type RowConfig,
  type SortDescriptor,
  Table,
} from "@pythnetwork/component-library/Table";
import { type ReactNode, Suspense, useMemo } from "react";
import { useFilter, useCollator } from "react-aria";

import { useSelectPriceFeed } from "./price-feed-drawer-provider";
import styles from "./price-feeds-card.module.scss";
import { Cluster } from "../../services/pyth";
import { Status as StatusType } from "../../status";
import { useQueryParamFilterPagination } from "../../use-query-param-filter-pagination";
import { FormattedNumber } from "../FormattedNumber";
import { NoResults } from "../NoResults";
import { PriceFeedTag } from "../PriceFeedTag";
import rootStyles from "../Root/index.module.scss";
import { Score } from "../Score";
import { Status as StatusComponent } from "../Status";

const SCORE_WIDTH = 24;

type Props = {
  className?: string | undefined;
  toolbar?: ReactNode;
  priceFeeds: PriceFeed[];
};

type PriceFeed = {
  id: string;
  score: number | undefined;
  symbol: string;
  displaySymbol: string;
  uptimeScore: number | undefined;
  deviationPenalty: number | undefined;
  deviationScore: number | undefined;
  stalledPenalty: number | undefined;
  stalledScore: number | undefined;
  icon: ReactNode;
  cluster: Cluster;
  status: StatusType;
};

export const PriceFeedsCard = ({ priceFeeds, ...props }: Props) => (
  <Suspense fallback={<PriceFeedsCardContents isLoading {...props} />}>
    <ResolvedPriceFeedsCard priceFeeds={priceFeeds} {...props} />
  </Suspense>
);

const ResolvedPriceFeedsCard = ({ priceFeeds, ...props }: Props) => {
  const collator = useCollator();
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const selectPriceFeed = useSelectPriceFeed();

  const {
    search,
    sortDescriptor,
    page,
    pageSize,
    updateSearch,
    updateSortDescriptor,
    updatePage,
    updatePageSize,
    paginatedItems,
    numResults,
    numPages,
    mkPageLink,
  } = useQueryParamFilterPagination(
    priceFeeds,
    (priceFeed, search) => filter.contains(priceFeed.displaySymbol, search),
    (a, b, { column, direction }) => {
      switch (column) {
        case "score":
        case "uptimeScore":
        case "deviationScore":
        case "stalledScore":
        case "stalledPenalty":
        case "deviationPenalty": {
          if (a[column] === undefined && b[column] === undefined) {
            return 0;
          } else if (a[column] === undefined) {
            return direction === "descending" ? 1 : -1;
          } else if (b[column] === undefined) {
            return direction === "descending" ? -1 : 1;
          } else {
            return (
              (direction === "descending" ? -1 : 1) * (a[column] - b[column])
            );
          }
        }

        case "name": {
          return (
            (direction === "descending" ? -1 : 1) *
            collator.compare(a.displaySymbol, b.displaySymbol)
          );
        }

        case "status": {
          const resultByStatus = b.status - a.status;
          const result =
            resultByStatus === 0
              ? collator.compare(a.displaySymbol, b.displaySymbol)
              : resultByStatus;

          return (direction === "descending" ? -1 : 1) * result;
        }

        default: {
          return 0;
        }
      }
    },
    {
      defaultPageSize: 20,
      defaultSort: "name",
      defaultDescending: false,
    },
  );

  const rows = useMemo(
    () =>
      paginatedItems.map(
        ({
          id,
          score,
          uptimeScore,
          deviationPenalty,
          deviationScore,
          stalledPenalty,
          stalledScore,
          displaySymbol,
          symbol,
          icon,
          cluster,
          status,
        }) => ({
          id,
          data: {
            name: (
              <div className={styles.priceFeedName}>
                <PriceFeedTag compact symbol={displaySymbol} icon={icon} />
                {cluster === Cluster.PythtestConformance && (
                  <Badge variant="muted" style="filled" size="xs">
                    test
                  </Badge>
                )}
              </div>
            ),
            score: score !== undefined && (
              <Score score={score} width={SCORE_WIDTH} />
            ),
            uptimeScore: uptimeScore !== undefined && (
              <FormattedNumber
                value={uptimeScore}
                maximumSignificantDigits={5}
              />
            ),
            deviationPenalty: deviationPenalty !== undefined && (
              <FormattedNumber
                value={deviationPenalty}
                maximumSignificantDigits={5}
              />
            ),
            deviationScore: deviationScore !== undefined && (
              <FormattedNumber
                value={deviationScore}
                maximumSignificantDigits={5}
              />
            ),
            stalledPenalty: stalledPenalty !== undefined && (
              <FormattedNumber
                value={stalledPenalty}
                maximumSignificantDigits={5}
              />
            ),
            stalledScore: stalledScore !== undefined && (
              <FormattedNumber
                value={stalledScore}
                maximumSignificantDigits={5}
              />
            ),
            status: <StatusComponent status={status} />,
          },
          ...(selectPriceFeed && {
            onAction: () => {
              selectPriceFeed(symbol);
            },
          }),
        }),
      ),
    [paginatedItems, selectPriceFeed],
  );

  return (
    <PriceFeedsCardContents
      numResults={numResults}
      search={search}
      sortDescriptor={sortDescriptor}
      numPages={numPages}
      page={page}
      pageSize={pageSize}
      onSearchChange={updateSearch}
      onSortChange={updateSortDescriptor}
      onPageSizeChange={updatePageSize}
      onPageChange={updatePage}
      mkPageLink={mkPageLink}
      rows={rows}
      {...props}
    />
  );
};

type PriceFeedsCardProps = Pick<Props, "className" | "toolbar"> &
  (
    | { isLoading: true }
    | {
        isLoading?: false;
        numResults: number;
        search: string;
        sortDescriptor: SortDescriptor;
        numPages: number;
        page: number;
        pageSize: number;
        onSearchChange: (newSearch: string) => void;
        onSortChange: (newSort: SortDescriptor) => void;
        onPageSizeChange: (newPageSize: number) => void;
        onPageChange: (newPage: number) => void;
        mkPageLink: (page: number) => string;
        rows: RowConfig<
          | "score"
          | "name"
          | "uptimeScore"
          | "deviationScore"
          | "deviationPenalty"
          | "stalledScore"
          | "stalledPenalty"
          | "status"
        >[];
      }
  );

const PriceFeedsCardContents = ({
  className,
  ...props
}: PriceFeedsCardProps) => (
  <Card
    className={className}
    title="Price Feeds"
    toolbar={
      <SearchInput
        size="sm"
        width={60}
        placeholder="Feed symbol"
        {...(props.isLoading
          ? { isPending: true, isDisabled: true }
          : {
              value: props.search,
              onChange: props.onSearchChange,
            })}
      />
    }
    {...(!props.isLoading && {
      footer: (
        <Paginator
          numPages={props.numPages}
          currentPage={props.page}
          onPageChange={props.onPageChange}
          pageSize={props.pageSize}
          onPageSizeChange={props.onPageSizeChange}
          pageSizeOptions={[10, 20, 30, 40, 50]}
          mkPageLink={props.mkPageLink}
        />
      ),
    })}
  >
    <Table
      label="Price Feeds"
      fill
      rounded
      stickyHeader={rootStyles.headerHeight}
      columns={[
        {
          id: "score",
          name: "SCORE",
          alignment: "left",
          width: SCORE_WIDTH,
          loadingSkeleton: <Score isLoading width={SCORE_WIDTH} />,
          allowsSorting: true,
        },
        {
          id: "name",
          name: "NAME / ID",
          alignment: "left",
          isRowHeader: true,
          loadingSkeleton: <PriceFeedTag compact isLoading />,
          fill: true,
          allowsSorting: true,
        },
        {
          id: "uptimeScore",
          name: "UPTIME SCORE",
          alignment: "center",
          allowsSorting: true,
        },
        {
          id: "deviationScore",
          name: "DEVIATION SCORE",
          alignment: "center",
          allowsSorting: true,
        },
        {
          id: "deviationPenalty",
          name: "DEVIATION PENALTY",
          alignment: "center",
          allowsSorting: true,
        },
        {
          id: "stalledScore",
          name: "STALLED SCORE",
          alignment: "center",
          allowsSorting: true,
        },
        {
          id: "stalledPenalty",
          name: "STALLED PENALTY",
          alignment: "center",
          allowsSorting: true,
        },
        {
          id: "status",
          name: "STATUS",
          alignment: "right",
          allowsSorting: true,
        },
      ]}
      {...(props.isLoading
        ? { isLoading: true }
        : {
            rows: props.rows,
            sortDescriptor: props.sortDescriptor,
            onSortChange: props.onSortChange,
            emptyState: (
              <NoResults
                query={props.search}
                onClearSearch={() => {
                  props.onSearchChange("");
                }}
              />
            ),
          })}
    />
  </Card>
);
