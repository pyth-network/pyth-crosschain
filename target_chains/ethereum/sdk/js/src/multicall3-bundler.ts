import { encodeFunctionData } from "viem";

import type { CallRequest, PythUpdate } from "./filler.js";

// Multicall3 contract address (deployed on most chains)
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

// Multicall3 ABI for the aggregate3 and aggregate3Value functions
export const MULTICALL3_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "value", type: "uint256" },
          { name: "callData", type: "bytes" },
        ],
        name: "calls",
        type: "tuple[]",
      },
    ],
    name: "aggregate3Value",
    outputs: [
      {
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
        name: "returnData",
        type: "tuple[]",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
] as const;

/**
 * Bundle multiple calls using Multicall3. This bundler will change the msg.sender of the calls to the
 * Multicall3 contract and this might affect the result of the calls.
 */
export function multicall3Bundler(
  pythUpdate: PythUpdate,
  call: CallRequest,
): CallRequest {
  // Encode the multicall3 aggregate3 function call
  const multicallData = encodeFunctionData({
    abi: MULTICALL3_ABI,
    functionName: "aggregate3Value",
    args: [
      [
        {
          target: pythUpdate.call.to,
          allowFailure: false,
          value: pythUpdate.call.value ?? 0n,
          callData: pythUpdate.call.data ?? "0x",
        },
        {
          target: call.to,
          allowFailure: false,
          value: call.value ?? 0n,
          callData: call.data ?? "0x",
        },
      ],
    ],
  });

  // Calculate total value needed
  const totalValue = (call.value ?? 0n) + (pythUpdate.call.value ?? 0n);

  // Create the bundled transaction that calls multicall3
  return {
    to: MULTICALL3_ADDRESS,
    data: multicallData,
    value: totalValue,
    from: call.from,
  };
}
