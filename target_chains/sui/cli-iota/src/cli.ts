import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { getDefaultDeploymentConfig } from "@pythnetwork/contract-manager/core/base";
import type { IotaChain } from "@pythnetwork/contract-manager/core/chains";
import type { IotaPriceFeedContract } from "@pythnetwork/contract-manager/core/contracts/iota";
import { DefaultStore } from "@pythnetwork/contract-manager/node/utils/store";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import createCLI from "yargs";
import { hideBin } from "yargs/helpers";
import { initPyth, publishPackage } from "./pyth_deploy.js";
import {
  buildForBytecodeAndDigest,
  migratePyth,
  upgradePyth,
} from "./upgrade_pyth.js";

const OPTIONS = {
  contract: {
    demandOption: true,
    desc: "Contract to use for the command (e.g iota_0x68dda579251917b3db28e35c4df495c6e664ccc085ede867a9b773c8ebedc2c1)",
    type: "string",
  },
  endpoint: {
    default: "https://hermes.pyth.network",
    desc: "Price service endpoint to use, defaults to https://hermes.pyth.network",
    type: "string",
  },
  "feed-id": {
    demandOption: true,
    desc: "Price feed ids to create without the leading 0x (e.g f9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b). Can be provided multiple times for multiple feed updates",
    type: "array",
  },
  path: {
    default: "../../contracts",
    desc: "Path to the iota contracts, will use ../../contracts by default",
    type: "string",
  },
  "private-key": {
    demandOption: true,
    desc: "Private key to use to sign transaction",
    type: "string",
  },
} as const;

function getContract(contractId: string): IotaPriceFeedContract {
  const contract = DefaultStore.contracts[contractId] as IotaPriceFeedContract;
  if (!contract) {
    throw new Error(`Contract ${contractId} not found`);
  }
  return contract;
}

const yargs = createCLI(hideBin(process.argv));

yargs
  .command(
    "create",
    "Create a new price feed",
    (yargs) => {
      return yargs
        .options({
          contract: OPTIONS.contract,
          endpoint: OPTIONS.endpoint,
          "feed-id": OPTIONS["feed-id"],
          "private-key": OPTIONS["private-key"],
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
      const _digest = await contract.executeCreatePriceFeed(
        argv["private-key"],
        vaas.map((vaa) => Buffer.from(vaa, "base64")),
      );
    },
  )
  .command(
    "create-all",
    "Create all price feeds for a contract",
    (yargs) => {
      return yargs
        .options({
          contract: OPTIONS.contract,
          endpoint: OPTIONS.endpoint,
          "private-key": OPTIONS["private-key"],
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
        const _digest = await contract.executeCreatePriceFeed(
          argv["private-key"],
          vaas.map((vaa) => Buffer.from(vaa, "base64")),
        );
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
      const _buildOutput: {
        modules: string[];
        dependencies: string[];
        digest: number[];
      } = JSON.parse(
        execSync(
          `iota move build --dump-bytecode-as-base64 --path ${__dirname}/${argv.path} 2> /dev/null`,
          {
            encoding: "utf-8",
          },
        ),
      );
    },
  )
  .command(
    "deploy",
    "Deploy a contract",
    (yargs) => {
      return yargs
        .options({
          chain: {
            demandOption: true,
            desc: "Chain to deploy the code to. Can be iota_mainnet or iota_testnet",
            type: "string",
          },
          path: OPTIONS.path,
          "private-key": OPTIONS["private-key"],
        })
        .usage(
          "$0 deploy --private-key <private-key> --chain [iota_mainnet|iota_testnet] --path <path-to-contracts>",
        );
    },
    async (argv) => {
      const walletPrivateKey = argv["private-key"];
      const chain = DefaultStore.chains[argv.chain] as IotaChain;
      const keypair = Ed25519Keypair.fromSecretKey(
        new Uint8Array(Buffer.from(walletPrivateKey, "hex")),
      );
      const result = await publishPackage(
        keypair,
        chain.getProvider(),
        argv.path,
      );
      const deploymentType = "stable";
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
          endpoint: OPTIONS.endpoint,
          "feed-id": OPTIONS["feed-id"],
          "private-key": OPTIONS["private-key"],
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
      const _digest = await contract.executeUpdatePriceFeedWithFeeds(
        argv["private-key"],
        vaas.map((vaa) => Buffer.from(vaa, "base64")),
        feedIds,
      );
    },
  )
  .command(
    "upgrade",
    "Upgrade a contract",
    (yargs) => {
      return yargs
        .options({
          contract: OPTIONS.contract,
          path: OPTIONS.path,
          "private-key": OPTIONS["private-key"],
          vaa: {
            demandOption: true,
            desc: "Signed Vaa for upgrading the package in hex format",
            type: "string",
          },
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
      const pythPackageOld = await contract.getPackageId(contract.stateId);
      const signedVaa = Buffer.from(argv.vaa, "hex");
      const upgradeResults = await upgradePyth(
        keypair,
        contract.chain.getProvider(),
        modules,
        dependencies,
        signedVaa,
        contract,
      );
      if (
        !upgradeResults.effects ||
        upgradeResults.effects.status.status !== "success"
      ) {
        throw new Error("Upgrade failed");
      }

      // We can not do the migration in the same transaction since the newly published package is not found
      // on chain at the beginning of the transaction.

      const migrateResults = await migratePyth(
        keypair,
        contract.chain.getProvider(),
        signedVaa,
        contract,
        pythPackageOld,
      );
      if (
        !migrateResults.effects ||
        migrateResults.effects.status.status !== "success"
      ) {
        throw new Error(
          `Migrate failed. Old package id is ${pythPackageOld}. Please do the migration manually`,
        );
      }
    },
  )
  .demandCommand().argv;
