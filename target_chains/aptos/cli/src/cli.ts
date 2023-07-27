#!/usr/bin/env node

import type { CommandBuilder } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { spawnSync } from "child_process";
import { AptosAccount, AptosClient, BCS, TxnBuilderTypes } from "aptos";
import fs from "fs";
import sha3 from "js-sha3";
import { ethers } from "ethers";

const LOCALNET: string = "localnet";
const TESTNET: string = "testnet";
const MAINNET: string = "mainnet";

interface Network {
  // RPC endpoint of the network
  endpoint: string;
  // Private key of the network
  key: string | undefined;
  // Address of the Pyth deployer contract
  deployer: string;
  // The Pyth deployer contract seed used to generate the derived address of the Pyth contract
  pythDeployerSeed: string;
}

const network = {
  alias: "n",
  describe: "network",
  type: "string",
  choices: [LOCALNET, TESTNET, MAINNET],
  required: true,
} as const;

interface Package {
  meta_file: string;
  mv_files: string[];
}

interface PackageBCS {
  meta: Uint8Array;
  bytecodes: Uint8Array;
  codeHash: Uint8Array;
}

const networks = new Map<string, Network>([
  [
    LOCALNET,
    {
      key: process.env["APTOS_LOCALNET_KEY"],
      endpoint: "http://0.0.0.0:8080",
      deployer:
        "0x277fa055b6a73c42c0662d5236c65c864ccbf2d4abd21f174a30c8b786eab84b",
      pythDeployerSeed: "pyth",
    },
  ],
  [
    TESTNET,
    {
      key: process.env["APTOS_TESTNET_KEY"],
      endpoint: "https://fullnode.testnet.aptoslabs.com/v1",
      deployer:
        "0x3bda7d07b2c9ec5bb282102ee2ca0c40163bd8d6d8ceb6c4efab1deeec261ebc",
      // A Wormhole redeploy meant we had to use different seeds for testnet and mainnet
      pythDeployerSeed: "pyth-gasgas",
    },
  ],
  [
    MAINNET,
    {
      key: process.env["APTOS_MAINNET_KEY"],
      endpoint: "https://fullnode.mainnet.aptoslabs.com/v1",
      deployer:
        "0xb31e712b26fd295357355f6845e77c888298636609e93bc9b05f0f604049f434",
      pythDeployerSeed: "pyth-a8d0d",
    },
  ],
]);

export const command: string = "aptos <command>";

