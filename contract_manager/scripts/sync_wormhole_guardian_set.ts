/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { PrivateKey } from "../src/core/base";
import { toPrivateKey } from "../src/core/base";
import type { WormholeContract } from "../src/core/contracts/wormhole";
import { DefaultStore } from "../src/node/utils/store";

const GUARDIAN_INDEX_TIMEOUT_MS = 10_000;
const SYNC_GUARDIAN_SETS_TIMEOUT_MS = 3 * 60 * 1000;

/** Suppress got/p-cancelable race when our timeout fires before the request settles. */
function isPancelableRaceError(err: unknown): boolean {
  return (
    err instanceof Error &&
    err.message.includes("onCancel") &&
    err.message.includes("attached after the promise settled")
  );
}

process.on("unhandledRejection", (reason: unknown) => {
  if (isPancelableRaceError(reason)) return;
});
process.on("uncaughtException", (err: Error) => {
  if (isPancelableRaceError(err)) return;
  throw err;
});

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  // Handle the original promise so that if we time out and return first, any
  // later rejection (e.g. from got/p-cancelable) does not become unhandled.
  promise.catch(() => {});
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Operation timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

interface Row {
  chainName: string;
  mainnet: boolean;
  startIndex: string;
  endIndex: string;
  error?: string;
}

async function syncChain(
  contract: WormholeContract,
  privateKey: PrivateKey,
  targetIndex: number,
  dryRun: boolean,
  verbose: boolean,
): Promise<Row | undefined> {
  const chain = contract.getChain();
  try {
    const startIndex = await withTimeout(
      contract.getCurrentGuardianSetIndex(),
      GUARDIAN_INDEX_TIMEOUT_MS,
    );

    // If the startIndex is 0, the contract is probably using the Wormhole testnet contracts
    if (startIndex === 0) {
      return undefined;
    }

    if (startIndex >= targetIndex) {
      return undefined;
    }
    let endIndex = startIndex;
    if (!dryRun) {
      await withTimeout(
        contract.syncMainnetGuardianSets(privateKey),
        SYNC_GUARDIAN_SETS_TIMEOUT_MS,
      );
      endIndex = await withTimeout(
        contract.getCurrentGuardianSetIndex(),
        GUARDIAN_INDEX_TIMEOUT_MS,
      );
    }
    return { chainName: chain.getId(), mainnet: chain.isMainnet(), startIndex: String(startIndex), endIndex: String(endIndex) };
  } catch (error) {
    const message =
      verbose && error instanceof Error
        ? error.message
        : error != null && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : "An error occurred";
    if (verbose) {
      console.error(`[${chain.getId()}]`, error);
    }
    return {
      chainName: chain.getId(),
      mainnet: contract.getChain().isMainnet(),
      startIndex: "—",
      endIndex: "—",
      error: message.slice(0, 120),
    };
  }
}

const parser = yargs(hideBin(process.argv))
  .usage("Update the guardian set in stable networks. Usage: $0")
  .options({
    "private-key": {
      type: "string",
      demandOption: true,
      desc: "Private key to sign the transactions with",
    },
    chain: {
      type: "string",
      array: true,
      desc: "Can be one of the chains available in the store",
    },
    "target-index": {
      type: "number",
      demandOption: true,
      desc: "Only sync and show contracts whose current guardian set index is below this value",
    },
    "dry-run": {
      type: "boolean",
      default: false,
      desc: "Dry run the script",
    },
    verbose: {
      type: "boolean",
      default: false,
      desc: "Print full error messages and stack traces; by default only a short message is shown",
    },
    json: {
      type: "boolean",
      default: false,
      desc: "Output results as a single JSON line (for scripting); exit 0 when no chains need update, 1 otherwise",
    },
  });

async function main() {
  const argv = await parser.argv;

  const privateKey = toPrivateKey(argv.privateKey);
  const chains = argv.chain;
  const targetIndex = argv.targetIndex;

  const contracts = Object.values(DefaultStore.wormhole_contracts).filter(
    (contract) => !chains || chains.includes(contract.getChain().getId()),
  );

  const results = await Promise.all(
    contracts.map((contract) =>
      syncChain(
        contract,
        privateKey,
        targetIndex,
        argv.dryRun,
        argv.verbose,
      ),
    ),
  );

  const rows = results.filter((row): row is Row => row !== undefined);
  if (argv.json) {
    console.log(JSON.stringify({ rows, needRetry: rows.length > 0 }));
    process.exit(rows.length > 0 ? 1 : 0);
  }
  console.table(rows);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
