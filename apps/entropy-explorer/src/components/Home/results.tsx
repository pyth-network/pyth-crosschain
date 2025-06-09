"use client";

import { EntityList } from "@pythnetwork/component-library/EntityList";
import { NoResults } from "@pythnetwork/component-library/NoResults";
import type { RowConfig } from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { useDrawer } from "@pythnetwork/component-library/useDrawer";
import type { ComponentProps } from "react";
import { useMemo } from "react";

import { mkRequestDrawer } from "./request-drawer";
import styles from "./results.module.scss";
import { EntropyDeployments } from "../../entropy-deployments";
import type { Success } from "../../requests";
import { Status } from "../../requests";
import { Account, Transaction } from "../Address";
import { Status as StatusComponent } from "../Status";
import { Timestamp } from "../Timestamp";

type Props = {
  currentPage: Success["currentPage"];
  search?: string | undefined;
  isUpdating?: boolean | undefined;
  now: Date;
};

export const Results = ({ currentPage, isUpdating, search, now }: Props) => {
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
          chain: <Chain chain={request.chain} />,
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

  return <ResultsImpl rows={rows} search={search} isUpdating={isUpdating} />;
};

export const ResultsLoading = () => <ResultsImpl isLoading />;

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
      search?: string | undefined;
    };

const ResultsImpl = (props: ResultsImplProps) => (
  <>
    <div className={styles.entityList}>
      {!props.isLoading && props.rows.length === 0 ? (
        <NoResults query={props.search ?? ""} />
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
            emptyState: <NoResults query={props.search ?? ""} />,
            className: styles.table ?? "",
          })}
    />
  </>
);

const Chain = ({ chain }: { chain: keyof typeof EntropyDeployments }) => {
  return (
    <div className={styles.chain}>
      {EntropyDeployments[chain].icon}
      {EntropyDeployments[chain].name}
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
