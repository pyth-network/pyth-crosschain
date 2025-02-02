"use client";

import { Broadcast } from "@phosphor-icons/react/dist/ssr/Broadcast";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Card } from "@pythnetwork/component-library/Card";
import { Link } from "@pythnetwork/component-library/Link";
import { Paginator } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import {
  type RowConfig,
  type SortDescriptor,
  Table,
} from "@pythnetwork/component-library/Table";
import { type ReactNode, Suspense, useMemo } from "react";
import { useFilter, useCollator } from "react-aria";

import { useQueryParamFilterPagination } from "../../hooks/use-query-param-filter-pagination";
import { ExplainActive, ExplainInactive } from "../Explanations";
import { NoResults } from "../NoResults";
import { PublisherTag } from "../PublisherTag";
import { Ranking } from "../Ranking";
import rootStyles from "../Root/index.module.scss";
import { Score } from "../Score";

const PUBLISHER_SCORE_WIDTH = 38;

type Props = {
  className?: string | undefined;
  publishers: Publisher[];
  explainAverage: ReactNode;
};

type Publisher = {
  id: string;
  ranking: number;
  activeFeeds: number;
  inactiveFeeds: number;
  averageScore: number;
} & (
  | { name: string; icon: ReactNode }
  | { name?: undefined; icon?: undefined }
);

export const PublishersCard = ({ publishers, ...props }: Props) => (
  <Suspense fallback={<PublishersCardContents isLoading {...props} />}>
    <ResolvedPublishersCard publishers={publishers} {...props} />
  </Suspense>
);

const ResolvedPublishersCard = ({ publishers, ...props }: Props) => {
  const collator = useCollator();
  const filter = useFilter({ sensitivity: "base", usage: "search" });
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
    publishers,
    (publisher, search) =>
      filter.contains(publisher.id, search) ||
      (publisher.name !== undefined && filter.contains(publisher.name, search)),
    (a, b, { column, direction }) => {
      switch (column) {
        case "ranking":
        case "activeFeeds":
        case "inactiveFeeds":
        case "averageScore": {
          return (
            (direction === "descending" ? -1 : 1) * (a[column] - b[column])
          );
        }

        case "name": {
          return (
            (direction === "descending" ? -1 : 1) *
            collator.compare(a.name ?? a.id, b.name ?? b.id)
          );
        }

        default: {
          return (
            (direction === "descending" ? -1 : 1) * (a.ranking - b.ranking)
          );
        }
      }
    },
    { defaultSort: "ranking" },
  );

  const rows = useMemo(
    () =>
      paginatedItems.map(
        ({
          id,
          ranking,
          averageScore,
          activeFeeds,
          inactiveFeeds,
          ...publisher
        }) => ({
          id,
          href: `/publishers/${id}`,
          data: {
            ranking: <Ranking>{ranking}</Ranking>,
            name: (
              <PublisherTag
                publisherKey={id}
                {...(publisher.name && {
                  name: publisher.name,
                  icon: publisher.icon,
                })}
              />
            ),
            activeFeeds: (
              <Link href={`/publishers/${id}/price-feeds?status=Active`} invert>
                {activeFeeds}
              </Link>
            ),
            inactiveFeeds: (
              <Link
                href={`/publishers/${id}/price-feeds?status=Inactive`}
                invert
              >
                {inactiveFeeds}
              </Link>
            ),
            averageScore: (
              <Score score={averageScore} width={PUBLISHER_SCORE_WIDTH} />
            ),
          },
        }),
      ),
    [paginatedItems],
  );

  return (
    <PublishersCardContents
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
        rows: RowConfig<
          "ranking" | "name" | "activeFeeds" | "inactiveFeeds" | "averageScore"
        >[];
      }
  );

const PublishersCardContents = ({
  className,
  explainAverage,
  ...props
}: PublishersCardContentsProps) => (
  <Card
    className={className}
    icon={<Broadcast />}
    title={
      <>
        <span>Publishers</span>
        {!props.isLoading && (
          <Badge style="filled" variant="neutral" size="md">
            {props.numResults}
          </Badge>
        )}
      </>
    }
    toolbar={
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
      rounded
      fill
      label="Publishers"
      stickyHeader={rootStyles.headerHeight}
      columns={[
        {
          id: "ranking",
          name: "RANKING",
          width: 25,
          loadingSkeleton: <Ranking isLoading />,
          allowsSorting: true,
        },
        {
          id: "name",
          name: "NAME / ID",
          isRowHeader: true,
          alignment: "left",
          loadingSkeleton: <PublisherTag isLoading />,
          allowsSorting: true,
        },
        {
          id: "activeFeeds",
          name: (
            <>
              ACTIVE FEEDS
              <ExplainActive />
            </>
          ),
          alignment: "center",
          width: 30,
          allowsSorting: true,
        },
        {
          id: "inactiveFeeds",
          name: (
            <>
              INACTIVE FEEDS
              <ExplainInactive />
            </>
          ),
          alignment: "center",
          width: 30,
          allowsSorting: true,
        },
        {
          id: "averageScore",
          name: (
            <>
              AVERAGE SCORE
              {explainAverage}
            </>
          ),
          alignment: "right",
          width: PUBLISHER_SCORE_WIDTH,
          loadingSkeleton: <Score isLoading width={PUBLISHER_SCORE_WIDTH} />,
          allowsSorting: true,
        },
      ]}
      {...(props.isLoading
        ? {
            isLoading: true,
          }
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