export const builder: CommandBuilder = (yargs) =>
  yargs
    .command(
      "deploy <package-dir> <account>",
      "Deploy a package",
      (yargs) => {
        return yargs
          .positional("package-dir", { type: "string" })
          .positional("account", { type: "string" })
          .option("named-addresses", { type: "string" })
          .option("network", network);
      },
      async (argv) => {
        const artefact = serializePackage(
          buildPackage(argv["package-dir"]!, argv["named-addresses"])
        );
        const txPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
          TxnBuilderTypes.EntryFunction.natural(
            "0x1::code",
            "publish_package_txn",
            [],
            [artefact.meta, artefact.bytecodes]
          )
        );

        await executeTransaction(argv.network, txPayload);
      }
    )
    .command(
      "deploy-resource <package-dir> <seed>",
      "Deploy a package using a resource account. This command is used for deploying the pyth package.",
      (yargs) => {
        return yargs
          .positional("package-dir", { type: "string" })
          .positional("seed", { type: "string" })
          .option("named-addresses", { type: "string" })
          .option("network", network);
      },
      async (argv) => {
        const artefact = serializePackage(
          buildPackage(argv["package-dir"]!, argv["named-addresses"])
        );
        const txPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
          TxnBuilderTypes.EntryFunction.natural(
            networks.get(argv.network)!.deployer + "::deployer",
            "deploy_derived",
            [],
            [
              artefact.meta,
              artefact.bytecodes,
              BCS.bcsSerializeBytes(Buffer.from(argv["seed"]!, "ascii")),
            ]
          )
        );

        await executeTransaction(argv.network, txPayload);
      }
    )
    .command(
      "derived-address <seed>",
      "Generate the derived address for the given deployer seed",
      (yargs) => {
        return yargs
          .positional("seed", { type: "string" })
          .option("network", network);
      },
      async (argv) => {
        console.log(
          generateDerivedAddress(
            networks.get(argv.network)!.deployer,
            argv.seed!
          )
        );
      }
    )
    .command(
      "init-wormhole",
      "Init Wormhole core contract",
      (yargs) => {
        return yargs
          .option("network", network)
          .option("chain-id", {
            describe: "Chain id",
            type: "number",
            default: 22,
            required: false,
          })
          .option("governance-chain-id", {
            describe: "Governance chain id",
            type: "number",
            default: 1,
            required: false,
          })
          .option("governance-address", {
            describe: "Governance address",
            type: "string",
            default:
              "0x0000000000000000000000000000000000000000000000000000000000000004",
            required: false,
          })
          .option("guardian-address", {
            alias: "g",
            required: true,
            describe: "Initial guardian's address",
            type: "string",
          });
      },
      async (argv) => {
        const guardian_address = evm_address(
          argv["guardian-address"]
        ).substring(24);
        const chain_id = argv["chain-id"];
        const governance_address = evm_address(argv["governance-address"]);
        const governance_chain_id = argv["governance-chain-id"];

        const guardian_addresses_serializer = new BCS.Serializer();
        guardian_addresses_serializer.serializeU32AsUleb128(1);
        guardian_addresses_serializer.serializeBytes(
          Buffer.from(guardian_address, "hex")
        );

        const args = [
          BCS.bcsSerializeUint64(chain_id),
          BCS.bcsSerializeUint64(governance_chain_id),
          BCS.bcsSerializeBytes(Buffer.from(governance_address, "hex")),
          guardian_addresses_serializer.getBytes(),
        ];
        const wormholeAddress = generateDerivedAddress(
          networks.get(argv.network)!.deployer!,
          "wormhole"
        );
        const txPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
          TxnBuilderTypes.EntryFunction.natural(
            `${wormholeAddress}::wormhole`,
            "init_2",
            [],
            args
          )
        );

        await executeTransaction(argv.network, txPayload);
      }
    )
    .command(
      "init-pyth",
      "Init Pyth contract",
      (yargs) => {
        return yargs
          .option("network", network)
          .option("stale-price-threshold", {
            describe: "Stale price threshold",
            type: "number",
            required: true,
          })
          .option("governance-emitter-chain-id", {
            describe: "Governance emitter chain id",
            type: "number",
            required: true,
          })
          .option("governance-emitter-address", {
            describe: "Governance emitter address",
            type: "string",
            required: true,
          })
          .option("update-fee", {
            describe: "Update fee",
            type: "number",
            required: true,
          })
          .option("data-source-chain-ids", {
            describe: "Data source chain IDs",
            type: "array",
            required: true,
          })
          .option("data-source-emitter-addresses", {
            describe: "Data source emitter addresses",
            type: "array",
            required: true,
          });
      },
      async (argv) => {
        const stale_price_threshold = argv["stale-price-threshold"];
        const governance_emitter_chain_id = argv["governance-emitter-chain-id"];
        const governance_emitter_address = evm_address(
          argv["governance-emitter-address"]
        );

        const dataSourceChainIdsSerializer = new BCS.Serializer();
        dataSourceChainIdsSerializer.serializeU32AsUleb128(
          argv["data-source-chain-ids"].length
        );
        argv["data-source-chain-ids"].forEach((chain_id) =>
          dataSourceChainIdsSerializer.serializeU64(chain_id as number)
        );

        const dataSourceEmitterAddressesSerializer = new BCS.Serializer();
        dataSourceEmitterAddressesSerializer.serializeU32AsUleb128(
          argv["data-source-emitter-addresses"].length
        );
        argv["data-source-emitter-addresses"].forEach((emitter_address) => {
          dataSourceEmitterAddressesSerializer.serializeBytes(
            Buffer.from(emitter_address as string, "hex")
          );
        });
        const update_fee = argv["update-fee"];

        const args = [
          BCS.bcsSerializeUint64(stale_price_threshold),
          BCS.bcsSerializeUint64(governance_emitter_chain_id),
          BCS.bcsSerializeBytes(Buffer.from(governance_emitter_address, "hex")),
          dataSourceChainIdsSerializer.getBytes(),
          dataSourceEmitterAddressesSerializer.getBytes(),
          BCS.bcsSerializeUint64(update_fee),
        ];
        const pythAddress = generateDerivedAddress(
          networks.get(argv.network)!.deployer!,
          networks.get(argv.network)!.pythDeployerSeed!
        );
        const txPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
          TxnBuilderTypes.EntryFunction.natural(
            `${pythAddress}::pyth`,
            "init",
            [],
            args
          )
        );

        await executeTransaction(argv.network, txPayload);
      }
    )
    .command(
      "hash-contracts <package-dir>",
      "Hash contract bytecodes for upgrade",
      (yargs) => {
        return yargs
          .positional("package-dir", {
            type: "string",
            required: true,
          })
          .option("named-addresses", { type: "string" });
      },
      (argv) => {
        const p = buildPackage(argv["package-dir"]!, argv["named-addresses"]);
        const b = serializePackage(p);
        console.log(Buffer.from(b.codeHash).toString("hex"));
      }
    )
    .command(
      "upgrade <package-dir>",
      "Perform Pyth contract upgrade after governance VAA has been submitted",
      (_yargs) => {
        return yargs
          .positional("package-dir", {
            type: "string",
            required: true,
          })
          .option("network", network)
          .option("named-addresses", { type: "string" });
      },
      async (argv) => {
        const artefact = serializePackage(
          buildPackage(argv["package-dir"]!, argv["named-addresses"])
        );

        let pythAddress = generateDerivedAddress(
          networks.get(argv.network)!.deployer!,
          networks.get(argv.network)!.pythDeployerSeed!
        );
        const txPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
          TxnBuilderTypes.EntryFunction.natural(
            `${pythAddress}::contract_upgrade`,
            "do_contract_upgrade",
            [],
            [artefact.meta, artefact.bytecodes]
          )
        );

        await executeTransaction(argv.network, txPayload);
      }
    )
    .command(
      "execute-governance <vaa-bytes>",
      "Execute a governance instruction on the Pyth contract",
      (_yargs) => {
        return yargs
          .positional("vaa-bytes", {
            type: "string",
          })
          .option("network", network);
      },
      async (argv) => {
        let pythAddress = generateDerivedAddress(
          networks.get(argv.network)!.deployer!,
          networks.get(argv.network)!.pythDeployerSeed!
        );
        const txPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
          TxnBuilderTypes.EntryFunction.natural(
            `${pythAddress}::governance`,
            "execute_governance_instruction",
            [],
            [BCS.bcsSerializeBytes(Buffer.from(argv.vaaBytes!, "hex"))]
          )
        );

        await executeTransaction(argv.network, txPayload);
      }
    )
    .demandCommand();

