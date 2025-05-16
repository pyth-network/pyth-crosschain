"use client";

import { Warning } from "@phosphor-icons/react/dist/ssr/Warning";
import { EntityList } from "@pythnetwork/component-library/EntityList";
import { NoResults } from "@pythnetwork/component-library/NoResults";
import type { RowConfig } from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { StateType, useData } from "@pythnetwork/component-library/useData";
import { useDrawer } from "@pythnetwork/component-library/useDrawer";
import { ChainIcon } from "connectkit";
import type { ComponentProps } from "react";
import { Suspense, useMemo } from "react";
import { useFilter } from "react-aria";
import * as viemChains from "viem/chains";

import { mkRequestDrawer } from "./request-drawer";
import styles from "./results.module.scss";
import { useQuery } from "./use-query";
import { EntropyDeployments } from "../../entropy-deployments";
import { Status, getRequests } from "../../requests";
import { Address } from "../Address";
import { Status as StatusComponent } from "../Status";
import { Timestamp } from "../Timestamp";

export const Results = () => (
  <Suspense fallback={<ResultsImpl isLoading />}>
    <MountedResults />
  </Suspense>
);

const MountedResults = () => {
  const results = useData(["requests"], getRequests, {
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
          data={results.data}
          isUpdating={results.isValidating}
        />
      );
    }
  }
};

type ResolvedResultsProps = {
  data: Awaited<ReturnType<typeof getRequests>>;
  isUpdating?: boolean | undefined;
};

const ResolvedResults = ({ data, isUpdating }: ResolvedResultsProps) => {
  const drawer = useDrawer();
  const { search, chain, status } = useQuery();
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const rows = useMemo(
    () =>
      data
        .filter(
          (request) =>
            (status === null || status === request.status) &&
            (chain === null || chain === request.chain) &&
            (filter.contains(request.requestTxHash, search) ||
              (request.status !== Status.Pending &&
                filter.contains(request.callbackTxHash, search)) ||
              filter.contains(request.sender, search) ||
              filter.contains(request.sequenceNumber.toString(), search)),
        )
        .map((request) => ({
          id: request.sequenceNumber.toString(),
          textValue: request.requestTxHash,
          onAction: () => {
            drawer.open(mkRequestDrawer(request));
          },
          data: {
            chain: <Chain chain={request.chain} />,
            timestamp: (
              <div className={styles.timestamp}>
                <Timestamp timestamp={request.requestTimestamp} />
              </div>
            ),
            sequenceNumber: (
              <div className={styles.sequenceNumber}>
                {request.sequenceNumber}
              </div>
            ),
            sender: (
              <Address
                alwaysTruncate
                chain={request.chain}
                value={request.sender}
              />
            ),
            requestTxHash: (
              <Address
                alwaysTruncate
                chain={request.chain}
                value={request.requestTxHash}
              />
            ),
            callbackTxHash: request.status !== Status.Pending && (
              <Address
                alwaysTruncate
                chain={request.chain}
                value={request.callbackTxHash}
              />
            ),
            status: <StatusComponent status={request.status} />,
          },
        })),
    [data, search, drawer, filter, chain, status],
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
    <div className={styles.entityList}>
      {!props.isLoading && props.rows.length === 0 ? (
        <NoResults query={props.search} />
      ) : (
        <EntityList
          label={defaultProps.label}
          fields={[
            { id: "chain", name: "Chain" },
            { id: "sequenceNumber", name: "Sequence Number" },
            { id: "timestamp", name: "Timestamp" },
            { id: "sender", name: "Sender" },
            { id: "requestTxHash", name: "Request Transaction" },
            { id: "callbackTxHash", name: "Callback Transaction" },
            { id: "status", name: "Status" },
          ]}
          {...(props.isLoading ? { isLoading: true } : { rows: props.rows })}
        />
      )}
    </div>
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

const Chain = ({ chain }: { chain: keyof typeof EntropyDeployments }) => {
  // eslint-disable-next-line import/namespace
  const viemChain = viemChains[chain];
  return (
    <div className={styles.chain}>
      <ChainIcon id={viemChain.id} />
      {viemChain.name}
    </div>
  );
};

const defaultProps = {
  label: "Requests",
  rounded: true,
  fill: true,
  stickyHeader: "appHeader",
  columns: [
    {
      id: "chain" as const,
      name: "CHAIN",
      width: 32,
    },
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
      id: "sender" as const,
      name: "SENDER",
      width: 35,
    },
    {
      id: "requestTxHash" as const,
      name: "REQUEST TX",
      width: 35,
    },
    {
      id: "callbackTxHash" as const,
      name: "CALLBACK TX",
      width: 35,
    },
    {
      id: "status" as const,
      name: "CALLBACK STATUS",
      alignment: "center",
      width: 25,
    },
  ],
} satisfies Partial<ComponentProps<typeof Table<string>>>;
