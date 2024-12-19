"use client";

import { Card } from "@pythnetwork/component-library/Card";
import { Paginator } from "@pythnetwork/component-library/Paginator";
import { type RowConfig, Table } from "@pythnetwork/component-library/Table";
import { type ReactNode, Suspense, useMemo } from "react";
import { useFilter } from "react-aria";

import { useQueryParamFilterPagination } from "../../use-query-param-filter-pagination";

type Props = {
  className?: string | undefined;
  priceComponents: PriceComponent[];
  nameLoadingSkeleton: ReactNode;
  scoreLoadingSkeleton: ReactNode;
  scoreWidth: number;
  slug: string;
};

type PriceComponent = {
  id: string;
  publisherNameAsString: string | undefined;
  score: ReactNode;
  name: ReactNode;
  uptimeScore: ReactNode;
  deviationPenalty: ReactNode;
  deviationScore: ReactNode;
  stalledPenalty: ReactNode;
  stalledScore: ReactNode;
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
    priceComponents,
    (priceComponent, search) =>
      filter.contains(priceComponent.id, search) ||
      (priceComponent.publisherNameAsString !== undefined &&
        filter.contains(priceComponent.publisherNameAsString, search)),
    { defaultPageSize: 20 },
  );

  const rows = useMemo(
    () =>
      paginatedItems.map(({ id, ...data }) => ({
        id,
        href: `/price-feeds/${slug}/price-components/${id}`,
        data,
      })),
    [paginatedItems, slug],
  );

  return (
    <PriceComponentsCardContents
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

type PriceComponentsCardProps = Pick<
  Props,
  "className" | "nameLoadingSkeleton" | "scoreLoadingSkeleton" | "scoreWidth"
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
  scoreWidth,
  scoreLoadingSkeleton,
  nameLoadingSkeleton,
  ...props
}: PriceComponentsCardProps) => (
  <Card
    className={className}
    title="Price components"
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
          width: scoreWidth,
          loadingSkeleton: scoreLoadingSkeleton,
        },
        {
          id: "name",
          name: "NAME / ID",
          alignment: "left",
          isRowHeader: true,
          fill: true,
          loadingSkeleton: nameLoadingSkeleton,
        },
        {
          id: "uptimeScore",
          name: "UPTIME SCORE",
          alignment: "center",
          width: 25,
        },
        {
          id: "deviationScore",
          name: "DERIVATION SCORE",
          alignment: "center",
          width: 25,
        },
        {
          id: "deviationPenalty",
          name: "DERIVATION PENALTY",
          alignment: "center",
          width: 25,
        },
        {
          id: "stalledScore",
          name: "STALLED SCORE",
          alignment: "center",
          width: 25,
        },
        {
          id: "stalledPenalty",
          name: "STALLED PENALTY",
          alignment: "center",
          width: 25,
        },
      ]}
      {...(props.isLoading ? { isLoading: true } : { rows: props.rows })}
    />
  </Card>
);
