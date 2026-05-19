"use client";

import { Broadcast } from "@phosphor-icons/react/dist/ssr/Broadcast";
import { Database } from "@phosphor-icons/react/dist/ssr/Database";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Card } from "@pythnetwork/component-library/Card";
import { EntityList } from "@pythnetwork/component-library/EntityList";
import { Link } from "@pythnetwork/component-library/Link";
import { NoResults } from "@pythnetwork/component-library/NoResults";
import { Paginator } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { Select } from "@pythnetwork/component-library/Select";
import type {
  RowConfig,
  SortDescriptor,
} from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import { useQueryParamFilterPagination } from "@pythnetwork/component-library/useQueryParamsPagination";
import {
  parseAsStringEnum,
  useQueryState,
} from "@pythnetwork/react-hooks/nuqs";
import clsx from "clsx";
import type { ReactNode } from "react";
import { Suspense, useCallback, useMemo } from "react";
import { useCollator, useFilter } from "react-aria";
import { CLUSTER_NAMES } from "../../services/pyth";
import {
  ExplainActive,
  ExplainPermissioned,
  ExplainRanking,
} from "../Explanations";
import { PublisherTag } from "../PublisherTag";
import { Ranking } from "../Ranking";
import { Score } from "../Score";
import styles from "./publishers-card.module.scss";

const PUBLISHER_SCORE_WIDTH = 38;

type Props = {
  className?: string | undefined;
  pythnetPublishers: Publisher[];
  pythtestConformancePublishers: Publisher[];
  explainAverage: ReactNode;
};

type Publisher = {
  id: string;
  ranking?: number | undefined;
  permissionedFeeds: number;
  activeFeeds?: number | undefined;
  averageScore?: number | undefined;
} & (
  | { name: string; icon: ReactNode }
  | { name?: undefined; icon?: undefined }
);

export const PublishersCard = ({
  pythnetPublishers,
  pythtestConformancePublishers,
  ...props
}: Props) => (
  <Suspense fallback={<PublishersCardContents isLoading {...props} />}>
    <ResolvedPublishersCard
      pythnetPublishers={pythnetPublishers}
      pythtestConformancePublishers={pythtestConformancePublishers}
      {...props}
    />
  </Suspense>
);

const ResolvedPublishersCard = ({
  pythnetPublishers,
  pythtestConformancePublishers,
  ...props
}: Props) => {
  const logger = useLogger();
  const collator = useCollator();
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const [cluster, setCluster] = useQueryState(
    "cluster",
    parseAsStringEnum([...CLUSTER_NAMES]).withDefault("pythnet"),
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
    cluster === "pythnet" ? pythnetPublishers : pythtestConformancePublishers,
    (publisher, search) =>
      filter.contains(publisher.id, search) ||
      (publisher.name !== undefined && filter.contains(publisher.name, search)),
    (a, b, { column, direction }) => {
      const desc = direction === "descending" ? -1 : 1;

      const sortByName =
        desc * collator.compare(a.name ?? a.id, b.name ?? b.id);

      const sortByRankingField = (
        column: "ranking" | "activeFeeds" | "averageScore",
      ) => {
        if (a[column] === undefined) {
          return b[column] === undefined ? sortByName : 1;
        } else {
          return b[column] === undefined ? -1 : desc * (a[column] - b[column]);
        }
      };

      switch (column) {
        case "permissionedFeeds": {
          return desc * (a[column] - b[column]);
        }

        case "ranking":
        case "activeFeeds":
        case "averageScore": {
          return sortByRankingField(column);
        }

        case "name": {
          return sortByName;
        }

        default: {
          return sortByRankingField("ranking");
        }
      }
    },
    (items) => items,
    { defaultSort: "ranking" },
  );

  const rows = useMemo(
    () =>
      paginatedItems.map(
        ({
          id,
          ranking,
          averageScore,
          permissionedFeeds,
          activeFeeds,
          ...publisher
        }) => ({
          data: {
            activeFeeds: (
              <Link
                href={`/publishers/${cluster}/${id}/price-feeds?status=Active`}
                invert
                prefetch={false}
              >
                {activeFeeds}
              </Link>
            ),
            averageScore: averageScore !== undefined && (
              <Score score={averageScore} width={PUBLISHER_SCORE_WIDTH} />
            ),
            name: (
              <PublisherTag
                publisherKey={id}
                {...(publisher.name && {
                  icon: publisher.icon,
                  name: publisher.name,
                })}
              />
            ),
            permissionedFeeds,
            ranking: ranking !== undefined && <Ranking>{ranking}</Ranking>,
          },
          href: `/publishers/${cluster}/${id}`,
          id,
          prefetch: false,
          textValue: publisher.name ?? id,
        }),
      ),
    [paginatedItems, cluster],
  );

  const updateCluster = useCallback(
    (newCluster: (typeof CLUSTER_NAMES)[number]) => {
      updatePage(1);
      setCluster(newCluster).catch((error: unknown) => {
        logger.error("Failed to update asset class", error);
      });
    },
    [updatePage, setCluster, logger],
  );

  return (
    <PublishersCardContents
      cluster={cluster}
      mkPageLink={mkPageLink}
      numPages={numPages}
      numResults={numResults}
      onChangeCluster={updateCluster}
      onPageChange={updatePage}
      onPageSizeChange={updatePageSize}
      onSearchChange={updateSearch}
      onSortChange={updateSortDescriptor}
      page={page}
      pageSize={pageSize}
      rows={rows}
      search={search}
      sortDescriptor={sortDescriptor}
      {...props}
    />
  );
};

