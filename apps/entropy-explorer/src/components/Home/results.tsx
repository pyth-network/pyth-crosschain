"use client";

import { Warning } from "@phosphor-icons/react/dist/ssr/Warning";
import { Badge } from "@pythnetwork/component-library/Badge";
import { EntityList } from "@pythnetwork/component-library/EntityList";
import { NoResults } from "@pythnetwork/component-library/NoResults";
import type { RowConfig } from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { StateType, useData } from "@pythnetwork/component-library/useData";
import { useDrawer } from "@pythnetwork/component-library/useDrawer";
import { ChainIcon } from "connectkit";
import type { ComponentProps } from "react";
import { Suspense, useMemo } from "react";
import { useDateFormatter, useFilter } from "react-aria";
import * as viemChains from "viem/chains";

import { mkRequestDrawer } from "./request-drawer";
import styles from "./results.module.scss";
import { useQuery } from "./use-query";
import { EntropyDeployments } from "../../entropy-deployments";
import { getRequests } from "../../get-requests";
import { Address } from "../Address";
import { Status } from "../Status";

export const Results = () => (
  <Suspense fallback={<ResultsImpl isLoading />}>
    <MountedResults />
  </Suspense>
);

const MountedResults = () => {
  const { chain } = useQuery();
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
          chain={chain}
          data={results.data}
          isUpdating={results.isValidating}
        />
      );
    }
  }
};

type ResolvedResultsProps = {
  data: Awaited<ReturnType<typeof getRequests>>;
  chain: keyof typeof EntropyDeployments | null;
  isUpdating?: boolean | undefined;
};

const ResolvedResults = ({ data, chain, isUpdating }: ResolvedResultsProps) => {
  const drawer = useDrawer();
  const { search } = useQuery();
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
            (chain === null || chain === request.chain) &&
            (filter.contains(request.txHash, search) ||
              (request.hasCallbackCompleted &&
                filter.contains(request.callbackResult.txHash, search)) ||
              filter.contains(request.caller, search) ||
              filter.contains(request.sequenceNumber.toString(), search)),
        )
        .map((request) => ({
          id: request.sequenceNumber.toString(),
          textValue: request.txHash,
          onAction: () => {
            drawer.open(mkRequestDrawer(request));
          },
          data: {
            chain: <Chain chain={request.chain} />,
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
              <Address
                alwaysTruncate
                chain={request.chain}
                value={request.caller}
              />
            ),
            requestTxHash: (
              <Address
                alwaysTruncate
                chain={request.chain}
                value={request.txHash}
              />
            ),
            callbackTxHash: request.hasCallbackCompleted && (
              <Address
                alwaysTruncate
                chain={request.chain}
                value={request.callbackResult.txHash}
              />
            ),
            status: <Status abbreviated request={request} />,
          },
        })),
    [data, search, dateFormatter, drawer, filter, chain],
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
        { id: "chain", name: "Chain" },
        { id: "sequenceNumber", name: "Sequence Number" },
        { id: "timestamp", name: "Timestamp" },
        { id: "caller", name: "Caller" },
        { id: "requestTxHash", name: "Request Transaction" },
        { id: "callbackTxHash", name: "Callback Transaction" },
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
      id: "caller" as const,
      name: "CALLER",
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
