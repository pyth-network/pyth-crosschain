import {
  Address,
  BlockTag,
  CallParameters,
  Client,
  decodeFunctionData,
  ExactPartial,
  formatTransactionRequest,
  Hex,
  RpcTransactionRequest,
} from "viem";

import { IPythAbi } from "../pyth-abi";

/**
 * Extract Pyth price feed IDs from a transaction call trace.
 */
export function extractPythPriceFeedsFromDebugTraceCall(
  trace: RpcCallTrace,
  pythContractAddress: Address,
  ignoreParsingErrors = false,
): Set<`0x${string}`> {
  const result = new Set<`0x${string}`>();
  if (trace.to === pythContractAddress) {
    // Decode the calldata to see what function is being called
    try {
      const decoded = decodeFunctionData({
        abi: IPythAbi,
        data: trace.input,
      });

      let priceFeedId: `0x${string}` | undefined;
      switch (decoded.functionName) {
        case "getPrice":
        case "getPriceNoOlderThan":
        case "getPriceUnsafe":
        case "getEmaPrice":
        case "getEmaPriceNoOlderThan":
        case "getEmaPriceUnsafe": {
          priceFeedId = decoded.args[0];
          break;
        }
        default: {
          break;
        }
      }
      if (priceFeedId !== undefined) {
        result.add(priceFeedId);
      }
    } catch {
      if (!ignoreParsingErrors) {
        throw new Error(
          `Failed to decode calldata: ${trace.input}. Make sure correct Pyth contract address is used.`,
        );
      }
    }
  }
  if (trace.calls === undefined) {
    return new Set();
  }
  return new Set([
    ...result,
    ...trace.calls.flatMap((call) => [
      ...extractPythPriceFeedsFromDebugTraceCall(call, pythContractAddress),
    ]),
  ]);
}

export type TraceCallRpcSchema = {
  Method: "debug_traceCall";
  Parameters:
    | [ExactPartial<RpcTransactionRequest>, Hex | BlockTag]
    | [
        ExactPartial<RpcTransactionRequest>,
        BlockTag | Hex,
        {
          tracer: "callTracer" | "prestateTracer";
          tracerConfig?: { onlyTopCall?: boolean; withLog?: boolean };
        },
      ];
  ReturnType: RpcCallTrace;
};

export type RpcCallType =
  | "CALL"
  | "STATICCALL"
  | "DELEGATECALL"
  | "CREATE"
  | "CREATE2"
  | "SELFDESTRUCT"
  | "CALLCODE";

export type RpcLogTrace = {
  address: Address;
  data: Hex;
  position: Hex;
  topics: [Hex, ...Hex[]];
};

export type RpcCallTrace = {
  from: Address;
  gas: Hex;
  gasUsed: Hex;
  to: Address;
  input: Hex;
  output: Hex;
  error?: string;
  revertReason?: string;
  calls?: RpcCallTrace[];
  logs?: RpcLogTrace[];
  value?: Hex;
  type: RpcCallType;
};

export const debugTraceCallAction = (client: Client) => ({
  async debugTraceCall(args: CallParameters) {
    return client.request<TraceCallRpcSchema>({
      method: "debug_traceCall",
      params: [
        formatTransactionRequest(args),
        "latest",
        { tracer: "callTracer" },
      ],
    });
  },
});