type PublishersCardContentsProps = Pick<Props, "className" | "explainAverage"> &
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
        cluster: (typeof CLUSTER_NAMES)[number];
        onChangeCluster: (value: (typeof CLUSTER_NAMES)[number]) => void;
        rows: (RowConfig<
          | "ranking"
          | "name"
          | "permissionedFeeds"
          | "activeFeeds"
          | "averageScore"
        > & { textValue: string })[];
      }
  );

const PublishersCardContents = ({
  className,
  explainAverage,
  ...props
}: PublishersCardContentsProps) => (
  <Card
    className={clsx(styles.publishersCard, className)}
    icon={<Broadcast />}
    title={
      <>
        <span>Publishers</span>
        {!props.isLoading && (
          <Badge size="md" style="filled" variant="neutral">
            {props.numResults}
          </Badge>
        )}
      </>
    }
    toolbar={
      <>
        <SearchInput
          className={styles.searchInput ?? ""}
          placeholder="Publisher key or name"
          size="sm"
          width={60}
          {...(props.isLoading
            ? { isDisabled: true, isPending: true }
            : {
                onChange: props.onSearchChange,
                value: props.search,
              })}
        />
        <Select
          hideLabel
          icon={<Database />}
          label="Cluster"
          options={CLUSTER_NAMES.map((id) => ({ id }))}
          size="sm"
          variant="outline"
          {...(props.isLoading
            ? { buttonLabel: "Cluster", isPending: true }
            : {
                onSelectionChange: props.onChangeCluster,
                placement: "bottom end",
                selectedKey: props.cluster,
              })}
        />
      </>
    }
    toolbarClassName={styles.toolbar}
    {...(!props.isLoading && {
      footer: (
        <Paginator
          currentPage={props.page}
          mkPageLink={props.mkPageLink}
          numPages={props.numPages}
          onPageChange={props.onPageChange}
          onPageSizeChange={props.onPageSizeChange}
          pageSize={props.pageSize}
        />
      ),
    })}
  >
    <EntityList
      className={styles.entityList ?? ""}
      fields={[
        { id: "averageScore", name: "Average Score" },
        { id: "permissionedFeeds", name: "Permissioned Feeds" },
        { id: "activeFeeds", name: "Active Feeds" },
      ]}
      headerLoadingSkeleton={<PublisherTag isLoading />}
      isLoading={props.isLoading}
      label="Publishers"
      rows={
        props.isLoading
          ? []
          : props.rows.map((row) => ({
              ...row,
              header: (
                <>
                  {row.data.name}
                  <div className={styles.rankingWraper}>{row.data.ranking}</div>
                </>
              ),
            }))
      }
    />
    <Table
      className={styles.table ?? ""}
      columns={[
        {
          allowsSorting: true,
          id: "ranking",
          loadingSkeleton: <Ranking isLoading />,
          name: (
            <>
              RANKING
              <ExplainRanking />
            </>
          ),
          width: 25,
        },
        {
          alignment: "left",
          allowsSorting: true,
          id: "name",
          isRowHeader: true,
          loadingSkeleton: <PublisherTag isLoading />,
          name: "NAME / ID",
        },
        {
          alignment: "center",
          allowsSorting: true,
          id: "permissionedFeeds",
          name: (
            <>
              PERMISSIONED
              <ExplainPermissioned />
            </>
          ),
          width: 30,
        },
        {
          alignment: "center",
          allowsSorting: true,
          id: "activeFeeds",
          name: (
            <>
              ACTIVE
              <ExplainActive />
            </>
          ),
          width: 24,
        },
        {
          alignment: "right",
          allowsSorting: true,
          id: "averageScore",
          loadingSkeleton: <Score isLoading width={PUBLISHER_SCORE_WIDTH} />,
          name: (
            <>
              AVERAGE SCORE
              {explainAverage}
            </>
          ),
          width: PUBLISHER_SCORE_WIDTH,
        },
      ]}
      fill
      label="Publishers"
      rounded
      stickyHeader="appHeader"
      {...(props.isLoading
        ? {
            isLoading: true,
          }
        : {
            emptyState: (
              <NoResults
                onClearSearch={() => {
                  props.onSearchChange("");
                }}
                query={props.search}
              />
            ),
            onSortChange: props.onSortChange,
            rows: props.rows,
            sortDescriptor: props.sortDescriptor,
          })}
    />
  </Card>
);
