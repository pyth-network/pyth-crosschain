"use client";

import { Card } from "@pythnetwork/component-library/Card";
import { Paginator } from "@pythnetwork/component-library/Paginator";
import { Switch } from "@pythnetwork/component-library/Switch";
import {
  type RowConfig,
  type SortDescriptor,
  Table,
} from "@pythnetwork/component-library/Table";
import { type ReactNode, Suspense, useMemo, useState } from "react";
import { useFilter, useCollator } from "react-aria";

import { useQueryParamFilterPagination } from "../../use-query-param-filter-pagination";
import { FormattedNumber } from "../FormattedNumber";
import { Score } from "../Score";

const PUBLISHER_SCORE_WIDTH = 24;

type Props = {
  className?: string | undefined;
  priceComponents: PriceComponent[];
  nameLoadingSkeleton: ReactNode;
  slug: string;
};

type PriceComponent = {
  id: string;
  publisherNameAsString: string | undefined;
  score: number;
  name: ReactNode;
  uptimeScore: number;
  deviationPenalty: number | null;
  deviationScore: number;
  stalledPenalty: number;
  stalledScore: number;
  isTest: boolean;
};

export const PriceComponentsCard = ({
  priceComponents,
  slug,
  ...props
}: Props) => (
  <Suspense fallback={<PriceComponentsCardContents isLoading {...props} />}>
    <ResolvedPriceComponentsCard
      priceComponents={priceComponents}
      slug={slug}
      {...props}
    />
  </Suspense>
);

const ResolvedPriceComponentsCard = ({
  priceComponents,
  slug,
  ...props
}: Props) => {
  const collator = useCollator();
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const [includeTestComponents, setIncludeTestComponents] = useState(false);

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
      (priceComponent.publisherNameAsString !== undefined &&
        filter.contains(priceComponent.publisherNameAsString, search)),
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
            collator.compare(
              a.publisherNameAsString ?? a.id,
              b.publisherNameAsString ?? b.id,
            )
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
          ...data
        }) => ({
          id,
          href: `/price-feeds/${slug}/price-components/${id}`,
          data: {
            ...data,
            score: <Score score={score} width={PUBLISHER_SCORE_WIDTH} />,
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
    [paginatedItems, slug],
  );

  return (
    <PriceComponentsCardContents
      includeTestComponents={includeTestComponents}
      setIncludeTestComponents={setIncludeTestComponents}
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

type PriceComponentsCardProps = Pick<
  Props,
  "className" | "nameLoadingSkeleton"
> &
  (
    | { isLoading: true }
    | {
        isLoading?: false;
        includeTestComponents: boolean;
        setIncludeTestComponents: (newValue: boolean) => void;
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
        >[];
      }
  );

const PriceComponentsCardContents = ({
  className,
  nameLoadingSkeleton,
  ...props
}: PriceComponentsCardProps) => (
  <Card
    className={className}
    title="Price components"
    toolbar={
      <Switch
        {...(props.isLoading
          ? { isPending: true }
          : {
              isSelected: props.includeTestComponents,
              onChange: props.setIncludeTestComponents,
            })}
      >
        Show test components
      </Switch>
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
      label="Price components"
      fill
      rounded
      columns={[
        {
          id: "score",
          name: "SCORE",
          alignment: "center",
          width: PUBLISHER_SCORE_WIDTH,
          loadingSkeleton: <Score isLoading width={PUBLISHER_SCORE_WIDTH} />,
          allowsSorting: true,
        },
        {
          id: "name",
          name: "NAME / ID",
          alignment: "left",
          isRowHeader: true,
          loadingSkeleton: nameLoadingSkeleton,
          allowsSorting: true,
        },
        {
          id: "uptimeScore",
          name: "UPTIME SCORE",
          alignment: "center",
          width: 40,
          allowsSorting: true,
        },
        {
          id: "deviationScore",
          name: "DEVIATION SCORE",
          alignment: "center",
          width: 40,
          allowsSorting: true,
        },
        {
          id: "deviationPenalty",
          name: "DEVIATION PENALTY",
          alignment: "center",
          width: 40,
          allowsSorting: true,
        },
        {
          id: "stalledScore",
          name: "STALLED SCORE",
          alignment: "center",
          width: 40,
          allowsSorting: true,
        },
        {
          id: "stalledPenalty",
          name: "STALLED PENALTY",
          alignment: "center",
          width: 40,
          allowsSorting: true,
        },
      ]}
      {...(props.isLoading
        ? { isLoading: true }
        : {
            rows: props.rows,
            sortDescriptor: props.sortDescriptor,
            onSortChange: props.onSortChange,
          })}
    />
  </Card>
);
