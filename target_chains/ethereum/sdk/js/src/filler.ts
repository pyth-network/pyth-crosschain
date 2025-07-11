import { HermesClient } from "@pythnetwork/hermes-client";
import {
  Address,
  PublicClient,
  encodeFunctionData,
  Hex,
  Transport,
  Chain,
} from "viem";

import { multicall3Bundler } from "./multicall3-bundler";
import { IPythAbi } from "./pyth-abi";
import {
  debugTraceCallAction,
  extractPythPriceFeedsFromDebugTraceCall,
} from "./tracer/debug-trace-call";
import {
  extractPythPriceFeedsFromTraceCallMany,
  traceCallManyAction,
} from "./tracer/trace-call-many";

/**
 * Represents a call request to be executed on the blockchain
 */
export type CallRequest = {
  /** The address making the call (optional) */
  from?: Address;
  /** The target contract address */
  to: Address;
  /** The encoded function call data (optional) */
  data?: `0x${string}`;
  /** The amount of ETH to send with the call (optional) */
  value?: bigint;
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
 * Configuration for debug_traceCall method.
 * Use this when you want to trace a single bundled transaction that combines the Pyth update with the original call.
 * The bundler function is responsible for creating a single transaction that executes both operations.
 *
 * The bundler is crucial because debug_traceCall can only trace one transaction at a time. The bundler
 * must create a single call that includes both the Pyth price update and the original transaction logic.
 * This allows the tracer to see all the Pyth price feed calls that would be made in the actual execution.
 */
export type DebugTraceCallConfig = {
  /** Must be "debug_traceCall" */
  method: "debug_traceCall";
  /** Function that takes a Pyth update and original call, returns a single bundled call request.
   * Common bundlers include multicall3Bundler for combining calls via Multicall3 contract.
   * The bundler must create a single transaction that executes both the Pyth update and the original call. */
  bundler: Bundler;
  /** Maximum number of iterations to find all required price feeds. Default is 5.
   * Each iteration traces the current transaction to find new Pyth price feed calls. */
  maxIter: number;
};

/**
 * Configuration for trace_callMany method.
 * Use this when you want to trace multiple separate transactions (Pyth update + original call).
 * This method traces each call independently, which may be more accurate but requires more RPC calls.
 */
export type TraceCallManyConfig = {
  /** Must be "trace_callMany" */
  method: "trace_callMany";
  /** Maximum number of iterations to find all required price feeds. Default is 5.
   * Each iteration traces the current set of transactions to find new Pyth price feed calls. */
  maxIter: number;
};

/**
 * Union type for tracing configuration options
 */
export type Config = DebugTraceCallConfig | TraceCallManyConfig;

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
 *
 * @param client - The public client instance
 * @param call - The call request to fill with Pyth data
 * @param pythContractAddress - The Pyth contract address
 * @param hermesEndpoint - The Hermes endpoint URL for fetching price updates
 * @param config - Configuration options for tracing and bundling. Can be either:
 *   - `DebugTraceCallConfig`: For debug_traceCall method with a bundler function to combine Pyth update with original call.
 *     The bundler creates a single transaction that executes both the Pyth update and the original call.
 *   - `TraceCallManyConfig`: For trace_callMany method which traces multiple calls separately.
 *     This method traces the Pyth update and original call as separate transactions.
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
  const defaultConfig: Config = {
    method: "debug_traceCall",
    bundler: multicall3Bundler,
    maxIter: 5,
  };
  const finalConfig = config ?? defaultConfig;
  const traceActionsClient = client
    .extend(debugTraceCallAction)
    .extend(traceCallManyAction);
  const hermesClient = new HermesClient(hermesEndpoint);

  let requiredPriceFeeds = new Set<`0x${string}`>();

  let pythUpdate: PythUpdate | undefined;

  for (let i = 0; i < finalConfig.maxIter; i++) {
    let priceFeeds = new Set<`0x${string}`>();

    if (finalConfig.method === "debug_traceCall") {
      const bundledCall = pythUpdate
        ? finalConfig.bundler(pythUpdate, call)
        : call;
      const traceResult = await traceActionsClient.debugTraceCall(bundledCall);
      priceFeeds = extractPythPriceFeedsFromDebugTraceCall(
        traceResult,
        pythContractAddress,
      );
    } else {
      const calls = pythUpdate ? [pythUpdate.call, call] : [call];
      const traceResult = await traceActionsClient.traceCallMany(calls);
      priceFeeds = extractPythPriceFeedsFromTraceCallMany(
        traceResult,
        pythContractAddress,
      );
    }

    const oldSize = requiredPriceFeeds.size;
    requiredPriceFeeds = new Set([...requiredPriceFeeds, ...priceFeeds]);

    if (oldSize === requiredPriceFeeds.size) {
      break;
    }

    const hermesResponse = await hermesClient.getLatestPriceUpdates([
      ...requiredPriceFeeds,
    ]);
    const updateData = hermesResponse.binary.data.map(
      (data) => ("0x" + data) as `0x${string}`,
    );

    const updateFee = await getUpdateFee(
      client,
      pythContractAddress,
      updateData,
    );

    pythUpdate = {
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
  }

  return pythUpdate;
}
