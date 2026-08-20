/** biome-ignore-all lint/suspicious/noConsole: CLI script */

/**
 * Reports whether EVM chains are ready for a Pyth Pro cutover proposal.
 *
 * Read-only: it deploys nothing, proposes nothing and writes nothing. Run it before committing to
 * a batch to see which chains are ready, which are blocked, and which still need a Pro wormhole
 * receiver deployed.
 *
 * Usage: $0 --all-chains [--testnet] [--deployment-type pro-compatible-production]
 *        $0 --chain ethereum --chain arbitrum
 */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { toDeploymentType } from "../src/core/base";
import { CHAIN_SELECTION_OPTIONS, getSelectedChains } from "./common";
import type { ChainStatus, CutoverPreflight } from "./pro_cutover";
import { isProDeploymentType, preflightChains, statusOf } from "./pro_cutover";

const parser = yargs(hideBin(process.argv))
  .scriptName("preflight_evm_pro_cutover.ts")
  .usage(
    "Reports which EVM chains are ready for a Pyth Pro cutover proposal.\n" +
      "Read-only: deploys nothing, proposes nothing, writes nothing.\n" +
      "Usage: $0 (--all-chains [--testnet] | --chain <chain>...) [--deployment-type <type>]",
  )
  .options({
    ...CHAIN_SELECTION_OPTIONS,
    "deployment-type": {
      default: "pro-compatible-production",
      desc: "The pro-compatible deployment being cut over to",
      type: "string",
    },
    verbose: {
      default: false,
      desc: "Print the per-proxy state for every chain, not just blocked ones",
      type: "boolean",
    },
  });

function printChainDetail(result: CutoverPreflight, verbose: boolean): void {
  const interesting =
    result.blockers.length > 0 || result.warnings.length > 0 || verbose;
  if (!interesting) return;

  console.log(`\n${result.chain.getId()} [${statusOf(result)}]`);
  if (verbose) {
    console.log(
      `  pro wormhole: ${result.proWormhole?.address ?? "none in store"}`,
    );
    console.log(
      `  legacy proxies in store: ${result.legacyContracts.length}, read: ${result.legacyProxies.length}`,
    );
    for (const proxy of result.legacyProxies) {
      console.log(
        `  proxy ${proxy.contract.address}` +
          ` wormhole=${proxy.wormholeAddress}` +
          ` proWormhole=${proxy.usesProWormhole}` +
          ` proDataSources=${proxy.usesProDataSources}` +
          ` fee=${proxy.singleUpdateFeeInWei}`,
      );
    }
  }
  for (const blocker of result.blockers) console.log(`  ✗ ${blocker}`);
  for (const warning of result.warnings) console.log(`  ! ${warning}`);
}

async function main() {
  const argv = await parser.argv;
  const deploymentType = toDeploymentType(argv.deploymentType);
  if (!isProDeploymentType(deploymentType)) {
    throw new Error(
      `--deployment-type must be pro-compatible-production or pro-compatible-staging, got ${deploymentType}`,
    );
  }

  const selectedChains = getSelectedChains(argv);
  console.log(
    `Checking ${selectedChains.length} chain(s) against ${deploymentType}...`,
  );

  const results = await preflightChains(selectedChains, deploymentType);

  const idWidth = Math.max(
    ...results.map((result) => result.chain.getId().length),
    5,
  );
  const proxyCount = (result: CutoverPreflight): string =>
    result.legacyProxies.length === result.legacyContracts.length
      ? String(result.legacyContracts.length)
      : `${result.legacyProxies.length}/${result.legacyContracts.length}`;
  console.log(
    `\n${"chain".padEnd(idWidth)}  proxies  receiver  status`.toUpperCase(),
  );
  for (const result of results) {
    console.log(
      `${result.chain.getId().padEnd(idWidth)}  ` +
        `${proxyCount(result).padStart(7)}  ` +
        `${(result.proWormhole ? "yes" : "no").padStart(8)}  ` +
        `${statusOf(result)}` +
        `${result.warnings.length > 0 ? ` (${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"})` : ""}`,
    );
  }

  for (const result of results) printChainDetail(result, argv.verbose);

  const counts = new Map<ChainStatus, number>();
  for (const result of results) {
    const status = statusOf(result);
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  console.log("\nSummary");
  for (const status of [
    "READY",
    "NEEDS RECEIVER",
    "MIGRATED",
    "BLOCKED",
  ] as ChainStatus[]) {
    console.log(`  ${status.padEnd(15)} ${counts.get(status) ?? 0}`);
  }
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
