import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { SuiChain } from "@pythnetwork/contract-manager/core/chains";
import { SuiPriceFeedContract } from "@pythnetwork/contract-manager/core/contracts/sui";
import { DefaultStore } from "@pythnetwork/contract-manager/node/store";
import { getDefaultDeploymentConfig } from "@pythnetwork/contract-manager/core/base";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { execSync } from "child_process";
import { initPyth, publishPackage } from "./pyth_deploy";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { resolve } from "path";
import {
  buildForBytecodeAndDigest,
  migratePyth,
  upgradePyth,
} from "./upgrade_pyth";

const OPTIONS = {
  "private-key": {
    type: "string",
    demandOption: true,
    desc: "Private key to use to sign transaction",
  },
  contract: {
    type: "string",
    demandOption: true,
    desc: "Contract to use for the command (e.g sui_testnet_0xe8c2ddcd5b10e8ed98e53b12fcf8f0f6fd9315f810ae61fa4001858851f21c88)",
  },
  path: {
    type: "string",
    default: "../../contracts",
    desc: "Path to the sui contracts, will use ../../contracts by default",
  },
  endpoint: {
    type: "string",
    default: "https://hermes.pyth.network",
    desc: "Price service endpoint to use, defaults to https://hermes.pyth.network",
  },
  "feed-id": {
    type: "array",
    demandOption: true,
    desc: "Price feed ids to create without the leading 0x (e.g f9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b). Can be provided multiple times for multiple feed updates",
  },
} as const;

function getContract(contractId: string): SuiPriceFeedContract {
  const contract = DefaultStore.contracts[contractId] as SuiPriceFeedContract;
  if (!contract) {
    throw new Error(`Contract ${contractId} not found`);
  }
  return contract;
}

