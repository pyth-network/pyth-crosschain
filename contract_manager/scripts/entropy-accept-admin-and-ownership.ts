import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore, EvmChain, loadHotWallet, createStore } from "../src";
import { COMMON_STORE_OPTIONS } from "./common";

interface ArgV {
  testnet: boolean;
  "all-chains": boolean;
  chain?: string[];
  "ops-key-path": string;
  "store-dir"?: string;
}

const parser = yargs(hideBin(process.argv))
  .usage(
    "Creates governance proposal to accept pending admin or ownership transfer for Pyth entropy contracts.\n" +
      "Usage: $0 --chain <chain_1> --chain <chain_2> --ops-key-path <ops_key_path> [--store-dir <store-dir>]"
  )
  .options({
    ...COMMON_STORE_OPTIONS,
    testnet: {
      type: "boolean",
      default: false,
      desc: "Accept for testnet contracts instead of mainnet",
    },
    "all-chains": {
      type: "boolean",
      default: false,
      desc: "Accept for contract on all chains. Use with --testnet flag to accept for all testnet contracts",
    },
    chain: {
      type: "array",
      string: true,
      desc: "Accept for contract on given chains",
    },
    "ops-key-path": {
      type: "string",
      demandOption: true,
      desc: "Path to the private key of the proposer to use for the operations multisig governance proposal",
    },
  });

async function main() {
  const argv = (await parser.argv) as ArgV;
  const store = createStore(argv["store-dir"]);
  const selectedChains: EvmChain[] = [];

  if (argv["all-chains"] && argv.chain)
    throw new Error("Cannot use both --all-chains and --chain");
  if (!argv["all-chains"] && !argv.chain)
    throw new Error("Must use either --all-chains or --chain");
  for (const chain of Object.values(store.chains)) {
    if (!(chain instanceof EvmChain)) continue;
    if (
      (argv["all-chains"] && chain.isMainnet() !== argv.testnet) ||
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
    store.vaults["mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"];

  const payloads: Buffer[] = [];
  for (const contract of Object.values(store.entropy_contracts)) {
    if (selectedChains.includes(contract.chain)) {
      console.log("Creating payload for chain: ", contract.chain.getId());
      const pendingOwner = await contract.getPendingOwner();
      const adminPayload = contract.generateAcceptAdminPayload(pendingOwner);
      const ownerPayload =
        contract.generateAcceptOwnershipPayload(pendingOwner);

      payloads.push(adminPayload, ownerPayload);
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
