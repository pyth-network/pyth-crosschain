/* biome-ignore-all lint/suspicious/noConsole: validation script reports results to stdout */
/**
 * Transport-parity validation for `SuiPythClient`.
 *
 * Exercises every read method (`getBaseUpdateFee`, `getPackageId`,
 * `getWormholePackageId`, `getPriceFeedObjectId`) plus the `updatePriceFeeds`
 * transaction build against a live Sui endpoint over BOTH transports —
 * `SuiJsonRpcClient` (JSON-RPC) and `SuiGrpcClient` (gRPC) — and asserts the two
 * produce identical results. The public Sui fullnode serves both JSON-RPC and
 * gRPC-web, so the defaults below run against mainnet out of the box:
 *
 *   pnpm tsx src/examples/ValidateTransports.ts
 *   pnpm tsx src/examples/ValidateTransports.ts --network testnet \
 *     --json-rpc-url https://fullnode.testnet.sui.io:443 \
 *     --grpc-url https://fullnode.testnet.sui.io:443 \
 *     --pyth-state-id 0x... --wormhole-state-id 0x... --feed-id <hex>
 *
 * This is the script that caught the `price_info` dynamic-object-field bug while
 * validating the transport-agnostic refactor; keep it runnable after future
 * `@mysten/sui` bumps to re-check parity.
 */

import { Buffer } from "node:buffer";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { SuiPythClientProvider } from "../client.js";
import { SuiPythClient } from "../client.js";

type Transport = "jsonrpc" | "grpc";

type CheckResult = {
  baseUpdateFee: string;
  pythPackageId: string;
  wormholePackageId: string;
  priceFeedObjectId: string;
  updatePriceFeedsBuilds: boolean;
};

type CheckParams = {
  network: string;
  jsonRpcUrl: string;
  grpcUrl: string;
  pythStateId: string;
  wormholeStateId: string;
  feedId: string;
  hermes: string;
};

const NOT_REGISTERED = "(feed not registered on this network)";

function makeProvider(
  transport: Transport,
  params: CheckParams,
): SuiPythClientProvider {
  return transport === "grpc"
    ? new SuiGrpcClient({ baseUrl: params.grpcUrl, network: params.network })
    : new SuiJsonRpcClient({ network: params.network, url: params.jsonRpcUrl });
}

async function fetchUpdateData(
  hermes: string,
  feedId: string,
): Promise<Buffer> {
  const url = `${hermes}/v2/updates/price/latest?ids[]=${feedId}&encoding=base64`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Hermes request failed with status ${response.status}`);
  }
  const body = (await response.json()) as { binary: { data: string[] } };
  const first = body.binary.data[0];
  if (first === undefined) {
    throw new Error(`Hermes returned no update for feed ${feedId}`);
  }
  return Buffer.from(first, "base64");
}

async function check(
  transport: Transport,
  params: CheckParams,
): Promise<CheckResult> {
  const client = new SuiPythClient(
    makeProvider(transport, params),
    params.pythStateId,
    params.wormholeStateId,
  );

  const baseUpdateFee = await client.getBaseUpdateFee();
  const pythPackageId = await client.getPackageId(params.pythStateId);
  const wormholePackageId = await client.getWormholePackageId();
  const priceFeedObjectId = await client.getPriceFeedObjectId(params.feedId);

  // Only attempt the write-path build when the feed is registered; an
  // unregistered feed (common on testnet) is reported, not treated as failure.
  let updatePriceFeedsBuilds = false;
  if (priceFeedObjectId !== undefined) {
    const tx = new Transaction();
    const updateData = await fetchUpdateData(params.hermes, params.feedId);
    await client.updatePriceFeeds(tx, [updateData], [params.feedId]);
    updatePriceFeedsBuilds = true;
  }

  return {
    baseUpdateFee: String(baseUpdateFee),
    priceFeedObjectId: priceFeedObjectId ?? NOT_REGISTERED,
    pythPackageId,
    updatePriceFeedsBuilds,
    wormholePackageId,
  };
}

function diffResults(jsonRpc: CheckResult, grpc: CheckResult): string[] {
  const keys = Object.keys(jsonRpc) as (keyof CheckResult)[];
  return keys
    .filter((key) => String(jsonRpc[key]) !== String(grpc[key]))
    .map((key) => `${key}: jsonrpc=${jsonRpc[key]} grpc=${grpc[key]}`);
}

async function run(): Promise<void> {
  const argv = await yargs(hideBin(process.argv))
    .option("network", { default: "mainnet", type: "string" })
    .option("json-rpc-url", {
      default: "https://fullnode.mainnet.sui.io:443",
      type: "string",
    })
    .option("grpc-url", {
      default: "https://fullnode.mainnet.sui.io:443",
      type: "string",
    })
    .option("pyth-state-id", {
      default:
        "0x1f9310238ee9298fb703c3419030b35b22bb1cc37113e3bb5007c99aec79e5b8",
      type: "string",
    })
    .option("wormhole-state-id", {
      default:
        "0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c",
      type: "string",
    })
    .option("feed-id", {
      default:
        "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
      description:
        "Price feed id without the leading 0x (defaults to BTC/USD).",
      type: "string",
    })
    .option("hermes", {
      default: "https://hermes.pyth.network",
      type: "string",
    }).argv;

  const params: CheckParams = {
    feedId: argv["feed-id"],
    grpcUrl: argv["grpc-url"],
    hermes: argv.hermes,
    jsonRpcUrl: argv["json-rpc-url"],
    network: argv.network,
    pythStateId: argv["pyth-state-id"],
    wormholeStateId: argv["wormhole-state-id"],
  };

  console.log(`Validating SuiPythClient on ${params.network}\n`);
  const jsonRpcResult = await check("jsonrpc", params);
  console.log("JSON-RPC:", JSON.stringify(jsonRpcResult, null, 2));
  const grpcResult = await check("grpc", params);
  console.log("gRPC:    ", JSON.stringify(grpcResult, null, 2));

  const diffs = diffResults(jsonRpcResult, grpcResult);
  if (diffs.length > 0) {
    console.error(`\nTransport mismatch:\n${diffs.join("\n")}`);
    process.exit(1);
  }
  console.log("\nJSON-RPC and gRPC results are identical.");
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
