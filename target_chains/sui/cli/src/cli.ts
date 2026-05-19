import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  getDefaultDeploymentConfig,
  toDeploymentType,
} from "@pythnetwork/contract-manager/core/base";
import type { SuiChain } from "@pythnetwork/contract-manager/core/chains";
import type { SuiPriceFeedContract } from "@pythnetwork/contract-manager/core/contracts/sui";
import { DefaultStore } from "@pythnetwork/contract-manager/node/utils/store";
import { HermesClient } from "@pythnetwork/hermes-client";
import { execSync } from "child_process";
import { resolve } from "path";
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
    desc: "Contract to use for the command (e.g sui_testnet_0xe8c2ddcd5b10e8ed98e53b12fcf8f0f6fd9315f810ae61fa4001858851f21c88)",
    type: "string",
  },
  endpoint: {
    default: "https://hermes.pyth.network",
    desc: "Price service endpoint to use, defaults to https://hermes.pyth.network",
    type: "string",
  },
  "endpoint-access-token": {
    demandOption: false,
    desc: "Access token to use for the endpoint",
    type: "string",
  },
  "feed-id": {
    demandOption: true,
    desc: "Price feed ids to create without the leading 0x (e.g f9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b). Can be provided multiple times for multiple feed updates",
    type: "array",
  },
  path: {
    default: "../../contracts",
    desc: "Path to the sui contracts, will use ../../contracts by default",
    type: "string",
  },
  "private-key": {
    demandOption: true,
    desc: "Private key to use to sign transaction",
    type: "string",
  },
} as const;

function getContract(contractId: string): SuiPriceFeedContract {
  const contract = DefaultStore.contracts[contractId] as SuiPriceFeedContract;
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
          "endpoint-access-token": OPTIONS["endpoint-access-token"],
          "feed-id": OPTIONS["feed-id"],
          "private-key": OPTIONS["private-key"],
        })
        .usage(
          "$0 create --contract <contract-id> --feed-id <feed-id> --private-key <private-key>",
        );
    },
    async (argv) => {
      const contract = getContract(argv.contract);
      const hermesClientConfig = argv["endpoint-access-token"]
        ? { accessToken: argv["endpoint-access-token"] }
        : undefined;
      const client = new HermesClient(argv.endpoint, hermesClientConfig);
      const feedIds = argv["feed-id"] as string[];
      const priceUpdates = await client.getLatestPriceUpdates(feedIds, {
        parsed: false,
      });
      const digest = await contract.executeCreatePriceFeed(
        argv["private-key"],
        priceUpdates.binary.data.map((update) => Buffer.from(update, "hex")),
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
          endpoint: OPTIONS.endpoint,
          "endpoint-access-token": OPTIONS["endpoint-access-token"],
          "private-key": OPTIONS["private-key"],
        })
        .usage(
          "$0 create-all --contract <contract-id> --private-key <private-key>",
        );
    },
    async (argv) => {
      const contract = getContract(argv.contract);
      const hermesClientConfig = argv["endpoint-access-token"]
        ? { accessToken: argv["endpoint-access-token"] }
        : undefined;
      const client = new HermesClient(argv.endpoint, hermesClientConfig);
      const priceFeeds = await client.getPriceFeeds();
      const feedIds = priceFeeds.map((feed) => feed.id);
      const BATCH_SIZE = 10;
      for (let i = 0; i < feedIds.length; i += BATCH_SIZE) {
        const batch = feedIds.slice(i, i + BATCH_SIZE);
        const priceUpdates = await client.getLatestPriceUpdates(batch, {
          parsed: false,
        });
        const digest = await contract.executeCreatePriceFeed(
          argv["private-key"],
          priceUpdates.binary.data.map((update) => Buffer.from(update, "hex")),
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
          chain: {
            demandOption: true,
            desc: "Chain to deploy the code to. Can be sui_mainnet or sui_testnet",
            type: "string",
          },
          "deployment-type": {
            demandOption: true,
            desc: "Deployment type to use. Can be 'stable', 'beta', 'pro-compatible-staging', or 'pro-compatible-production'",
            type: "string",
          },
          path: OPTIONS.path,
          "private-key": OPTIONS["private-key"],
        })
        .usage(
          "$0 deploy --private-key <private-key> --chain [sui_mainnet|sui_testnet] --path <path-to-contracts> --deployment-type <deployment-type>",
        );
    },
    async (argv) => {
      const walletPrivateKey = argv["private-key"];
      const chain = DefaultStore.chains[argv.chain] as SuiChain;
      const keypair = Ed25519Keypair.fromSecretKey(
        new Uint8Array(Buffer.from(walletPrivateKey, "hex")),
      );
      const deploymentType = toDeploymentType(argv["deployment-type"]);
      const result = await publishPackage(
        keypair,
        chain.getProvider(),
        argv.path,
      );
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
          "endpoint-access-token": OPTIONS["endpoint-access-token"],
          "feed-id": OPTIONS["feed-id"],
          "private-key": OPTIONS["private-key"],
        })
        .usage(
          "$0 update-feeds --contract <contract-id> --feed-id <feed-id> --private-key <private-key>",
        );
    },
    async (argv) => {
      const contract = getContract(argv.contract);
      const hermesClientConfig = argv["endpoint-access-token"]
        ? { accessToken: argv["endpoint-access-token"] }
        : undefined;
      const client = new HermesClient(argv.endpoint, hermesClientConfig);
      const feedIds = argv["feed-id"] as string[];
      const priceUpdates = await client.getLatestPriceUpdates(feedIds, {
        parsed: false,
      });
      const digest = await contract.executeUpdatePriceFeedWithFeeds(
        argv["private-key"],
        priceUpdates.binary.data.map((update) => Buffer.from(update, "hex")),
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
