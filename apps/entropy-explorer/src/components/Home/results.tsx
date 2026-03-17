"use client";

import { EntityList } from "@pythnetwork/component-library/EntityList";
import { NoResults as NoResultsImpl } from "@pythnetwork/component-library/NoResults";
import type { RowConfig } from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { useDrawer } from "@pythnetwork/component-library/useDrawer";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import type { ChainSlug } from "../../entropy-deployments";
import { EntropyDeployments } from "../../entropy-deployments";
import type { Request } from "../../requests";
import { Status } from "../../requests";
import { Account, Transaction } from "../Address";
import { Status as StatusComponent } from "../Status";
import { Timestamp } from "../Timestamp";
import { ChainTag } from "./chain-tag";
import { mkRequestDrawer } from "./request-drawer";
import styles from "./results.module.scss";
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
        data: {
          callbackTxHash: request.status === Status.Complete && (
            <Transaction chain={request.chain} value={request.callbackTxHash} />
          ),
          chain: <ChainTag chain={request.chain} className={styles.chain} />,
          requestTxHash: (
            <Transaction chain={request.chain} value={request.requestTxHash} />
          ),
          sender: <Account chain={request.chain} value={request.sender} />,
          sequenceNumber: (
            <div className={styles.sequenceNumber}>
              {request.sequenceNumber}
            </div>
          ),
          status: <StatusComponent size="xs" status={request.status} />,
          timestamp: (
            <div className={styles.timestamp}>
              <Timestamp now={now} timestamp={request.requestTimestamp} />
            </div>
          ),
        },
        id: request.sequenceNumber.toString(),
        onAction: () => {
          drawer.open(mkRequestDrawer(request, now));
        },
        textValue: request.requestTxHash,
      })),
    [currentPage, drawer, now],
  );

  return (
    <ResultsImpl
      chain={chain}
      isUpdating={isUpdating}
      rows={rows}
      search={search}
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
        <NoResults chain={props.chain} search={props.search} />
      ) : (
        <EntityList
          fields={[
            { id: "chain", name: "Chain" },
            { id: "sequenceNumber", name: "Sequence Number" },
            { id: "timestamp", name: "Timestamp" },
            { id: "sender", name: "Sender" },
            { id: "requestTxHash", name: "Request Transaction" },
            { id: "callbackTxHash", name: "Callback Transaction" },
            { id: "status", name: "Status" },
          ]}
          label={defaultProps.label}
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
            className: styles.table ?? "",
            emptyState: <NoResults chain={props.chain} search={props.search} />,
            isUpdating: props.isUpdating,
            rows: props.rows,
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
      body={
        <>
          <p>
            We couldn{"'"}t find any results for your query on{" "}
            <ChainName chain={chain} />
          </p>
          <p>Would you like to try your search on a different chain?</p>
          <ChainSelect
            className={styles.noResultsChainSelect ?? ""}
            hideLabel
            label="Chain"
            size="sm"
            variant="outline"
          />
        </>
      }
      query={search ?? ""}
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
  columns: [
    {
      id: "chain" as const,
      name: "CHAIN",
      width: 32,
    },
    {
      alignment: "center",
      id: "sequenceNumber" as const,
      isRowHeader: true,
      name: "SEQUENCE NUMBER",
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
      alignment: "center",
      id: "status" as const,
      name: "STATUS",
      width: 32,
    },
  ],
  fill: true,
  label: "Requests",
  rounded: true,
  stickyHeader: "appHeader",
} satisfies Partial<ComponentProps<typeof Table<string>>>;