yargs(hideBin(process.argv))
  .command(
    "create",
    "Create a new price feed",
    (yargs) => {
      return yargs
        .options({
          contract: OPTIONS.contract,
          "feed-id": OPTIONS["feed-id"],
          "private-key": OPTIONS["private-key"],
          endpoint: OPTIONS.endpoint,
        })
        .usage(
          "$0 create --contract <contract-id> --feed-id <feed-id> --private-key <private-key>",
        );
    },
    async (argv) => {
      const contract = getContract(argv.contract);
      const priceService = new PriceServiceConnection(argv.endpoint);
      const feedIds = argv["feed-id"] as string[];
      const vaas = await priceService.getLatestVaas(feedIds);
      const digest = await contract.executeCreatePriceFeed(
        argv["private-key"],
        vaas.map((vaa) => Buffer.from(vaa, "base64")),
      );
      console.log("Transaction successful. Digest:", digest);
    },
  )
  .command(
    "create-all",
    "Create all price feeds for a contract",
    (yargs) => {
      return yargs
        .options({
          contract: OPTIONS.contract,
          "private-key": OPTIONS["private-key"],
          endpoint: OPTIONS.endpoint,
        })
        .usage(
          "$0 create-all --contract <contract-id> --private-key <private-key>",
        );
    },
    async (argv) => {
      const contract = getContract(argv.contract);
      const priceService = new PriceServiceConnection(argv.endpoint);
      const feedIds = await priceService.getPriceFeedIds();
      const BATCH_SIZE = 10;
      for (let i = 0; i < feedIds.length; i += BATCH_SIZE) {
        const batch = feedIds.slice(i, i + BATCH_SIZE);
        const vaas = await priceService.getLatestVaas(batch);
        const digest = await contract.executeCreatePriceFeed(
          argv["private-key"],
          vaas.map((vaa) => Buffer.from(vaa, "base64")),
        );
        console.log("Transaction successful. Digest:", digest);
        console.log(`Progress: ${i + BATCH_SIZE}/${feedIds.length}`);
      }
    },
  )
  .command(
    "generate-digest",
    "Generate digest for a contract",
    (yargs) => {
      return yargs
        .options({
          path: OPTIONS.path,
        })
        .usage("$0 generate-digest --path <path-to-contracts>");
    },
    async (argv) => {
      const buildOutput: {
        modules: string[];
        dependencies: string[];
        digest: number[];
      } = JSON.parse(
        execSync(
          `sui move build --dump-bytecode-as-base64 --path ${__dirname}/${argv.path} 2> /dev/null`,
          {
            encoding: "utf-8",
          },
        ),
      );
      console.log("Contract digest:");
      console.log(Buffer.from(buildOutput.digest).toString("hex"));
    },
  )
  .command(
    "deploy",
    "Deploy a contract",
    (yargs) => {
      return yargs
        .options({
          "private-key": OPTIONS["private-key"],
          chain: {
            type: "string",
            demandOption: true,
            desc: "Chain to deploy the code to. Can be sui_mainnet or sui_testnet",
          },
          path: OPTIONS.path,
        })
        .usage(
          "$0 deploy --private-key <private-key> --chain [sui_mainnet|sui_testnet] --path <path-to-contracts>",
        );
    },
    async (argv) => {
      const walletPrivateKey = argv["private-key"];
      const chain = DefaultStore.chains[argv.chain] as SuiChain;
      const keypair = Ed25519Keypair.fromSecretKey(
        new Uint8Array(Buffer.from(walletPrivateKey, "hex")),
      );
      const result = await publishPackage(
        keypair,
        chain.getProvider(),
        argv.path,
      );
      const deploymentType = chain.isMainnet() ? "stable" : "beta";
      const config = getDefaultDeploymentConfig(deploymentType);
      await initPyth(
        keypair,
        chain.getProvider(),
        result.packageId,
        result.deployerCapId,
        result.upgradeCapId,
        config,
      );
    },
  )
  .command(
    "update-feeds",
    "Update price feeds for a contract",
    (yargs) => {
      return yargs
        .options({
          contract: OPTIONS.contract,
          "feed-id": OPTIONS["feed-id"],
          "private-key": OPTIONS["private-key"],
          endpoint: OPTIONS.endpoint,
        })
        .usage(
          "$0 update-feeds --contract <contract-id> --feed-id <feed-id> --private-key <private-key>",
        );
    },
    async (argv) => {
      const contract = getContract(argv.contract);
      const priceService = new PriceServiceConnection(argv.endpoint);
      const feedIds = argv["feed-id"] as string[];
      const vaas = await priceService.getLatestVaas(feedIds);
      const digest = await contract.executeUpdatePriceFeedWithFeeds(
        argv["private-key"],
        vaas.map((vaa) => Buffer.from(vaa, "base64")),
        feedIds,
      );
      console.log("Transaction successful. Digest:", digest);
    },
  )
  .command(
    "upgrade",
    "Upgrade a contract",
    (yargs) => {
      return yargs
        .options({
          "private-key": OPTIONS["private-key"],
          contract: OPTIONS.contract,
          vaa: {
            type: "string",
            demandOption: true,
            desc: "Signed Vaa for upgrading the package in hex format",
          },
          path: OPTIONS.path,
        })
        .usage(
          "$0 upgrade --private-key <private-key> --contract <contract-id> --vaa <upgrade-vaa>",
        );
    },
    async (argv) => {
      const contract = getContract(argv.contract);
      const keypair = Ed25519Keypair.fromSecretKey(
        new Uint8Array(Buffer.from(argv["private-key"], "hex")),
      );

      const pythContractsPath = resolve(`${__dirname}/${argv.path}`);

      // Build for modules and dependencies
      const { modules, dependencies, digest } =
        buildForBytecodeAndDigest(pythContractsPath);
      //Execute upgrade with signed governance VAA.
      console.log("Digest is", digest.toString("hex"));
      const pythPackageOld = await contract.getPackageId(contract.stateId);
      console.log("Old package id:", pythPackageOld);
      const signedVaa = Buffer.from(argv.vaa, "hex");
      const upgradeResults = await upgradePyth(
        keypair,
        contract.chain.getProvider(),
        modules,
        dependencies,
        signedVaa,
        contract,
      );
      console.log("Tx digest", upgradeResults.digest);
      if (
        !upgradeResults.effects ||
        upgradeResults.effects.status.status !== "success"
      ) {
        throw new Error("Upgrade failed");
      }

      console.log(
        "Upgrade successful, Executing the migrate function in a separate transaction...",
      );

      // We can not do the migration in the same transaction since the newly published package is not found
      // on chain at the beginning of the transaction.

      const migrateResults = await migratePyth(
        keypair,
        contract.chain.getProvider(),
        signedVaa,
        contract,
        pythPackageOld,
      );
      console.log("Tx digest", migrateResults.digest);
      if (
        !migrateResults.effects ||
        migrateResults.effects.status.status !== "success"
      ) {
        throw new Error(
          `Migrate failed. Old package id is ${pythPackageOld}. Please do the migration manually`,
        );
      }
      console.log("Migrate successful");
    },
  )
  .demandCommand().argv;
