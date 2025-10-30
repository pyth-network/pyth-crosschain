import { HermesClient } from "@pythnetwork/hermes-client";
import type { Address, PublicClient, Hex, Transport, Chain } from "viem";
import { encodeFunctionData } from "viem";

import { IPythAbi } from "./pyth-abi.js";
import {
  debugTraceCallAction,
  extractPythPriceFeedsFromDebugTraceCall,
} from "./tracer/debug-trace-call.js";
import {
  extractPythPriceFeedsFromTraceCallMany,
  traceCallManyAction,
} from "./tracer/trace-call-many.js";

/**
 * Represents a call request to be executed on the blockchain
 */
export type CallRequest = {
  /** The address making the call (optional) */
  from?: Address | undefined;
  /** The target contract address */
  to: Address;
  /** The encoded function call data (optional) */
  data?: Hex | undefined;
  /** The amount of ETH to send with the call (optional) */
  value?: bigint | undefined;
};

/**
 * Get the update fee for a given set of update data
 *
 * @param client - The public client instance
 * @param pythContractAddress - The Pyth contract address
 * @param updateData - Array of hex-encoded update data
 * @returns Promise resolving to the update fee in wei
 */
export async function getUpdateFee<
  transport extends Transport,
  chain extends Chain | undefined,
>(
  client: PublicClient<transport, chain>,
  pythContractAddress: Address,
  updateData: Hex[],
): Promise<bigint> {
  return await client.readContract({
    address: pythContractAddress,
    abi: IPythAbi,
    functionName: "getUpdateFee",
    args: [updateData],
  });
}

/**
 * A function that takes a Pyth update and a call request and returns a single bundled call request.
 * This is used to combine the Pyth update with the original call.
 */
export type Bundler = (
  pythUpdate: PythUpdate,
  call: CallRequest,
) => CallRequest;

/**
 * Tracing configuration options
 */
export type Config = {
  /** Maximum number of iterations to find all required price feeds. Default is 5. */
  maxIter?: number;
} & (
  | {
      /**
       * Use this when you want to trace multiple separate transactions (Pyth update + original call).
       * This method traces each call independently, which may be more accurate but requires more RPC calls.
       */
      method: "trace_callMany";
    }
  | {
      /**
       * Use this when you want to trace a single bundled transaction that combines the Pyth update with the original call.
       * The bundler function is responsible for creating a single transaction that executes both operations.
       *
       * The bundler is crucial because debug_traceCall can only trace one transaction at a time.
       * The bundler must create a single call that includes both the Pyth price update and the original transaction logic.
       * This allows the tracer to see all the Pyth price feed calls that would be made in the actual execution.
       */
      method: "debug_traceCall";
      /**
       * Function that takes a Pyth update and original call, returns a single bundled call request.
       * Common bundlers include multicall3Bundler for combining calls via Multicall3 contract.
       */
      bundler: Bundler;
    }
);

/**
 * Represents a Pyth price update transaction
 */
export type PythUpdate = {
  /** The call request to update Pyth price feeds */
  call: CallRequest;
  /** Array of hex-encoded price update data */
  updateData: Hex[];
  /** The fee required for the update in wei */
  updateFee: bigint;
};

/**
 * Fill the Pyth data for a given call request.
 * Requires a client that supports trace_callMany or debug_traceCall with a bundler.
 * This function will trace the call and find all the Pyth price feeds that are needed to fill the call in multiple
 * iterations because a single call might revert if it requires a price feed that is not available and we need to
 * trace the call again with the new price feeds until we have all the price feeds.
 *
 * @param client - The public client instance
 * @param call - The call request to fill with Pyth data
 * @param pythContractAddress - The Pyth contract address
 * @param hermesEndpoint - The Hermes endpoint URL for fetching price updates
 * @param config - Configuration options for tracing and bundling. Default is `{ method: "trace_callMany" }`.
 *   - `Config` with `method: "trace_callMany"`: For trace_callMany method which traces multiple calls separately.
 *     This method traces the Pyth update and original call as separate transactions.
 *   - `Config` with `method: "debug_traceCall"` and `bundler`: For debug_traceCall method with a bundler function to
 *     combine Pyth update with the original call. The bundler creates a single transaction that executes both the
 *     Pyth update and the original call.
 *   - `maxIter`: Maximum number of iterations to find all required price feeds. Each iteration traces the current
 *     transaction(s) to find new Pyth price feed calls. The process stops when no new price feeds are found
 *     or when maxIter is reached. Default is 5.
 * @returns Promise resolving to Pyth update object or undefined if no Pyth data needed
 */
export async function fillPythUpdate<
  transport extends Transport,
  chain extends Chain | undefined,
>(
  client: PublicClient<transport, chain>,
  call: CallRequest,
  pythContractAddress: Address,
  hermesEndpoint: string,
  config?: Config,
): Promise<PythUpdate | undefined> {
  config = {
    method: "trace_callMany",
    ...config,
  };

  const hermesClient = new HermesClient(hermesEndpoint);

  let requiredPriceFeeds = new Set<Address>();
  let pythUpdate: PythUpdate | undefined;

  for (let i = 0; i < (config.maxIter ?? 5); i++) {
    const priceFeeds = await getPriceFeeds(
      client,
      pythContractAddress,
      call,
      config,
      pythUpdate,
    );

    if (priceFeeds.isSubsetOf(requiredPriceFeeds)) {
      break;
    } else {
      requiredPriceFeeds = requiredPriceFeeds.union(priceFeeds);
      pythUpdate = await getPythUpdate(
        client,
        hermesClient,
        requiredPriceFeeds,
        pythContractAddress,
        call,
      );
    }
  }

  return pythUpdate;
}

const getPythUpdate = async <
  transport extends Transport,
  chain extends Chain | undefined,
>(
  client: PublicClient<transport, chain>,
  hermesClient: HermesClient,
  priceFeeds: Set<Address>,
  pythContractAddress: Address,
  call: CallRequest,
) => {
  const hermesResponse = await hermesClient.getLatestPriceUpdates([
    ...priceFeeds,
  ]);
  const updateData = hermesResponse.binary.data.map<Hex>((data) => `0x${data}`);
  const updateFee = await getUpdateFee(client, pythContractAddress, updateData);
  return {
    call: {
      to: pythContractAddress,
      data: encodeFunctionData({
        abi: IPythAbi,
        functionName: "updatePriceFeeds",
        args: [updateData],
      }),
      from: call.from,
      value: updateFee,
    },
    updateData,
    updateFee,
  };
};

/**
 * Get the price feeds from the trace of the given call.
 */
const getPriceFeeds = async <
  transport extends Transport,
  chain extends Chain | undefined,
>(
  client: PublicClient<transport, chain>,
  pythContractAddress: Address,
  call: CallRequest,
  config: Config,
  pythUpdate: PythUpdate | undefined,
) => {
  switch (config.method) {
    case "debug_traceCall": {
      return extractPythPriceFeedsFromDebugTraceCall(
        await client
          .extend(debugTraceCallAction)
          .debugTraceCall(pythUpdate ? config.bundler(pythUpdate, call) : call),
        pythContractAddress,
      );
    }
    case "trace_callMany": {
      return extractPythPriceFeedsFromTraceCallMany(
        await client
          .extend(traceCallManyAction)
          .traceCallMany(pythUpdate ? [pythUpdate.call, call] : [call]),
        pythContractAddress,
      );
    }
  }
};
