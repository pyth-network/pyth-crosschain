"use client";

import { Badge } from "@pythnetwork/component-library/Badge";
import { Button } from "@pythnetwork/component-library/Button";
import { Card } from "@pythnetwork/component-library/Card";
import { EntityList } from "@pythnetwork/component-library/EntityList";
import { NoResults } from "@pythnetwork/component-library/NoResults";
import { Paginator } from "@pythnetwork/component-library/Paginator";
import { SearchInput } from "@pythnetwork/component-library/SearchInput";
import { Select } from "@pythnetwork/component-library/Select";
import { SingleToggleGroup } from "@pythnetwork/component-library/SingleToggleGroup";
import type {
  RowConfig,
  ColumnConfig,
  SortDescriptor,
} from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import clsx from "clsx";
import { useQueryState, parseAsStringEnum, parseAsBoolean } from "nuqs";
import type { ReactNode } from "react";
import { Fragment, Suspense, useMemo, useCallback } from "react";
import { useFilter, useCollator } from "react-aria";

import styles from "./index.module.scss";
import { useQueryParamFilterPagination } from "../../hooks/use-query-param-filter-pagination";
import { Cluster } from "../../services/pyth";
import type { StatusName } from "../../status";
import {
  STATUS_NAMES,
  Status as StatusType,
  statusNameToStatus,
} from "../../status";
import { Explain } from "../Explain";
import { EvaluationTime } from "../Explanations";
import { FormattedNumber } from "../FormattedNumber";
import { LivePrice, LiveConfidence, LiveComponentValue } from "../LivePrices";
import { usePriceComponentDrawer } from "../PriceComponentDrawer";
import { PriceName } from "../PriceName";
import { Score } from "../Score";
import { Status as StatusComponent } from "../Status";

const SCORE_WIDTH = 32;

type Props<U extends string, T extends PriceComponent & Record<U, unknown>> = {
  className?: string | undefined;
  nameLoadingSkeleton: ReactNode;
  label: string;
  searchPlaceholder: string;
  toolbarExtra?: ReactNode;
  assetClass?: string | undefined;
  extraColumns?: ColumnConfig<U>[] | undefined;
  nameWidth?: number | undefined;
  identifiesPublisher?: boolean | undefined;
} & (
  | {
      isLoading: true;
    }
  | {
      isLoading?: false | undefined;
      priceComponents: T[];
      metricsTime?: Date | undefined;
    }
);

export type PriceComponent = {
  id: string;
  score: number | undefined;
  rank: number | undefined;
  symbol: string;
  displaySymbol: string;
  firstEvaluation?: Date | undefined;
  assetClass: string;
  uptimeScore: number | undefined;
  deviationScore: number | undefined;
  stalledScore: number | undefined;
  cluster: Cluster;
  status: StatusType;
  feedKey: string;
  publisherKey: string;
  name: ReactNode;
  nameAsString: string;
};

export const PriceComponentsCard = <
  U extends string,
  T extends PriceComponent & Record<U, unknown>,
>(
  props: Props<U, T>,
) => {
  if (props.isLoading) {
    return <PriceComponentsCardContents {...props} />;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isLoading, priceComponents, ...otherProps } = props;
    return (
      <Suspense
        fallback={<PriceComponentsCardContents isLoading {...otherProps} />}
      >
        <ResolvedPriceComponentsCard
          priceComponents={priceComponents}
          {...otherProps}
        />
      </Suspense>
    );
  }
};

export const ResolvedPriceComponentsCard = <
  U extends string,
  T extends PriceComponent & Record<U, unknown>,
