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
import { useQueryState, parseAsBoolean } from "nuqs";
import { type ReactNode, Suspense, useMemo, useCallback } from "react";
import { useFilter, useCollator } from "react-aria";

import styles from "./publishers-card.module.scss";
import { useQueryParamFilterPagination } from "../../use-query-param-filter-pagination";
import { FormattedNumber } from "../FormattedNumber";
import { NoResults } from "../NoResults";
import { PublisherTag } from "../PublisherTag";
import rootStyles from "../Root/index.module.scss";
import { Score } from "../Score";

const SCORE_WIDTH = 24;

type Props = {
  className?: string | undefined;
  priceComponents: PriceComponent[];
};

type PriceComponent = {
  id: string;
  score: number;
  uptimeScore: number;
  deviationPenalty: number | null;
  deviationScore: number;
  stalledPenalty: number;
  stalledScore: number;
  isTest: boolean;
} & (
  | { name: string; icon: ReactNode }
  | { name?: undefined; icon?: undefined }
);

export const PublishersCard = ({ priceComponents, ...props }: Props) => (
  <Suspense fallback={<PriceComponentsCardContents isLoading {...props} />}>
    <ResolvedPriceComponentsCard priceComponents={priceComponents} {...props} />
  </Suspense>
);

const ResolvedPriceComponentsCard = ({ priceComponents, ...props }: Props) => {
  const logger = useLogger();
  const [includeTestComponents, setIncludeTestComponents] = useQueryState(
    "includeTestComponents",
    parseAsBoolean.withDefault(false),
  );
  const collator = useCollator();
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const filteredPriceComponents = useMemo(
    () =>
      includeTestComponents
        ? priceComponents
        : priceComponents.filter((component) => !component.isTest),
    [includeTestComponents, priceComponents],
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
    filteredPriceComponents,
    (priceComponent, search) =>
      filter.contains(priceComponent.id, search) ||
      (priceComponent.name !== undefined &&
        filter.contains(priceComponent.name, search)),
    (a, b, { column, direction }) => {
      switch (column) {
        case "score":
        case "uptimeScore":
        case "deviationScore":
        case "stalledScore":
        case "stalledPenalty": {
          return (
            (direction === "descending" ? -1 : 1) * (a[column] - b[column])
          );
        }

        case "deviationPenalty": {
          if (a.deviationPenalty === null && b.deviationPenalty === null) {
            return 0;
          } else if (a.deviationPenalty === null) {
            return direction === "descending" ? 1 : -1;
          } else if (b.deviationPenalty === null) {
            return direction === "descending" ? -1 : 1;
          } else {
            return (
              (direction === "descending" ? -1 : 1) *
              (a.deviationPenalty - b.deviationPenalty)
            );
          }
        }

        case "name": {
          return (
            (direction === "descending" ? -1 : 1) *
            collator.compare(a.name ?? a.id, b.name ?? b.id)
          );
        }

        default: {
          return (direction === "descending" ? -1 : 1) * (a.score - b.score);
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
          score,
          uptimeScore,
          deviationPenalty,
          deviationScore,
          stalledPenalty,
          stalledScore,
          isTest,
          ...publisher
        }) => ({
          id,
          data: {
            score: <Score score={score} width={SCORE_WIDTH} />,
            name: (
              <div className={styles.publisherName}>
                <PublisherTag
                  publisherKey={id}
                  {...(publisher.name && {
                    name: publisher.name,
                    icon: publisher.icon,
                  })}
                />
                {isTest && (
                  <Badge variant="muted" style="filled" size="xs">
                    test
                  </Badge>
                )}
              </div>
            ),
            uptimeScore: (
              <FormattedNumber
                value={uptimeScore}
                maximumSignificantDigits={5}
              />
            ),
            deviationPenalty: deviationPenalty ? (
              <FormattedNumber
                value={deviationPenalty}
                maximumSignificantDigits={5}
              />
            ) : // eslint-disable-next-line unicorn/no-null
            null,
            deviationScore: (
              <FormattedNumber
                value={deviationScore}
                maximumSignificantDigits={5}
              />
            ),
            stalledPenalty: (
              <FormattedNumber
                value={stalledPenalty}
                maximumSignificantDigits={5}
              />
            ),
            stalledScore: (
              <FormattedNumber
                value={stalledScore}
                maximumSignificantDigits={5}
              />
            ),
          },
        }),
      ),
    [paginatedItems],
  );

  const updateIncludeTestComponents = useCallback(
    (newValue: boolean) => {
      setIncludeTestComponents(newValue).catch((error: unknown) => {
        logger.error(
          "Failed to update include test components query param",
          error,
        );
      });
    },
    [setIncludeTestComponents, logger],
  );

  return (
    <PriceComponentsCardContents
      numResults={numResults}
      search={search}
      sortDescriptor={sortDescriptor}
      numPages={numPages}
      page={page}
      pageSize={pageSize}
      includeTestComponents={includeTestComponents}
      onSearchChange={updateSearch}
      onSortChange={updateSortDescriptor}
      onPageSizeChange={updatePageSize}
      onPageChange={updatePage}
      mkPageLink={mkPageLink}
      onIncludeTestComponentsChange={updateIncludeTestComponents}
      rows={rows}
      {...props}
    />
  );
};

type PriceComponentsCardProps = Pick<Props, "className"> &
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
        includeTestComponents: boolean;
        onIncludeTestComponentsChange: (newValue: boolean) => void;
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
        >[];
      }
  );

const PriceComponentsCardContents = ({
  className,
  ...props
}: PriceComponentsCardProps) => (
  <Card
    className={className}
    title="Publishers"
    toolbar={
      <>
        <Switch
          {...(props.isLoading
            ? { isLoading: true }
            : {
                isSelected: props.includeTestComponents,
                onChange: props.onIncludeTestComponentsChange,
              })}
        >
          Show test components
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
        },
        {
          id: "uptimeScore",
          name: "UPTIME SCORE",
          alignment: "center",
          width: 35,
          allowsSorting: true,
        },
        {
          id: "deviationScore",
          name: "DEVIATION SCORE",
          alignment: "center",
          width: 35,
          allowsSorting: true,
        },
        {
          id: "deviationPenalty",
          name: "DEVIATION PENALTY",
          alignment: "center",
          width: 35,
          allowsSorting: true,
        },
        {
          id: "stalledScore",
          name: "STALLED SCORE",
          alignment: "center",
          width: 35,
          allowsSorting: true,
        },
        {
          id: "stalledPenalty",
          name: "STALLED PENALTY",
          alignment: "center",
          width: 35,
          allowsSorting: true,
        },
      ]}
      {...(props.isLoading
        ? { isLoading: true }
        : {
            rows: props.rows,
            sortDescriptor: props.sortDescriptor,
            onSortChange: props.onSortChange,
            renderEmptyState: () => (
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
