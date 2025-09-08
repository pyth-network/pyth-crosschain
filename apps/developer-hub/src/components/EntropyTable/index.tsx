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
import { createPublicClient, http } from "viem";

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
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chainName, d]) => ({
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
        fee:
          formatWeiFixed18(fees[chainName] ?? BigInt(d.default_fee)) +
          ` ${d.nativeCurrency ?? "ETH"}`,
      },
    }));

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
          batch.map(async ([name, d]) => {
            if (!d.rpc) return [name, undefined] as const;
            try {
              const client = getClient(d.rpc);
              const fee = await client.readContract({
                address: d.address as `0x${string}`,
                abi: IEntropyV2 as unknown as Abi,
                functionName: "getFeeV2",
                args: [],
              });
              return [name, fee] as const;
            } catch {
              return [name, undefined] as const;
            }
          }),
        );

        const next: Record<string, bigint | undefined> = {};
        for (const r of results) {
          if (r.status === "fulfilled") {
            const [name, fee] = r.value;
            next[name] = fee as bigint;
          }
        }
        if (Object.keys(next).length > 0) {
          setFeesByChain((prev) => ({ ...prev, ...next }));
        }
      }
    }

    void loadInBatches();

    return () => {
      isCancelled = true;
    };
  }, [chains]);

  return feesByChain;
}

function formatWeiFixed18(value: bigint): string {
  const intPart = value / 1_000_000_000_000_000_000n;
  const fracPart = value % 1_000_000_000_000_000_000n;
  const fracStr = fracPart.toString().padStart(18, "0");
  return `${intPart.toString()}.${fracStr}`;
}