>({
  priceComponents,
  identifiesPublisher,
  ...props
}: Omit<Props<U, T>, "isLoading"> & {
  priceComponents: T[];
  metricsTime?: Date | undefined;
}) => {
  const logger = useLogger();
  const collator = useCollator();
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const { selectComponent } = usePriceComponentDrawer({
    components: priceComponents,
    identifiesPublisher,
  });
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringEnum(["", ...Object.values(STATUS_NAMES)]).withDefault(""),
  );
  const [showQuality, setShowQuality] = useQueryState(
    "showQuality",
    parseAsBoolean.withDefault(false),
  );
  const statusType = useMemo(() => statusNameToStatus(status), [status]);
  const componentsFilteredByStatus = useMemo(
    () =>
      statusType === undefined
        ? priceComponents
        : priceComponents.filter(
            (component) => component.status === statusType,
          ),
    [statusType, priceComponents],
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
    componentsFilteredByStatus,
    (component, search) => filter.contains(component.nameAsString, search),
    (a, b, { column, direction }) => {
      switch (column) {
        case "score":
        case "uptimeScore":
        case "deviationScore":
        case "stalledScore": {
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
            collator.compare(a.nameAsString, b.nameAsString)
          );
        }

        case "status": {
          const resultByStatus = b.status - a.status;
          const result =
            resultByStatus === 0
              ? collator.compare(a.nameAsString, b.nameAsString)
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
      paginatedItems.map((component) => ({
        id: component.id,
        nameAsString: component.nameAsString,
        onAction: () => {
          selectComponent(component);
        },
        data: {
          name: component.name,
          ...Object.fromEntries(
            props.extraColumns?.map((column) => [
              column.id,
              component[column.id],
            ]) ?? [],
          ),
          score: component.score !== undefined && (
            <Score score={component.score} width={SCORE_WIDTH} />
          ),
          uptimeScore: component.uptimeScore !== undefined && (
            <FormattedNumber
              value={component.uptimeScore}
              maximumSignificantDigits={5}
            />
          ),
          deviationScore: component.deviationScore !== undefined && (
            <FormattedNumber
              value={component.deviationScore}
              maximumSignificantDigits={5}
            />
          ),
          stalledScore: component.stalledScore !== undefined && (
            <FormattedNumber
              value={component.stalledScore}
              maximumSignificantDigits={5}
            />
          ),
          slot: (
            <LiveComponentValue
              feedKey={component.feedKey}
              publisherKey={component.publisherKey}
              field="publishSlot"
              cluster={component.cluster}
            />
          ),
          price: (
            <LivePrice
              feedKey={component.feedKey}
              publisherKey={component.publisherKey}
              cluster={component.cluster}
            />
          ),
          confidence: (
            <LiveConfidence
              feedKey={component.feedKey}
              publisherKey={component.publisherKey}
              cluster={component.cluster}
            />
          ),
          status: <StatusComponent status={component.status} />,
        },
      })),
    [paginatedItems, props.extraColumns, selectComponent],
  );

  const updateStatus = useCallback(
    (newStatus: StatusName | "") => {
      updatePage(1);
      setStatus(newStatus).catch((error: unknown) => {
        logger.error("Failed to update status", error);
      });
    },
    [updatePage, setStatus, logger],
  );

  const updateShowQuality = useCallback(
    (newValue: boolean) => {
      setShowQuality(newValue).catch((error: unknown) => {
        logger.error("Failed to update show quality", error);
      });
    },
    [setShowQuality, logger],
  );

  return (
    <PriceComponentsCardContents
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
      status={status}
      onStatusChange={updateStatus}
      showQuality={showQuality}
      setShowQuality={updateShowQuality}
      {...props}
    />
  );
};

type PriceComponentsCardProps<
  U extends string,
  T extends PriceComponent & Record<U, unknown>,
> = Pick<
  Props<U, T>,
  | "className"
  | "nameLoadingSkeleton"
  | "label"
  | "searchPlaceholder"
  | "toolbarExtra"
  | "assetClass"
  | "extraColumns"
  | "nameWidth"
> &
  (
    | { isLoading: true }
    | {
        isLoading?: false;
        metricsTime?: Date | undefined;
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
        status: StatusName | "";
        onStatusChange: (newStatus: StatusName | "") => void;
        showQuality: boolean;
        setShowQuality: (newValue: boolean) => void;
        rows: (RowConfig<string> & { nameAsString: string })[];
      }
  );

export const PriceComponentsCardContents = <
  U extends string,
  T extends PriceComponent & Record<U, unknown>,
>({
  className,
  nameLoadingSkeleton,
  label,
  searchPlaceholder,
  toolbarExtra,
  extraColumns,
  nameWidth,
  ...props
}: PriceComponentsCardProps<U, T>) => {
  const collator = useCollator();
  return (
    <Card
      className={clsx(className, styles.priceComponentsCard)}
      title={
        <>
          <span>{label}</span>
          <Badge style="filled" variant="neutral" size="md">
            {!props.isLoading && props.numResults}
          </Badge>
        </>
      }
      toolbar={
        <div className={styles.toolbar}>
          {toolbarExtra && (
            <div data-section="extra" className={styles.toolbarSection}>
              {toolbarExtra}
            </div>
          )}
          <div data-section="search" className={styles.toolbarSection}>
            <Select<{ id: StatusName | "" }>
              label="Status"
              size="sm"
              variant="outline"
              hideLabel
              options={[
                { id: "" },
                ...Object.values(STATUS_NAMES)
                  .toSorted((a, b) => collator.compare(a, b))
                  .map((id) => ({ id })),
              ]}
              {...(props.isLoading
                ? { isPending: true, buttonLabel: "Status" }
                : {
                    show: ({ id }) => (id === "" ? "All" : id),
                    placement: "bottom end",
                    buttonLabel: props.status === "" ? "Status" : props.status,
                    selectedKey: props.status,
                    onSelectionChange: props.onStatusChange,
                  })}
            />
            <SearchInput
              size="sm"
              width={60}
              placeholder={searchPlaceholder}
              className={styles.searchInput ?? ""}
              {...(props.isLoading
                ? { isPending: true, isDisabled: true }
                : {
                    value: props.search,
                    onChange: props.onSearchChange,
                  })}
            />
          </div>
          <div data-section="mode" className={styles.toolbarSection}>
            <SingleToggleGroup
              className={styles.modeSelect ?? ""}
              {...(!props.isLoading && {
                selectedKey: props.showQuality ? "quality" : "prices",
                onSelectionChange: (newValue) => {
                  props.setShowQuality(newValue === "quality");
                },
              })}
              items={[
                {
                  id: "prices",
                  children: <PriceName assetClass={props.assetClass} plural />,
                },
                { id: "quality", children: "Quality" },
              ]}
            />
          </div>
        </div>
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
      <EntityList
        label={label}
        className={styles.entityList ?? ""}
        headerLoadingSkeleton={nameLoadingSkeleton}
        fields={[
          { id: "slot", name: "Slot" },
          { id: "price", name: "Price" },
          { id: "confidence", name: "Confidence" },
          { id: "uptimeScore", name: "Uptime Score" },
          { id: "deviationScore", name: "Deviation Score" },
          { id: "stalledScore", name: "Stalled Score" },
          { id: "score", name: "Final Score" },
          { id: "status", name: "Status" },
        ]}
        isLoading={props.isLoading}
        rows={
          props.isLoading
            ? []
            : props.rows.map((row) => ({
                ...row,
                textValue: row.nameAsString,
                header: (
                  <>
                    {row.data.name}
                    {extraColumns?.map((column) => (
                      <Fragment key={column.id}>{row.data[column.id]}</Fragment>
                    ))}
                  </>
                ),
              }))
        }
      />
      <Table
        label={label}
        fill
        rounded
        stickyHeader="appHeader"
        className={styles.table ?? ""}
        columns={[
          {
            id: "name",
            name: "NAME / ID",
            alignment: "left",
            isRowHeader: true,
            loadingSkeleton: nameLoadingSkeleton,
            allowsSorting: true,
            ...(nameWidth !== undefined && { width: nameWidth }),
          },
          ...(extraColumns ?? []),
          ...otherColumns(props),
          {
            id: "status",
            width: 20,
            name: (
              <>
                STATUS
                <Explain size="xs" title="Status">
                  A publisher{"'"}s feed have one of the following statuses:
                  <ul>
                    <li>
                      <b>Active</b> feeds have better than 50% uptime over the
                      last day
                    </li>
                    <li>
                      <b>Inactive</b> feeds have worse than 50% uptime over the
                      last day
                    </li>
                    <li>
                      <b>Unranked</b> feeds have not yet been evaluated by Pyth
                    </li>
                  </ul>
                  {!props.isLoading && props.metricsTime && (
                    <EvaluationTime scoreTime={props.metricsTime} />
                  )}
                </Explain>
              </>
            ),
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
                    props.onStatusChange("");
                  }}
                />
              ),
            })}
      />
    </Card>
  );
};