async function executeTransaction(
  network: string,
  txPayload: TxnBuilderTypes.TransactionPayloadEntryFunction
) {
  const client = new AptosClient(networks.get(network)!.endpoint);
  if (networks.get(network)!.key === undefined) {
    throw new Error("No key for network " + network);
  }
  const sender = new AptosAccount(
    new Uint8Array(Buffer.from(networks.get(network)!.key!, "hex"))
  );
  console.log(
    await client.generateSignSubmitWaitForTransaction(sender, txPayload, {
      maxGasAmount: BigInt(30000),
    })
  );
}

function hexStringToByteArray(hexString: string) {
  if (hexString.startsWith("0x")) {
    hexString = hexString.substr(2);
  }
  if (hexString.length % 2 !== 0) {
    throw "Must have an even number of hex digits to convert to bytes";
  }
  var numBytes = hexString.length / 2;
  var byteArray = new Uint8Array(numBytes);
  for (var i = 0; i < numBytes; i++) {
    byteArray[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return byteArray;
}

function generateDerivedAddress(
  deployer_address: string,
  seed: string
): string {
  let derive_resource_account_scheme = Buffer.alloc(1);
  derive_resource_account_scheme.writeUInt8(255);
  return sha3.sha3_256(
    Buffer.concat([
      hexStringToByteArray(deployer_address),
      Buffer.from(seed, "ascii"),
      derive_resource_account_scheme,
    ])
  );
}

function buildPackage(dir: string, addrs?: string): Package {
  const named_addresses = addrs ? ["--named-addresses", addrs] : [];
  const aptos = spawnSync("aptos", [
    "move",
    "compile",
    "--save-metadata",
    "--included-artifacts",
    "none",
    "--package-dir",
    dir,
    ...named_addresses,
  ]);
  if (aptos.status !== 0) {
    console.error(aptos.stderr.toString("utf8"));
    console.error(aptos.stdout.toString("utf8"));
    process.exit(1);
  }

  const result: any = JSON.parse(aptos.stdout.toString("utf8"));
  const buildDirs = fs
    .readdirSync(`${dir}/build`, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
  if (buildDirs.length !== 1) {
    console.error(
      `Unexpected directory structure in ${dir}/build: expected a single directory`
    );
    process.exit(1);
  }
  const buildDir = `${dir}/build/${buildDirs[0]}`;
  return {
    meta_file: `${buildDir}/package-metadata.bcs`,
    mv_files: result["Result"].map(
      (mod: string) => `${buildDir}/bytecode_modules/${mod.split("::")[1]}.mv`
    ),
  };
}

function serializePackage(p: Package): PackageBCS {
  const metaBytes = fs.readFileSync(p.meta_file);
  const packageMetadataSerializer = new BCS.Serializer();
  packageMetadataSerializer.serializeBytes(metaBytes);
  const serializedPackageMetadata = packageMetadataSerializer.getBytes();

  const modules = p.mv_files.map((file) => fs.readFileSync(file));
  const serializer = new BCS.Serializer();
  serializer.serializeU32AsUleb128(modules.length);
  modules.forEach((module) => serializer.serializeBytes(module));
  const serializedModules = serializer.getBytes();

  const hashes = [metaBytes]
    .concat(modules)
    .map((x) => Buffer.from(sha3.keccak256(x), "hex"));
  const codeHash = Buffer.from(sha3.keccak256(Buffer.concat(hashes)), "hex");

  return {
    meta: serializedPackageMetadata,
    bytecodes: serializedModules,
    codeHash,
  };
}

function hex(x: string): string {
  return ethers.utils.hexlify(x, { allowMissingPrefix: true });
}

function evm_address(x: string): string {
  return hex(x).substring(2).padStart(64, "0");
}

builder(yargs(hideBin(process.argv))).argv;
