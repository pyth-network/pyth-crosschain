import {
  type Address,
  type BlockTag,
  decodeFunctionData,
  type RpcTransactionRequest,
  type ExactPartial,
  type Hex,
  type Client,
  formatTransactionRequest,
  type CallParameters,
  isAddressEqual,
} from "viem";

import { IPythAbi } from "../pyth-abi";
import { type Nullish } from "../types";

/**
 * Extract Pyth price feed IDs from a transaction call trace.
 */
export function extractPythPriceFeedsFromTraceCallMany(
  traceResults: TraceCallResult[],
  pythContractAddress: Address,
  ignoreParsingErrors = false,
): Set<`0x${string}`> {
  const result = new Set<`0x${string}`>();
  for (const traceResult of traceResults) {
    for (const trace of traceResult.trace) {
      if (isAddressEqual(trace.action.to, pythContractAddress)) {
        // Decode the calldata to see what function is being called
        try {
          const decoded = decodeFunctionData({
            abi: IPythAbi,
            data: trace.action.input,
          });

          let priceFeedId: Nullish<`0x${string}`>;
          switch (decoded.functionName) {
            case "getPrice":
            case "getPriceNoOlderThan":
            case "getPriceUnsafe":
            case "getEmaPrice":
            case "getEmaPriceNoOlderThan":
            case "getEmaPriceUnsafe": {
              const pfid = decoded.args?.[0];
              if (pfid !== null && pfid !== undefined) {
                priceFeedId = pfid as typeof priceFeedId;
              }
              break;
            }
            default: {
              break;
            }
          }
          if (priceFeedId) {
            result.add(priceFeedId);
          }
        } catch {
          if (!ignoreParsingErrors) {
            throw new Error(
              `Failed to decode calldata: ${trace.action.input}. Make sure correct Pyth contract address is used.`,
            );
          }
        }
      }
    }
  }

  return result;
}

export type TraceCallResult = {
  output: Hex;
  stateDiff: undefined;
  trace: RpcCallTrace[];
  vmTrace: undefined;
};

export type TraceCallRpcSchema = {
  Method: "trace_callMany";
  Parameters: [
    [ExactPartial<RpcTransactionRequest>, ["trace"]][],
    Hex | BlockTag,
  ];
  ReturnType: TraceCallResult[];
};

export type RpcCallTrace = {
  action: {
    from: Address;
    callType:
      | "call"
      | "staticcall"
      | "delegatecall"
      | "create"
      | "create2"
      | "selfdestruct"
      | "callcode";
    gas: Hex;
    input: Hex;
    to: Address;
    value: Hex;
  };
  result: {
    gasUsed: Hex;
    output: Hex;
  };
  subtraces: number;
  traceAddress: number[];
  type: "call" | "create";
};

export const traceCallManyAction = (client: Client) => ({
  async traceCallMany(args: CallParameters[]) {
    return client.request<TraceCallRpcSchema>({
      method: "trace_callMany",
      params: [
        args.map((a) => [formatTransactionRequest(a), ["trace"]]),
        "latest",
      ],
    });
  },
});
