"use client";

import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { Warning } from "@phosphor-icons/react/dist/ssr/Warning";
import { Badge } from "@pythnetwork/component-library/Badge";
import { CopyButton } from "@pythnetwork/component-library/CopyButton";
import { EntityList } from "@pythnetwork/component-library/EntityList";
import { Link } from "@pythnetwork/component-library/Link";
import { Meter } from "@pythnetwork/component-library/Meter";
import { NoResults } from "@pythnetwork/component-library/NoResults";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import { Status as StatusImpl } from "@pythnetwork/component-library/Status";
import type { RowConfig } from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { StateType, useData } from "@pythnetwork/component-library/useData";
import { useDrawer } from "@pythnetwork/component-library/useDrawer";
import type { ComponentProps } from "react";
import { Suspense, useMemo, useCallback } from "react";
import { useDateFormatter, useFilter, useNumberFormatter } from "react-aria";

import { ChainSelect } from "./chain-select";
import styles from "./results.module.scss";
import { useQuery } from "./use-query";
import { EntropyDeployments } from "../../entropy-deployments";
import { getRequestsForChain } from "../../get-requests-for-chain";

export const Results = () => (
  <Suspense fallback={<ResultsImpl isLoading />}>
    <MountedResults />
  </Suspense>
);

const MountedResults = () => {
  const { chain } = useQuery();

  return chain ? (
    <ResultsForChain chain={chain} />
  ) : (
    <Empty
      icon={<Sparkle />}
      header={<ChainSelect variant="primary" size="sm" placement="bottom" />}
      body="Select a chain to list and search for Entropy requests"
      variant="info"
    />
  );
};

