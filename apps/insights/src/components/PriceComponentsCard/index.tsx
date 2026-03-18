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
  ColumnConfig,
  RowConfig,
  SortDescriptor,
} from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import { useQueryParamFilterPagination } from "@pythnetwork/component-library/useQueryParamsPagination";
import {
  parseAsBoolean,
  parseAsStringEnum,
  useQueryState,
} from "@pythnetwork/react-hooks/nuqs";
import clsx from "clsx";
import type { ReactNode } from "react";
import { Fragment, Suspense, useCallback, useMemo } from "react";
import { useCollator, useFilter } from "react-aria";
import type { Cluster } from "../../services/pyth";
import type { StatusName, Status as StatusType } from "../../status";
import { STATUS_NAMES, statusNameToStatus } from "../../status";
import { Explain } from "../Explain";
import { EvaluationTime } from "../Explanations";
import { FormattedNumber } from "../FormattedNumber";
import { LiveComponentValue, LiveConfidence, LivePrice } from "../LivePrices";
import { usePriceComponentDrawer } from "../PriceComponentDrawer";
import { PriceName } from "../PriceName";
import { Score } from "../Score";
import { Status as StatusComponent } from "../Status";
import styles from "./index.module.scss";

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
    (items) => items,
    {
      defaultDescending: false,
      defaultPageSize: 50,
      defaultSort: "name",
    },
  );

  const rows = useMemo(
    () =>
      paginatedItems.map((component) => ({
        data: {
          name: component.name,
          ...Object.fromEntries(
            props.extraColumns?.map((column) => [
              column.id,
              component[column.id],
            ]) ?? [],
          ),
          confidence: (
            <LiveConfidence
              cluster={component.cluster}
              feedKey={component.feedKey}
              publisherKey={component.publisherKey}
            />
          ),
          deviationScore: component.deviationScore !== undefined && (
            <FormattedNumber
              maximumSignificantDigits={5}
              value={component.deviationScore}
            />
          ),
          price: (
            <LivePrice
              cluster={component.cluster}
              feedKey={component.feedKey}
              publisherKey={component.publisherKey}
            />
          ),
          score: component.score !== undefined && (
            <Score score={component.score} width={SCORE_WIDTH} />
          ),
          slot: (
            <LiveComponentValue
              cluster={component.cluster}
              feedKey={component.feedKey}
              field="publishSlot"
              publisherKey={component.publisherKey}
            />
          ),
          stalledScore: component.stalledScore !== undefined && (
            <FormattedNumber
              maximumSignificantDigits={5}
              value={component.stalledScore}
            />
          ),
          status: <StatusComponent status={component.status} />,
          uptimeScore: component.uptimeScore !== undefined && (
            <FormattedNumber
              maximumSignificantDigits={5}
              value={component.uptimeScore}
            />
          ),
        },
        id: component.id,
        nameAsString: component.nameAsString,
        onAction: () => {
          selectComponent(component);
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
      mkPageLink={mkPageLink}
      numPages={numPages}
      numResults={numResults}
      onPageChange={updatePage}
      onPageSizeChange={updatePageSize}
      onSearchChange={updateSearch}
      onSortChange={updateSortDescriptor}
      onStatusChange={updateStatus}
      page={page}
      pageSize={pageSize}
      rows={rows}
      search={search}
      setShowQuality={updateShowQuality}
      showQuality={showQuality}
      sortDescriptor={sortDescriptor}
      status={status}
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
          <Badge size="md" style="filled" variant="neutral">
            {!props.isLoading && props.numResults}
          </Badge>
        </>
      }
      toolbar={
        <div className={styles.toolbar}>
          {toolbarExtra && (
            <div className={styles.toolbarSection} data-section="extra">
              {toolbarExtra}
            </div>
          )}
          <div className={styles.toolbarSection} data-section="search">
            <Select<{ id: StatusName | "" }>
              hideLabel
              label="Status"
              options={[
                { id: "" },
                ...Object.values(STATUS_NAMES)
                  .toSorted((a, b) => collator.compare(a, b))
                  .map((id) => ({ id })),
              ]}
              size="sm"
              variant="outline"
              {...(props.isLoading
                ? { buttonLabel: "Status", isPending: true }
                : {
                    buttonLabel: props.status === "" ? "Status" : props.status,
                    onSelectionChange: props.onStatusChange,
                    placement: "bottom end",
                    selectedKey: props.status,
                    show: ({ id }) => (id === "" ? "All" : id),
                  })}
            />
            <SearchInput
              className={styles.searchInput ?? ""}
              placeholder={searchPlaceholder}
              size="sm"
              width={60}
              {...(props.isLoading
                ? { isDisabled: true, isPending: true }
                : {
                    onChange: props.onSearchChange,
                    value: props.search,
                  })}
            />
          </div>
          <div className={styles.toolbarSection} data-section="mode">
            <SingleToggleGroup
              className={styles.modeSelect ?? ""}
              {...(!props.isLoading && {
                onSelectionChange: (newValue) => {
                  props.setShowQuality(newValue === "quality");
                },
                selectedKey: props.showQuality ? "quality" : "prices",
              })}
              items={[
                {
                  children: <PriceName assetClass={props.assetClass} plural />,
                  id: "prices",
                },
                { children: "Quality", id: "quality" },
              ]}
            />
          </div>
        </div>
      }
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
          { id: "slot", name: "Slot" },
          { id: "price", name: "Price" },
          { id: "confidence", name: "Confidence" },
          { id: "uptimeScore", name: "Uptime Score" },
          { id: "deviationScore", name: "Deviation Score" },
          { id: "stalledScore", name: "Stalled Score" },
          { id: "score", name: "Final Score" },
          { id: "status", name: "Status" },
        ]}
        headerLoadingSkeleton={nameLoadingSkeleton}
        isLoading={props.isLoading}
        label={label}
        rows={
          props.isLoading
            ? []
            : props.rows.map((row) => ({
                ...row,
                header: (
                  <>
                    {row.data.name}
                    {extraColumns?.map((column) => (
                      <Fragment key={column.id}>{row.data[column.id]}</Fragment>
                    ))}
                  </>
                ),
                textValue: row.nameAsString,
              }))
        }
      />
      <Table
        className={styles.table ?? ""}
        columns={[
          {
            alignment: "left",
            allowsSorting: true,
            id: "name",
            isRowHeader: true,
            loadingSkeleton: nameLoadingSkeleton,
            name: "NAME / ID",
            ...(nameWidth !== undefined && { width: nameWidth }),
          },
          ...(extraColumns ?? []),
          ...otherColumns(props),
          {
            alignment: "right",
            allowsSorting: true,
            id: "status",
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
            width: 20,
          },
        ]}
        fill
        label={label}
        rounded
        stickyHeader="appHeader"
        {...(props.isLoading
          ? { isLoading: true }
          : {
              emptyState: (
                <NoResults
                  onClearSearch={() => {
                    props.onSearchChange("");
                    props.onStatusChange("");
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
            alignment: "center" as const,
            allowsSorting: true,
            id: "uptimeScore",
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
                    target="_blank"
                    variant="solid"
                  >
                    Read more
                  </Button>
                </Explain>
              </>
            ),
            width: 20,
          },
          {
            alignment: "center" as const,
            allowsSorting: true,
            id: "deviationScore",
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
                    target="_blank"
                    variant="solid"
                  >
                    Read more
                  </Button>
                </Explain>
              </>
            ),
            width: 20,
          },
          {
            alignment: "center" as const,
            allowsSorting: true,
            id: "stalledScore",
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
                    target="_blank"
                    variant="solid"
                  >
                    Read more
                  </Button>
                </Explain>
              </>
            ),
            width: 20,
          },
          {
            alignment: "left" as const,
            allowsSorting: true,
            id: "score",
            loadingSkeleton: <Score isLoading width={SCORE_WIDTH} />,
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
                    target="_blank"
                    variant="solid"
                  >
                    Read more
                  </Button>
                </Explain>
              </>
            ),
            width: SCORE_WIDTH,
          },
        ]
      : [
          { alignment: "left" as const, id: "slot", name: "SLOT", width: 40 },
          {
            alignment: "left" as const,
            id: "price",
            name: <PriceName assetClass={assetClass} uppercase />,
            width: 40,
          },
          {
            alignment: "left" as const,
            id: "confidence",
            name: "CONFIDENCE INTERVAL",
            width: 50,
          },
        ];
  }
};