const otherColumns = ({
  metricsTime,
  assetClass,
  ...props
}: { metricsTime?: Date | undefined; assetClass?: string | undefined } & (
  | { isLoading: true }
  | { isLoading?: false; showQuality: boolean }
)) => {
  if (props.isLoading) {
    return [];
  } else {
    return props.showQuality
      ? [
          {
            id: "uptimeScore",
            width: 20,
            name: (
              <>
                UPTIME SCORE
                <Explain size="xs" title="Uptime">
                  <p>
                    Uptime is the percentage of time that a publisher{"'"}s feed
                    is available and active.
                  </p>
                  {metricsTime && <EvaluationTime scoreTime={metricsTime} />}
                  <Button
                    href="https://docs.pyth.network/home/oracle-integrity-staking/publisher-quality-ranking#uptime-1"
                    size="xs"
                    variant="solid"
                    target="_blank"
                  >
                    Read more
                  </Button>
                </Explain>
              </>
            ),
            alignment: "center" as const,
            allowsSorting: true,
          },
          {
            id: "deviationScore",
            width: 20,
            name: (
              <>
                DEVIATION SCORE
                <Explain size="xs" title="Deviation">
                  <p>
                    Deviation measures how close a publisher{"'"}s quote is to
                    what Pyth believes to be the true market quote.
                  </p>
                  <p>
                    Note that publishers must have an uptime of at least 50% to
                    be ranked. If a publisher{"'"}s uptime is less than 50%,
                    then the deviation and the stalled score of the publisher
                    will be 0 to reflect their ineligibility.
                  </p>
                  {metricsTime && <EvaluationTime scoreTime={metricsTime} />}
                  <Button
                    href="https://docs.pyth.network/home/oracle-integrity-staking/publisher-quality-ranking#price-deviation-1"
                    size="xs"
                    variant="solid"
                    target="_blank"
                  >
                    Read more
                  </Button>
                </Explain>
              </>
            ),
            alignment: "center" as const,
            allowsSorting: true,
          },
          {
            id: "stalledScore",
            width: 20,
            name: (
              <>
                STALLED SCORE
                <Explain size="xs" title="Stalled">
                  <p>
                    A feed is considered stalled if it is publishing the same
                    value repeatedly for the quote. This score component is
                    reduced each time a feed is stalled.
                  </p>
                  <p>
                    Note that publishers must have an uptime of at least 50% to
                    be ranked. If a publisher{"'"}s uptime is less than 50%,
                    then the deviation and the stalled score of the publisher
                    will be 0 to reflect their ineligibility.
                  </p>
                  {metricsTime && <EvaluationTime scoreTime={metricsTime} />}
                  <Button
                    href="https://docs.pyth.network/home/oracle-integrity-staking/publisher-quality-ranking#lack-of-stalled-prices-1"
                    size="xs"
                    variant="solid"
                    target="_blank"
                  >
                    Read more
                  </Button>
                </Explain>
              </>
            ),
            alignment: "center" as const,
            allowsSorting: true,
          },
          {
            id: "score",
            name: (
              <>
                FINAL SCORE
                <Explain size="xs" title="Uptime">
                  The final score is calculated by combining the three score
                  components as follows:
                  <ul>
                    <li>
                      <b>Uptime Score</b> (40% weight)
                    </li>
                    <li>
                      <b>Deviation Score</b> (40% weight)
                    </li>
                    <li>
                      <b>Stalled Score</b> (20% weight)
                    </li>
                  </ul>
                  {metricsTime && <EvaluationTime scoreTime={metricsTime} />}
                  <Button
                    href="https://docs.pyth.network/home/oracle-integrity-staking/publisher-quality-ranking"
                    size="xs"
                    variant="solid"
                    target="_blank"
                  >
                    Read more
                  </Button>
                </Explain>
              </>
            ),
            alignment: "left" as const,
            width: SCORE_WIDTH,
            loadingSkeleton: <Score isLoading width={SCORE_WIDTH} />,
            allowsSorting: true,
          },
        ]
      : [
          { id: "slot", name: "SLOT", alignment: "left" as const, width: 40 },
          {
            id: "price",
            name: <PriceName assetClass={assetClass} uppercase />,
            alignment: "left" as const,
            width: 40,
          },
          {
            id: "confidence",
            name: "CONFIDENCE INTERVAL",
            alignment: "left" as const,
            width: 50,
          },
        ];
  }
};
