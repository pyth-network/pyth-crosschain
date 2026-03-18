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

type Row = {
  chainName: string;
  mainnet: boolean;
  startIndex: string;
  endIndex: string;
  error?: string;
};

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
    return {
      chainName: chain.getId(),
      endIndex: String(endIndex),
      mainnet: chain.isMainnet(),
      startIndex: String(startIndex),
    };
  } catch (error) {
    const message =
      verbose && error instanceof Error
        ? error.message
        : error != null && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : "An error occurred";
    if (verbose) {
    }
    return {
      chainName: chain.getId(),
      endIndex: "—",
      error: message.slice(0, 120),
      mainnet: contract.getChain().isMainnet(),
      startIndex: "—",
    };
  }
}

const parser = yargs(hideBin(process.argv))
  .usage("Update the guardian set in stable networks. Usage: $0")
  .options({
    chain: {
      array: true,
      desc: "Can be one of the chains available in the store",
      type: "string",
    },
    "dry-run": {
      default: false,
      desc: "Dry run the script",
      type: "boolean",
    },
    json: {
      default: false,
      desc: "Output results as a single JSON line (for scripting); exit 0 when no chains need update, 1 otherwise",
      type: "boolean",
    },
    "private-key": {
      demandOption: true,
      desc: "Private key to sign the transactions with",
      type: "string",
    },
    "target-index": {
      demandOption: true,
      desc: "Only sync and show contracts whose current guardian set index is below this value",
      type: "number",
    },
    verbose: {
      default: false,
      desc: "Print full error messages and stack traces; by default only a short message is shown",
      type: "boolean",
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
      syncChain(contract, privateKey, targetIndex, argv.dryRun, argv.verbose),
    ),
  );

  const rows = results.filter((row): row is Row => row !== undefined);
  if (argv.json) {
    process.exit(rows.length > 0 ? 1 : 0);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
