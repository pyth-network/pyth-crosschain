"use client";
import { InfoBox } from "@pythnetwork/component-library/InfoBox";
import { Spinner } from "@pythnetwork/component-library/Spinner";
import type {
  ColumnConfig,
  RowConfig,
} from "@pythnetwork/component-library/Table";
import { Table } from "@pythnetwork/component-library/Table";
import IEntropyV2 from "@pythnetwork/entropy-sdk-solidity/abis/IEntropyV2.json";
import { useEffect, useRef, useState } from "react";
import type { PublicClient, Abi } from "viem";
import { createPublicClient, formatEther, http, isAddress } from "viem";

import { FORTUNA_API_URLS } from "./constants";
import type { EntropyDeployment } from "./entropy-api-data-fetcher";
import { fetchEntropyDeployments } from "./entropy-api-data-fetcher";
import CopyAddress from "../CopyAddress";
import styles from "./index.module.scss";

function isValidAddress(address: string): address is `0x${string}` {
  return isAddress(address);
}

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
          Failed to fetch the list of entropy contracts.
        </InfoBox>
      );
    }
    case StateType.Loaded: {
      return <EntropyTableContent chains={state.chains} />;
    }
  }
};

type Col = "chain" | "address" | "delay" | "gasLimit" | "fee";

const EntropyTableContent = ({
  chains,
}: {
  chains: Record<string, EntropyDeployment>;
}) => {
  const fees = useEntropyFees(chains);
  const columns: ColumnConfig<Col>[] = [
    { id: "chain", name: "Chain", isRowHeader: true },
    { id: "address", name: "Contract" },
    { id: "delay", name: "Reveal Delay" },
    { id: "gasLimit", name: "Default Gas Limit" },
    { id: "fee", name: "Fee" },
  ];

  const rows: RowConfig<Col>[] = Object.entries(chains)
    .sort(([chainNameA], [chainNameB]) => chainNameA.localeCompare(chainNameB))
    .map(([chainName, deployment]) => ({
      id: chainName,
      data: {
        chain: chainName,
        address: deployment.explorer ? (
          <CopyAddress
            maxLength={6}
            address={deployment.address}
            url={`${deployment.explorer}/address/${deployment.address}`}
          />
        ) : (
          <CopyAddress maxLength={6} address={deployment.address} />
        ),
        delay: deployment.delay,
        gasLimit: deployment.gasLimit,
        fee:
          formatEther(fees[chainName] ?? BigInt(deployment.default_fee)) +
          ` ${deployment.nativeCurrency ?? "ETH"}`,
      },
    }));

  return (
    <Table<Col>
      className={styles.table ?? ""}
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

function useEntropyFees(
  chains: Record<string, EntropyDeployment>,
): Record<string, bigint | undefined> {
  const [feesByChain, setFeesByChain] = useState<
    Record<string, bigint | undefined>
  >({});
  const clientsRef = useRef<Map<string, PublicClient>>(new Map());

  function getClient(rpc: string): PublicClient {
    const cached = clientsRef.current.get(rpc);
    if (cached) return cached;
    const client = createPublicClient({
      transport: http(rpc, { timeout: 10_000, retryCount: 1 }),
    });
    clientsRef.current.set(rpc, client);
    return client;
  }

  useEffect(() => {
    const entries = Object.entries(chains);
    if (entries.length === 0) return;

    let isCancelled = false;

    async function loadInBatches() {
      const batchSize = 5;
      for (let i = 0; i < entries.length; i += batchSize) {
        if (isCancelled) return;
        const batch = entries.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async ([chainName, deployment]) => {
            if (!deployment.rpc || !isValidAddress(deployment.address)) {
              return [chainName, undefined] as const;
            }
            try {
              const client = getClient(deployment.rpc);
              const fee = await client.readContract({
                address: deployment.address,
                abi: IEntropyV2 as unknown as Abi,
                functionName: "getFeeV2",
                args: [],
              });
              return [chainName, fee] as const;
            } catch {
              return [chainName, undefined] as const;
            }
          }),
        );

        const next: Record<string, bigint | undefined> = {};
        for (const result of results) {
          if (result.status === "fulfilled") {
            const [chainName, fee] = result.value;
            if (typeof fee === "bigint") {
              next[chainName] = fee;
            }
          }
        }
        if (Object.keys(next).length > 0) {
          setFeesByChain((prev) => ({ ...prev, ...next }));
        }
      }
    }

    loadInBatches().catch((error: unknown) => {
      // eslint-disable-next-line no-console
      console.error("Failed to load entropy fees:", error);
    });

    return () => {
      isCancelled = true;
    };
  }, [chains]);

  return feesByChain;
}
