"use client";

import { Broadcast } from "@phosphor-icons/react/dist/ssr/Broadcast";
import { useLogger } from "@pythnetwork/app-logger";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Card } from "@pythnetwork/component-library/Card";
import { Paginator } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { type RowConfig, Table } from "@pythnetwork/component-library/Table";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import {
  parseAsString,
  parseAsInteger,
  useQueryStates,
  createSerializer,
} from "nuqs";
import {
  type ReactNode,
  type CSSProperties,
  Suspense,
  useCallback,
  useMemo,
} from "react";
import { useFilter } from "react-aria";
import { Meter } from "react-aria-components";

import styles from "./publishers-card.module.scss";

const PUBLISHER_SCORE_WIDTH = 24;

type Props = {
  className?: string | undefined;
  rankingLoadingSkeleton: ReactNode;
  nameLoadingSkeleton: ReactNode;
  publishers: Publisher[];
};

type Publisher = {
  id: string;
  nameAsString: string | undefined;
  name: ReactNode;
  ranking: ReactNode;
  activeFeeds: ReactNode;
  inactiveFeeds: ReactNode;
  medianScore: number;
};

export const PublishersCard = ({ publishers, ...props }: Props) => (
  <Suspense fallback={<PublishersCardContents isLoading {...props} />}>
    <ResolvedPublishersCard publishers={publishers} {...props} />
  </Suspense>
);

const ResolvedPublishersCard = ({ publishers, ...props }: Props) => {
  const logger = useLogger();

  const [{ search, page, pageSize }, setQuery] = useQueryStates(queryParams);

  const updateQuery = useCallback(
    (...params: Parameters<typeof setQuery>) => {
      setQuery(...params).catch((error: unknown) => {
        logger.error("Failed to update query", error);
      });
    },
    [setQuery, logger],
  );

  const updateSearch = useCallback(
    (newSearch: string) => {
      updateQuery({ page: 1, search: newSearch });
    },
    [updateQuery],
  );

  const updatePage = useCallback(
    (newPage: number) => {
      updateQuery({ page: newPage });
    },
    [updateQuery],
  );

  const updatePageSize = useCallback(
    (newPageSize: number) => {
      updateQuery({ page: 1, pageSize: newPageSize });
    },
    [updateQuery],
  );

  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const filteredPublishers = useMemo(
    () =>
      search === ""
        ? publishers
        : publishers.filter(
            (publisher) =>
              filter.contains(publisher.id, search) ||
              (publisher.nameAsString !== undefined &&
                filter.contains(publisher.nameAsString, search)),
          ),
    [publishers, search, filter],
  );
  const paginatedPublishers = useMemo(
    () => filteredPublishers.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, filteredPublishers],
  );

  const numPages = useMemo(
    () => Math.ceil(filteredPublishers.length / pageSize),
    [filteredPublishers.length, pageSize],
  );

  const pathname = usePathname();

  const mkPageLink = useCallback(
    (page: number) => {
      const serialize = createSerializer(queryParams);
      return `${pathname}${serialize({ page, pageSize })}`;
    },
    [pathname, pageSize],
  );

  const rows = useMemo(
    () =>
      paginatedPublishers.map(({ id, medianScore, ...data }) => ({
        id,
        href: "#",
        data: {
          ...data,
          medianScore: <PublisherScore>{medianScore}</PublisherScore>,
        },
      })),
    [paginatedPublishers],
  );

  return (
    <PublishersCardContents
      numResults={filteredPublishers.length}
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

const queryParams = {
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(30),
  search: parseAsString.withDefault(""),
};

type PublishersCardContentsProps = Pick<
  Props,
  "className" | "rankingLoadingSkeleton" | "nameLoadingSkeleton"
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
  ...props
}: PublishersCardContentsProps) => (
  <Card
    className={clsx(styles.publishersCard, className)}
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
              defaultValue: props.search,
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
          width: PUBLISHER_SCORE_WIDTH,
          alignment: "center",
          loadingSkeleton: (
            <Skeleton
              className={styles.publisherScore}
              fill
              style={{ "--width": PUBLISHER_SCORE_WIDTH } as CSSProperties}
            />
          ),
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

type PublisherScoreProps = {
  children: number;
};

const PublisherScore = ({ children }: PublisherScoreProps) => (
  <Meter
    value={children}
    maxValue={1}
    style={{ "--width": PUBLISHER_SCORE_WIDTH } as CSSProperties}
  >
    {({ percentage }) => (
      <div
        className={styles.publisherScore}
        data-size-class={getSizeClass(percentage)}
      >
        <div
          className={styles.fill}
          style={{ width: `${(50 + percentage / 2).toString()}%` }}
        >
          {children.toFixed(2)}
        </div>
      </div>
    )}
  </Meter>
);

const getSizeClass = (percentage: number) => {
  if (percentage < 60) {
    return "bad";
  } else if (percentage < 70) {
    return "weak";
  } else if (percentage < 80) {
    return "warn";
  } else if (percentage < 90) {
    return "ok";
  } else {
    return "good";
  }
};