const ResultsForChain = ({
  chain,
}: {
  chain: keyof typeof EntropyDeployments;
}) => {
  const getTxData = useCallback(() => getRequestsForChain(chain), [chain]);
  const results = useData(["requests", chain], getTxData, {
    refreshInterval: 0,
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  switch (results.type) {
    case StateType.Error: {
      return (
        <Empty
          icon={<Warning />}
          header="Uh oh, we hit an error"
          body={results.error.message}
          variant="error"
        />
      );
    }
    case StateType.NotLoaded:
    case StateType.Loading: {
      return <ResultsImpl isLoading />;
    }
    case StateType.Loaded: {
      return (
        <ResolvedResults
          chain={chain}
          data={results.data}
          isUpdating={results.isValidating}
        />
      );
    }
  }
};

type ResolvedResultsProps = {
  chain: keyof typeof EntropyDeployments;
  data: Awaited<ReturnType<typeof getRequestsForChain>>;
  isUpdating?: boolean | undefined;
};

const ResolvedResults = ({ chain, data, isUpdating }: ResolvedResultsProps) => {
  const drawer = useDrawer();
  const { search } = useQuery();
  const gasFormatter = useNumberFormatter({ maximumFractionDigits: 3 });
  const dateFormatter = useDateFormatter({
    dateStyle: "long",
    timeStyle: "long",
  });
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const rows = useMemo(
    () =>
      data
        .filter(
          (request) =>
            filter.contains(request.txHash, search) ||
            filter.contains(request.provider, search) ||
            filter.contains(request.caller, search) ||
            filter.contains(request.sequenceNumber.toString(), search),
        )
        .map((request) => ({
          id: request.sequenceNumber.toString(),
          textValue: request.txHash,
          onAction: () => {
            drawer.open({
              title: `Request ${truncate(request.txHash)}`,
              headingExtra: <Status request={request} />,
              className: styles.requestDrawer ?? "",
              fill: true,
              contents: (
                <>
                  <div className={styles.cards}>
                    <StatCard
                      nonInteractive
                      header="Result"
                      small
                      variant="primary"
                      stat={
                        request.hasCallbackCompleted ? (
                          <code>{request.callbackResult.randomNumber}</code>
                        ) : (
                          <Status request={request} />
                        )
                      }
                    />
                    <StatCard
                      nonInteractive
                      header="Sequence Number"
                      small
                      stat={request.sequenceNumber}
                    />
                  </div>
                  <Table
                    label="Details"
                    fill
                    className={styles.details ?? ""}
                    stickyHeader
                    columns={[
                      {
                        id: "field",
                        name: "Field",
                        alignment: "left",
                        isRowHeader: true,
                        sticky: true,
                      },
                      {
                        id: "value",
                        name: "Value",
                        fill: true,
                        alignment: "left",
                      },
                    ]}
                    rows={[
                      {
                        field: "Request Timestamp",
                        value: dateFormatter.format(request.timestamp),
                      },
                      ...(request.hasCallbackCompleted
                        ? [
                            {
                              field: "Result Timestamp",
                              value: dateFormatter.format(
                                request.callbackResult.timestamp,
                              ),
                            },
                          ]
                        : []),
                      {
                        field: "Transaction Hash",
                        value: <Address chain={chain} value={request.txHash} />,
                      },
                      {
                        field: "Caller",
                        value: <Address chain={chain} value={request.caller} />,
                      },
                      {
                        field: "Provider",
                        value: (
                          <Address chain={chain} value={request.provider} />
                        ),
                      },
                      {
                        field: "Gas",
                        value: request.hasCallbackCompleted ? (
                          <Meter
                            label="Gas"
                            value={request.callbackResult.gasUsed}
                            maxValue={request.gasLimit}
                            startLabel={
                              <>
                                {gasFormatter.format(
                                  request.callbackResult.gasUsed,
                                )}{" "}
                                used
                              </>
                            }
                            endLabel={
                              <>{gasFormatter.format(request.gasLimit)} max</>
                            }
                            labelClassName={styles.gasMeterLabel ?? ""}
                            variant={
                              request.callbackResult.gasUsed > request.gasLimit
                                ? "error"
                                : "default"
                            }
                          />
                        ) : (
                          <>{gasFormatter.format(request.gasLimit)} max</>
                        ),
                      },
                    ].map((data) => ({
                      id: data.field,
                      data: {
                        field: (
                          <span className={styles.field}>{data.field}</span>
                        ),
                        value: data.value,
                      },
                    }))}
                  />
                </>
              ),
            });
          },
          data: {
            timestamp: (
              <div className={styles.timestamp}>
                {dateFormatter.format(request.timestamp)}
              </div>
            ),
            sequenceNumber: (
              <Badge size="md" variant="info" style="outline">
                {request.sequenceNumber}
              </Badge>
            ),
            caller: (
              <Address alwaysTruncate chain={chain} value={request.caller} />
            ),
            provider: (
              <Address alwaysTruncate chain={chain} value={request.provider} />
            ),
            txHash: (
              <Address alwaysTruncate chain={chain} value={request.txHash} />
            ),
            status: <Status request={request} />,
          },
        })),
    [data, search, chain, dateFormatter, drawer, filter, gasFormatter],
  );

  return <ResultsImpl rows={rows} isUpdating={isUpdating} search={search} />;
};

type ResultsImplProps =
  | {
      isLoading: true;
    }
  | {
      isLoading?: false | undefined;
      rows: (RowConfig<(typeof defaultProps)["columns"][number]["id"]> & {
        textValue: string;
      })[];
      isUpdating?: boolean | undefined;
      search: string;
    };

const ResultsImpl = (props: ResultsImplProps) => (
  <>
    <EntityList
      label={defaultProps.label}
      className={styles.entityList ?? ""}
      fields={[
        { id: "sequenceNumber", name: "Sequence Number" },
        { id: "timestamp", name: "Timestamp" },
        { id: "txHash", name: "Transaction Hash" },
        { id: "provider", name: "Provider" },
        { id: "caller", name: "Caller" },
        { id: "status", name: "Status" },
      ]}
      {...(props.isLoading ? { isLoading: true } : { rows: props.rows })}
    />
    <Table
      className={styles.table ?? ""}
      {...defaultProps}
      {...(props.isLoading
        ? { isLoading: true }
        : {
            rows: props.rows,
            isUpdating: props.isUpdating,
            emptyState: <NoResults query={props.search} />,
            className: styles.table ?? "",
          })}
    />
  </>
);

const Empty = (props: ComponentProps<typeof NoResults>) => (
  <>
    <NoResults className={styles.entityList} {...props} />
    <Table
      className={styles.table ?? ""}
      rows={[]}
      emptyState={<NoResults {...props} />}
      {...defaultProps}
    />
  </>
);

const Address = ({
  value,
  chain,
  alwaysTruncate,
}: {
  value: string;
  chain: keyof typeof EntropyDeployments;
  alwaysTruncate?: boolean | undefined;
}) => {
  const { explorer } = EntropyDeployments[chain];
  const truncatedValue = useMemo(() => truncate(value), [value]);
  return (
    <div
      data-always-truncate={alwaysTruncate ? "" : undefined}
      className={styles.address}
    >
      <Link
        href={explorer.replace("$ADDRESS", value)}
        target="_blank"
        rel="noreferrer"
      >
        <code className={styles.truncated}>{truncatedValue}</code>
        <code className={styles.full}>{value}</code>
      </Link>
      <CopyButton text={value} />
    </div>
  );
};

const Status = ({
  request,
}: {
  request: Awaited<ReturnType<typeof getRequestsForChain>>[number];
}) => {
  switch (getStatus(request)) {
    case "error": {
      return <StatusImpl variant="error">FAILED</StatusImpl>;
    }
    case "success": {
      return <StatusImpl variant="success">SUCCESS</StatusImpl>;
    }
    case "pending": {
      return (
        <StatusImpl variant="disabled" style="outline">
          PENDING
        </StatusImpl>
      );
    }
  }
};

const defaultProps = {
  label: "Requests",
  rounded: true,
  fill: true,
  columns: [
    {
      id: "sequenceNumber" as const,
      name: "SEQUENCE NUMBER",
      alignment: "center",
      width: 20,
    },
    {
      id: "timestamp" as const,
      name: "TIMESTAMP",
    },
    {
      id: "txHash" as const,
      name: "TRANSACTION HASH",
      width: 30,
    },
    {
      id: "provider" as const,
      name: "PROVIDER",
      width: 30,
    },
    {
      id: "caller" as const,
      name: "CALLER",
      width: 30,
    },
    {
      id: "status" as const,
      name: "STATUS",
      alignment: "center",
      width: 25,
    },
  ],
} satisfies Partial<ComponentProps<typeof Table<string>>>;

const truncate = (value: string) => `${value.slice(0, 6)}...${value.slice(-4)}`;

const getStatus = (
  request: Awaited<ReturnType<typeof getRequestsForChain>>[number],
) => {
  if (request.hasCallbackCompleted) {
    return request.callbackResult.failed ? "error" : "success";
  } else {
    return "pending";
  }
};
