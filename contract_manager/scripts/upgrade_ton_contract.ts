import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore, loadHotWallet } from "../src";
import { TonChain } from "../src/chains";
import { CHAINS, toChainName } from "@pythnetwork/xc-admin-common";
import { compile } from "@ton/blueprint";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Upgrades the Pyth contract on TON and creates a governance proposal for it.\n" +
      "Usage: $0 --network <mainnet|testnet> --contract-address <address> --ops-key-path <ops_key_path>"
  )
  .options({
    network: {
      type: "string",
      choices: ["mainnet", "testnet"],
      description: "Network to deploy to",
      demandOption: true,
    },
    "contract-address": {
      type: "string",
      description: "Address of the contract to upgrade",
      demandOption: true,
    },
    "ops-key-path": {
      type: "string",
      description: "Path to operations key file",
      demandOption: true,
    },
  });

async function main() {
  const argv = await parser.argv;
  const isMainnet = argv.network === "mainnet";

  // Get chain ID and name from CHAINS mapping
  const chainId = isMainnet ? CHAINS.ton_mainnet : CHAINS.ton_testnet;
  const wormholeChainName = toChainName(chainId);

  // Get the TON chain instance with appropriate RPC URL based on network
  const chain = new TonChain(
    chainId.toString(),
    isMainnet,
    wormholeChainName,
    undefined,
    isMainnet
      ? "https://toncenter.com/api/v2/jsonRPC"
      : "https://testnet.toncenter.com/api/v2/jsonRPC"
  );

  let vaultName: string;
  if (isMainnet) {
    vaultName = "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj";
  } else {
    vaultName = "devnet_6baWtW1zTUVMSJHJQVxDUXWzqrQeYBr6mu31j3bTKwY3";
  }
  const vault = DefaultStore.vaults[vaultName];

  console.log(
    `Upgrading contract on TON ${argv.network} (Chain ID: ${chainId}, Wormhole Chain Name: ${wormholeChainName})`
  );

  console.log("Compiling new contract code...");
  const newCode = await compile("Main");
  const newCodeHash = newCode.hash();
  console.log("New code hash:", newCodeHash.toString("hex"));

  // Generate governance payload for the upgrade
  const payload = chain.generateGovernanceUpgradePayload(
    newCodeHash.toString("hex")
  );
  console.log("Generated governance payload");
  console.log("Payload:", payload);

  // Create and submit governance proposal
  console.log("Using vault for proposal:", vault.getId());
  const wallet = await loadHotWallet(argv["ops-key-path"] as string);
  console.log("Using wallet:", wallet.publicKey.toBase58());
  vault.connect(wallet);
  const proposal = await vault.proposeWormholeMessage([payload]);
  console.log("Proposal address:", proposal.address.toBase58());
}

main().catch((error) => {
  console.error("Error during upgrade:", error);
  process.exit(1);
});
