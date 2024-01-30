import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore, EvmChain, loadHotWallet, toPrivateKey } from "../src";
import { existsSync, readFileSync, writeFileSync } from "fs";

const CACHE_FILE = ".cache-upgrade-evm-executor-contract";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Deploys a new ExecutorUpgradeable contract to a set of chains where Entropy is deployed and creates a governance proposal for it.\n" +
      `Uses a cache file (${CACHE_FILE}) to avoid deploying contracts twice\n` +
      "Usage: $0 --chain <chain_1> --chain <chain_2> --private-key <private_key> --ops-key-path <ops_key_path> --std-output <std_output>"
  )
  .options({
    testnet: {
      type: "boolean",
      default: false,
      desc: "Upgrade testnet contracts instead of mainnet",
    },
    "all-chains": {
      type: "boolean",
      default: false,
      desc: "Upgrade the contract on all chains. Use with --testnet flag to upgrade all testnet contracts",
    },
    chain: {
      type: "array",
      string: true,
      desc: "Chains to upgrade the contract on",
    },
    "private-key": {
      type: "string",
      demandOption: true,
      desc: "Private key to use for the deployment",
    },
    "ops-key-path": {
      type: "string",
      demandOption: true,
      desc: "Path to the private key of the proposer to use for the operations multisig governance proposal",
    },
    "std-output": {
      type: "string",
      demandOption: true,
      desc: "Path to the standard JSON output of the pyth contract (build artifact)",
    },
  });

async function runIfNotCached(
  cacheKey: string,
  fn: () => Promise<string>
): Promise<string> {
  const cache = existsSync(CACHE_FILE)
    ? JSON.parse(readFileSync(CACHE_FILE, "utf8"))
    : {};
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }
  const result = await fn();
  cache[cacheKey] = result;
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  return result;
}

async function main() {
  const argv = await parser.argv;
  const selectedChains: EvmChain[] = [];

  if (argv.allChains && argv.chain)
    throw new Error("Cannot use both --all-chains and --chain");
  if (!argv.allChains && !argv.chain)
    throw new Error("Must use either --all-chains or --chain");
  for (const chain of Object.values(DefaultStore.chains)) {
    if (!(chain instanceof EvmChain)) continue;
    if (
      (argv.allChains && chain.isMainnet() !== argv.testnet) ||
      argv.chain?.includes(chain.getId())
    )
      selectedChains.push(chain);
  }
  if (argv.chain && selectedChains.length !== argv.chain.length)
    throw new Error(
      `Some chains were not found ${selectedChains
        .map((chain) => chain.getId())
        .toString()}`
    );
  for (const chain of selectedChains) {
    if (chain.isMainnet() != selectedChains[0].isMainnet())
      throw new Error("All chains must be either mainnet or testnet");
  }

  const vault =
    DefaultStore.vaults[
      "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"
    ];

  console.log("Using cache file", CACHE_FILE);
  // console.log(
  //   "Upgrading on chains",
  //   selectedChains.map((c) => c.getId())
  // );

  const payloads: Buffer[] = [];
  for (const contract of Object.values(DefaultStore.entropy_contracts)) {
    if (selectedChains.includes(contract.chain)) {
      const artifact = JSON.parse(readFileSync(argv["std-output"], "utf8"));
      console.log("Deploying contract to", contract.chain.getId());
      const address = await runIfNotCached(
        `deploy-${contract.chain.getId()}`,
        () => {
          return contract.chain.deploy(
            toPrivateKey(argv["private-key"]),
            artifact["abi"],
            artifact["bytecode"],
            [],
            2
          );
        }
      );
      console.log(
        `Deployed contract at ${address} on ${contract.chain.getId()}`
      );
      const payload = await contract.generateUpgradeExecutorContractsPayload(
        address
      );
      console.log(payload.toString("hex"));
      payloads.push(payload);
    }
  }

  console.log("Using vault at for proposal", vault.getId());
  const wallet = await loadHotWallet(argv["ops-key-path"]);
  console.log("Using wallet ", wallet.publicKey.toBase58());
  await vault.connect(wallet);
  const proposal = await vault.proposeWormholeMessage(payloads);
  console.log("Proposal address", proposal.address.toBase58());
}

main();
