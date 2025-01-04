"use client";

import { useLogger } from "@pythnetwork/app-logger";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Card } from "@pythnetwork/component-library/Card";
import { Paginator } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { Switch } from "@pythnetwork/component-library/Switch";
import {
  type RowConfig,
  type SortDescriptor,
  Table,
} from "@pythnetwork/component-library/Table";
import { useQueryState, parseAsString, parseAsBoolean } from "nuqs";
import { type ReactNode, Suspense, useMemo, useCallback } from "react";
import { useFilter, useCollator } from "react-aria";

import styles from "./publishers-card.module.scss";
import { Cluster } from "../../services/pyth";
import { Status as StatusType } from "../../status";
import { useQueryParamFilterPagination } from "../../use-query-param-filter-pagination";
import { FormattedNumber } from "../FormattedNumber";
import { NoResults } from "../NoResults";
import { PriceComponentDrawer } from "../PriceComponentDrawer";
import { PublisherTag } from "../PublisherTag";
import rootStyles from "../Root/index.module.scss";
import { Score } from "../Score";
import { Status as StatusComponent } from "../Status";

const SCORE_WIDTH = 24;

type Props = {
  symbol: string;
  feedKey: string;
  className?: string | undefined;
  publishers: Publisher[];
};

type Publisher = {
  id: string;
  publisherKey: string;
  score: number | undefined;
  uptimeScore: number | undefined;
  deviationPenalty: number | undefined;
  deviationScore: number | undefined;
  stalledPenalty: number | undefined;
  stalledScore: number | undefined;
  rank: number | undefined;
  cluster: Cluster;
  status: StatusType;
} & (
  | { name: string; icon: ReactNode }
  | { name?: undefined; icon?: undefined }
);

export const PublishersCard = ({ publishers, ...props }: Props) => (
  <Suspense fallback={<PublishersCardContents isLoading {...props} />}>
    <ResolvedPublishersCard publishers={publishers} {...props} />
  </Suspense>
);

const ResolvedPublishersCard = ({
  symbol,
  feedKey,
  publishers,
  ...props
}: Props) => {
  const { handleClose, selectedPublisher, updateSelectedPublisherKey } =
    usePublisherDrawer(publishers);
  const logger = useLogger();
  const [includeTestFeeds, setIncludeTestFeeds] = useQueryState(
    "includeTestFeeds",
    parseAsBoolean.withDefault(false),
  );
  const collator = useCollator();
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const filteredPublishers = useMemo(
    () =>
      includeTestFeeds
        ? publishers
        : publishers.filter(
            (publisher) => publisher.cluster === Cluster.Pythnet,
          ),
    [includeTestFeeds, publishers],
  );

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
    filteredPublishers,
    (publisher, search) =>
      filter.contains(publisher.publisherKey, search) ||
      (publisher.name !== undefined && filter.contains(publisher.name, search)),
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
            collator.compare(a.name ?? a.publisherKey, b.name ?? b.publisherKey)
          );
        }

        case "status": {
          const resultByStatus = b.status - a.status;
          const result =
            resultByStatus === 0
              ? collator.compare(
                  a.name ?? a.publisherKey,
                  b.name ?? b.publisherKey,
                )
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
      defaultSort: "score",
      defaultDescending: true,
    },
  );

  const rows = useMemo(
    () =>
      paginatedItems.map(
        ({
          id,
          publisherKey,
          score,
          uptimeScore,
          deviationPenalty,
          deviationScore,
          stalledPenalty,
          stalledScore,
          cluster,
          status,
          ...publisher
        }) => ({
          id,
          onAction: () => {
            updateSelectedPublisherKey(publisherKey);
          },
          data: {
            score: score !== undefined && (
              <Score score={score} width={SCORE_WIDTH} />
            ),
            name: (
              <div className={styles.publisherName}>
                <PublisherTag
                  publisherKey={publisherKey}
                  {...(publisher.name && {
                    name: publisher.name,
                    icon: publisher.icon,
                  })}
                />
                {cluster === Cluster.PythtestConformance && (
                  <Badge variant="muted" style="filled" size="xs">
                    test
                  </Badge>
                )}
              </div>
            ),
            uptimeScore: uptimeScore && (
              <FormattedNumber
                value={uptimeScore}
                maximumSignificantDigits={5}
              />
            ),
            deviationPenalty: deviationPenalty && (
              <FormattedNumber
                value={deviationPenalty}
                maximumSignificantDigits={5}
              />
            ),
            deviationScore: deviationScore && (
              <FormattedNumber
                value={deviationScore}
                maximumSignificantDigits={5}
              />
            ),
            stalledPenalty: stalledPenalty && (
              <FormattedNumber
                value={stalledPenalty}
                maximumSignificantDigits={5}
              />
            ),
            stalledScore: stalledScore && (
              <FormattedNumber
                value={stalledScore}
                maximumSignificantDigits={5}
              />
            ),
            status: <StatusComponent status={status} />,
          },
        }),
      ),
    [paginatedItems, updateSelectedPublisherKey],
  );

  const updateIncludeTestFeeds = useCallback(
    (newValue: boolean) => {
      setIncludeTestFeeds(newValue).catch((error: unknown) => {
        logger.error(
          "Failed to update include test components query param",
          error,
        );
      });
    },
    [setIncludeTestFeeds, logger],
  );

  return (
    <>
      <PublishersCardContents
        numResults={numResults}
        search={search}
        sortDescriptor={sortDescriptor}
        numPages={numPages}
        page={page}
        pageSize={pageSize}
        includeTestFeeds={includeTestFeeds}
        onSearchChange={updateSearch}
        onSortChange={updateSortDescriptor}
        onPageSizeChange={updatePageSize}
        onPageChange={updatePage}
        mkPageLink={mkPageLink}
        onIncludeTestFeedsChange={updateIncludeTestFeeds}
        rows={rows}
        {...props}
      />
      {selectedPublisher && (
        <PriceComponentDrawer
          publisherKey={selectedPublisher.publisherKey}
          onClose={handleClose}
          symbol={symbol}
          feedKey={feedKey}
          rank={selectedPublisher.rank}
          score={selectedPublisher.score}
          status={selectedPublisher.status}
          title={<PublisherTag {...selectedPublisher} />}
          navigateButtonText="Open Publisher"
          navigateHref={`/publishers/${selectedPublisher.publisherKey}`}
        />
      )}
    </>
  );
};

