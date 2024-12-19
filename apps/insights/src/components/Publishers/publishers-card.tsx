"use client";

import { Broadcast } from "@phosphor-icons/react/dist/ssr/Broadcast";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Card } from "@pythnetwork/component-library/Card";
import { Paginator } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { type RowConfig, Table } from "@pythnetwork/component-library/Table";
import { type ReactNode, Suspense, useMemo } from "react";
import { useFilter } from "react-aria";

import { useQueryParamFilterPagination } from "../../use-query-param-filter-pagination";

type Props = {
  className?: string | undefined;
  rankingLoadingSkeleton: ReactNode;
  nameLoadingSkeleton: ReactNode;
  scoreLoadingSkeleton: ReactNode;
  scoreWidth: number;
  publishers: Publisher[];
};

type Publisher = {
  id: string;
  nameAsString: string | undefined;
  name: ReactNode;
  ranking: ReactNode;
  activeFeeds: ReactNode;
  inactiveFeeds: ReactNode;
  medianScore: ReactNode;
};

export const PublishersCard = ({ publishers, ...props }: Props) => (
  <Suspense fallback={<PublishersCardContents isLoading {...props} />}>
    <ResolvedPublishersCard publishers={publishers} {...props} />
  </Suspense>
);

const ResolvedPublishersCard = ({ publishers, ...props }: Props) => {
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const {
    search,
    page,
    pageSize,
    updateSearch,
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
      (publisher.nameAsString !== undefined &&
        filter.contains(publisher.nameAsString, search)),
  );

  const rows = useMemo(
    () => paginatedItems.map(({ id, ...data }) => ({ id, href: "#", data })),
    [paginatedItems],
  );

  return (
    <PublishersCardContents
      numResults={numResults}
      search={search}
      numPages={numPages}
      page={page}
      pageSize={pageSize}
      onSearchChange={updateSearch}
      onPageSizeChange={updatePageSize}
      onPageChange={updatePage}
      mkPageLink={mkPageLink}
      rows={rows}
      {...props}
    />
  );
};

type PublishersCardContentsProps = Pick<
  Props,
  | "className"
  | "rankingLoadingSkeleton"
  | "nameLoadingSkeleton"
  | "scoreLoadingSkeleton"
  | "scoreWidth"
> &
  (
    | { isLoading: true }
    | {
        isLoading?: false;
        numResults: number;
        search: string;
        numPages: number;
        page: number;
        pageSize: number;
        onSearchChange: (newSearch: string) => void;
        onPageSizeChange: (newPageSize: number) => void;
        onPageChange: (newPage: number) => void;
        mkPageLink: (page: number) => string;
        rows: RowConfig<
          "ranking" | "name" | "activeFeeds" | "inactiveFeeds" | "medianScore"
        >[];
      }
  );

const PublishersCardContents = ({
  className,
  rankingLoadingSkeleton,
  nameLoadingSkeleton,
  scoreLoadingSkeleton,
  scoreWidth,
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
        width={40}
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
      columns={[
        {
          id: "ranking",
          name: "RANKING",
          width: 10,
          loadingSkeleton: rankingLoadingSkeleton,
        },
        {
          id: "name",
          name: "NAME / ID",
          isRowHeader: true,
          fill: true,
          alignment: "left",
          loadingSkeleton: nameLoadingSkeleton,
        },
        {
          id: "activeFeeds",
          name: "ACTIVE FEEDS",
          alignment: "center",
          width: 10,
        },
        {
          id: "inactiveFeeds",
          name: "INACTIVE FEEDS",
          alignment: "center",
          width: 10,
        },
        {
          id: "medianScore",
          name: "MEDIAN SCORE",
          alignment: "right",
          width: scoreWidth,
          loadingSkeleton: scoreLoadingSkeleton,
        },
      ]}
      {...(props.isLoading
        ? {
            isLoading: true,
          }
        : {
            rows: props.rows,
            renderEmptyState: () => <p>No results!</p>,
          })}
    />
  </Card>
);
