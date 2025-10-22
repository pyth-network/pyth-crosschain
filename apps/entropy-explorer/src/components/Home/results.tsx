"use client";

import { EntityList } from "@pythnetwork/component-library/EntityList";
import { NoResults as NoResultsImpl } from "@pythnetwork/component-library/NoResults";
import type { RowConfig } from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { useDrawer } from "@pythnetwork/component-library/useDrawer";
import type { ComponentProps } from "react";
import { useMemo } from "react";

import { ChainTag } from "./chain-tag";
import { mkRequestDrawer } from "./request-drawer";
import styles from "./results.module.scss";
import type { ChainSlug } from "../../entropy-deployments";
import { EntropyDeployments } from "../../entropy-deployments";
import type { Request } from "../../requests";
import { Status } from "../../requests";
import { Account, Transaction } from "../Address";
import { Status as StatusComponent } from "../Status";
import { Timestamp } from "../Timestamp";
import { ChainSelect } from "./search-controls";

type Props = {
  currentPage: Request[];
  search?: string | undefined;
  isUpdating?: boolean | undefined;
  now: Date;
  chain: ChainSlug;
};

export const Results = ({
  currentPage,
  isUpdating,
  search,
  now,
  chain,
}: Props) => {
  const drawer = useDrawer();
  const rows = useMemo(
    () =>
      currentPage.map((request) => ({
        id: request.sequenceNumber.toString(),
        textValue: request.requestTxHash,
        onAction: () => {
          drawer.open(mkRequestDrawer(request, now));
        },
        data: {
          chain: <ChainTag className={styles.chain} chain={request.chain} />,
          timestamp: (
            <div className={styles.timestamp}>
              <Timestamp timestamp={request.requestTimestamp} now={now} />
            </div>
          ),
          sequenceNumber: (
            <div className={styles.sequenceNumber}>
              {request.sequenceNumber}
            </div>
          ),
          sender: <Account chain={request.chain} value={request.sender} />,
          requestTxHash: (
            <Transaction chain={request.chain} value={request.requestTxHash} />
          ),
          callbackTxHash: request.status === Status.Complete && (
            <Transaction chain={request.chain} value={request.callbackTxHash} />
          ),
          status: <StatusComponent status={request.status} size="xs" />,
        },
      })),
    [currentPage, drawer, now],
  );

  return (
    <ResultsImpl
      rows={rows}
      search={search}
      chain={chain}
      isUpdating={isUpdating}
    />
  );
};

export const ResultsLoading = () => <ResultsImpl isLoading />;

type ResultsImplProps =
  | {
      isLoading: true;
    }
  | {
      isLoading?: false | undefined;
      chain: ChainSlug;
      rows: (RowConfig<(typeof defaultProps)["columns"][number]["id"]> & {
        textValue: string;
      })[];
      isUpdating?: boolean | undefined;
      search?: string | undefined;
    };

const ResultsImpl = (props: ResultsImplProps) => (
  <>
    <div className={styles.entityList}>
      {!props.isLoading && props.rows.length === 0 ? (
        <NoResults search={props.search} chain={props.chain} />
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
            emptyState: <NoResults search={props.search} chain={props.chain} />,
            className: styles.table ?? "",
          })}
    />
  </>
);

type NoResultsProps = {
  search?: string | undefined;
  chain: ChainSlug;
};

const NoResults = ({ search, chain }: NoResultsProps) => {
  return (
    <NoResultsImpl
      query={search ?? ""}
      body={
        <>
          <p>
            We couldn{"'"}t find any results for your query on{" "}
            <ChainName chain={chain} />
          </p>
          <p>Would you like to try your search on a different chain?</p>
          <ChainSelect
            className={styles.noResultsChainSelect ?? ""}
            label="Chain"
            hideLabel
            variant="outline"
            size="sm"
          />
        </>
      }
    />
  );
};

const ChainName = ({ chain }: { chain: ChainSlug }) => {
  switch (chain) {
    case "all-mainnet": {
      return "any mainnet chain";
    }
    case "all-testnet": {
      return "any testnet chain";
    }
    default: {
      return EntropyDeployments[chain].name;
    }
  }
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
      isRowHeader: true,
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
      name: "STATUS",
      alignment: "center",
      width: 32,
    },
  ],
} satisfies Partial<ComponentProps<typeof Table<string>>>;
