"use client";

import { PythHttpClient } from "@pythnetwork/client";
import { Connection, PublicKey } from "@solana/web3.js";
import type { ComponentProps } from "react";
import { createContext, useContext, useState, useEffect } from "react";
import { z } from "zod";

const PYTHNET_RPC_URL = "https://api2.pythnet.pyth.network";
const PYTHNET_WS_URL = "wss://api2.pythnet.pyth.network";
const PROGRAM_KEY = new PublicKey(
  "FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH",
);

export enum PriceFeedListContextType {
  NotInitialized,
  Loading,
  Loaded,
  Error,
}

const NotInitialized = () => ({
  type: PriceFeedListContextType.NotInitialized as const,
});
const Loading = () => ({ type: PriceFeedListContextType.Loading as const });
const Loaded = (priceFeedList: PriceFeed[]) => ({
  type: PriceFeedListContextType.Loaded as const,
  priceFeedList,
});
const ErrorState = (error: unknown) => ({
  type: PriceFeedListContextType.Error as const,
  error,
});

export type PriceFeedListContext =
  | ReturnType<typeof NotInitialized>
  | ReturnType<typeof Loading>
  | ReturnType<typeof Loaded>
  | ReturnType<typeof ErrorState>;

const PriceFeedListContext =
  createContext<PriceFeedListContext>(NotInitialized());

export const PriceFeedListProvider = (
  props: Omit<ComponentProps<typeof PriceFeedListContext.Provider>, "value">,
) => {
  const [state, setState] = useState<PriceFeedListContext>(NotInitialized());

  useEffect(() => {
    setState(Loading());
    const abortController = new AbortController();
    loadPriceFeedList(abortController.signal)
      .then((result) => {
        setState(Loaded(result));
      })
      .catch((error: unknown) => {
        setState(ErrorState(error));
      });
    return () => {
      abortController.abort();
    };
  }, []);

  return <PriceFeedListContext.Provider value={state} {...props} />;
};

export const usePriceFeedList = () => useContext(PriceFeedListContext);

const loadPriceFeedList = async (signal: AbortSignal) => {
  const pythClient = new PythHttpClient(
    new Connection(PYTHNET_RPC_URL, {
      commitment: "confirmed",
      wsEndpoint: PYTHNET_WS_URL,
      fetch: (url, init) => fetch(url, { signal, ...init }),
    }),
    PROGRAM_KEY,
  );
  const onChainData = await onChainDataSchema.parseAsync(
    await pythClient.getData(),
  );
  return onChainData.products.map((product) => ({
    name: product.symbol,
    description: product.description,
    feedId: product.price_account,
  }));
};

const onChainDataSchema = z.object({
  products: z.array(
    z.object({
      symbol: z.string(),
      description: z.string(),
      price_account: z.string(),
    }),
  ),
});

export type PriceFeed = {
  name: string;
  description: string;
  feedId: string;
};
