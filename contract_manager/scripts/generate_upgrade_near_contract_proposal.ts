import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore } from "../src/node/utils/store";
import { loadHotWallet } from "../src/node/utils/governance";
import { NearChain } from "../src/core/chains";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Creates a governance proposal to upgrade the price feeds contract on Near.\n" +
      "Usage: $0 --network <mainnet|testnet> --code-hash <hash> --ops-key-path <ops_key_path>\n",
  )
  .options({
    network: {
      type: "string",
      choices: ["mainnet", "testnet"],
      description: "Network to deploy to",
      demandOption: true,
    },
    "code-hash": {
      type: "string",
      description: "Sha-256 HEX of the wasm file",
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

  // Near wormhole contracts have the same id on testnet and mainnet.
  const chain = DefaultStore.getChainOrThrow("near", NearChain);

  const vault =
    DefaultStore.vaults[
      argv.network === "mainnet"
        ? "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"
        : "devnet_6baWtW1zTUVMSJHJQVxDUXWzqrQeYBr6mu31j3bTKwY3"
    ];

  const codeHash = argv["code-hash"];
  if (Buffer.from(codeHash, "hex").length != 32) {
    throw new Error("invalid code hash format");
  }
  console.log(
    `Upgrading contract on Near ${argv.network} to code hash: ${codeHash}`,
  );

  // Generate governance payload for the upgrade
  const payload = chain.generateGovernanceUpgradePayload(codeHash);
  console.log("Governance payload:", payload);

  // Create and submit governance proposal
  console.log("Using vault for proposal:", vault.getId());
  const keypair = await loadHotWallet(argv["ops-key-path"] as string);
  console.log("Using wallet:", keypair.publicKey.toBase58());
  vault.connect(keypair);
  const proposal = await vault.proposeWormholeMessage([payload]);
  console.log("Proposal address:", proposal.address.toBase58());
}

main().catch((error) => {
  console.error("Error during upgrade:", error);
  process.exit(1);
});