type PublishersCardProps = Pick<Props, "className"> &
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
        includeTestFeeds: boolean;
        onIncludeTestFeedsChange: (newValue: boolean) => void;
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

const PublishersCardContents = ({
  className,
  ...props
}: PublishersCardProps) => (
  <Card
    className={className}
    title="Publishers"
    toolbar={
      <>
        <Switch
          {...(props.isLoading
            ? { isLoading: true }
            : {
                isSelected: props.includeTestFeeds,
                onChange: props.onIncludeTestFeedsChange,
              })}
        >
          Show test feeds
        </Switch>
        <SearchInput
          size="sm"
          width={60}
          placeholder="Publisher key or name"
          {...(props.isLoading
            ? { isPending: true, isDisabled: true }
            : {
                value: props.search,
                onChange: props.onSearchChange,
              })}
        />
      </>
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
      label="Publishers"
      fill
      rounded
      stickyHeader={rootStyles.headerHeight}
      columns={[
        {
          id: "score",
          name: "SCORE",
          alignment: "center",
          width: SCORE_WIDTH,
          loadingSkeleton: <Score isLoading width={SCORE_WIDTH} />,
          allowsSorting: true,
        },
        {
          id: "name",
          name: "NAME / ID",
          alignment: "left",
          isRowHeader: true,
          loadingSkeleton: <PublisherTag isLoading />,
          allowsSorting: true,
          fill: true,
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

const usePublisherDrawer = (publishers: Publisher[]) => {
  const logger = useLogger();
  const [selectedPublisherKey, setSelectedPublisher] = useQueryState(
    "publisher",
    parseAsString.withDefault("").withOptions({
      history: "push",
    }),
  );
  const updateSelectedPublisherKey = useCallback(
    (newPublisherKey: string) => {
      setSelectedPublisher(newPublisherKey).catch((error: unknown) => {
        logger.error("Failed to update selected publisher", error);
      });
    },
    [setSelectedPublisher, logger],
  );
  const selectedPublisher = useMemo(
    () =>
      publishers.find(
        (publisher) => publisher.publisherKey === selectedPublisherKey,
      ),
    [selectedPublisherKey, publishers],
  );
  const handleClose = useCallback(() => {
    updateSelectedPublisherKey("");
  }, [updateSelectedPublisherKey]);

  return { selectedPublisher, handleClose, updateSelectedPublisherKey };
};
