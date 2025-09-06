"use client";
import { InfoBox } from "@pythnetwork/component-library/InfoBox";
import { Spinner } from "@pythnetwork/component-library/Spinner";
import type {
  ColumnConfig,
  RowConfig,
} from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import { useEffect, useRef, useState } from "react";

import { FORTUNA_API_URLS } from "./constants";
import type { EntropyDeployment } from "./entropy-api-data-fetcher";
import { fetchEntropyDeployments } from "./entropy-api-data-fetcher";
import CopyAddress from "../CopyAddress";

export const EntropyTable = ({ isMainnet }: { isMainnet: boolean }) => {
  const isLoading = useRef(false);
  const [state, setState] = useState<State>(State.NotLoaded());

  useEffect(() => {
    if (!isLoading.current) {
      setState(State.Loading());
      isLoading.current = true;
      getEntropyDeployments(isMainnet)
        .then((chains) => {
          setState(State.Loaded(chains));
        })
        .catch((error: unknown) => {
          setState(State.Failed(error));
        });
    }
  }, [isMainnet]);

  switch (state.type) {
    case StateType.Loading:
    case StateType.NotLoaded: {
      return <Spinner label="Fetching the list of entropy contracts..." />;
    }
    case StateType.Error: {
      return (
        <InfoBox title="Error" variant="error">
          <p>Failed to fetch the list of entropy contracts.</p>
        </InfoBox>
      );
    }
    case StateType.Loaded: {
      return <EntropyTableContent chains={state.chains} />;
    }
    default: {
      throw new Error(`Unknown state type: ${typeof state}`);
    }
  }
};

type Col = "chain" | "address" | "delay" | "gasLimit";

const EntropyTableContent = ({
  chains,
}: {
  chains: Record<string, EntropyDeployment>;
}) => {
  const columns: ColumnConfig<Col>[] = [
    { id: "chain", name: "Chain", isRowHeader: true },
    { id: "address", name: "Contract" },
    { id: "delay", name: "Reveal Delay" },
    { id: "gasLimit", name: "Default Gas Limit" },
  ];

  const rows: RowConfig<Col>[] = Object.entries(chains).map(
    ([chainName, d]) => ({
      id: chainName,
      data: {
        chain: chainName,
        address: d.explorer ? (
          <CopyAddress
            address={d.address}
            url={`${d.explorer}/address/${d.address}`}
          />
        ) : (
          <CopyAddress address={d.address} />
        ),
        delay: d.delay,
        gasLimit: d.gasLimit,
      },
    }),
  );

  return (
    <Table<Col>
      label="Entropy deployments"
      columns={columns}
      rows={rows}
      isLoading={false}
      rounded
      fill
      stickyHeader="top"
    />
  );
};

enum StateType {
  NotLoaded,
  Loading,
  Loaded,
  Error,
}

const State = {
  NotLoaded: () => ({ type: StateType.NotLoaded as const }),
  Loading: () => ({ type: StateType.Loading as const }),
  Loaded: (chains: Awaited<ReturnType<typeof getEntropyDeployments>>) => ({
    type: StateType.Loaded as const,
    chains,
  }),
  Failed: (error: unknown) => ({ type: StateType.Error as const, error }),
};

type State = ReturnType<(typeof State)[keyof typeof State]>;

const getEntropyDeployments = async (
  isMainnet: boolean,
): Promise<Record<string, EntropyDeployment>> => {
  const url = isMainnet ? FORTUNA_API_URLS.mainnet : FORTUNA_API_URLS.testnet;
  return await fetchEntropyDeployments(url);
};
