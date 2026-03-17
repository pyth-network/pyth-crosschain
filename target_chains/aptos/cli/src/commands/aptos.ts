import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { getDefaultDeploymentConfig } from "@pythnetwork/contract-manager/core/base";
import { AptosChain } from "@pythnetwork/contract-manager/core/chains";
import { DefaultStore } from "@pythnetwork/contract-manager/node/utils/store";
import { AptosAccount, AptosClient, BCS, TxnBuilderTypes } from "aptos";
import sha3 from "js-sha3";
import type { Argv } from "yargs";

const NETWORK_CHOICES = Object.entries(DefaultStore.chains)
  .filter(([_, config]) => {
    return config instanceof AptosChain;
  })
  .map(([chain, _]) => {
    return chain;
  });

const NETWORK_OPTION = {
  alias: "n",
  choices: NETWORK_CHOICES,
  demandOption: true,
  describe: "network",
  type: "string",
} as const;
const CHANNEL_OPTION = {
  choices: ["stable", "beta"],
  demandOption: true,
  describe: "channel",
  type: "string",
} as const;
const DEPLOYER_OPTION = {
  describe: "deployer contract address deployed in the network",
  type: "string",
} as const;
const WORMHOLE_OPTION = {
  describe: "wormhole contract address deployed in the network",
  type: "string",
} as const;
const PYTH_OPTION = {
  default: "0x7e783b349d3e89cf5931af376ebeadbfab855b3fa239b7ada8f5a92fbea6b387",
  describe: "pyth contract address deployed in the network",
  type: "string",
} as const;

type Package = {
  meta_file: string;
  mv_files: string[];
};

type PackageBCS = {
  meta: Uint8Array;
  bytecodes: Uint8Array;
  codeHash: Uint8Array;
};

export const builder: (args: Argv<any>) => Argv<any> = (yargs) =>
  yargs
    .command(
      "deploy <package-dir>",
      "Deploy a package",
      (yargs) => {
        return yargs
          .positional("package-dir", { type: "string" })
          .option("named-addresses", { type: "string" })
          .option("network", NETWORK_OPTION);
      },
      async (argv) => {
        const artefact = serializePackage(
          buildPackage(argv["package-dir"]!, argv["named-addresses"]),
        );
        const txPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
          TxnBuilderTypes.EntryFunction.natural(
            "0x1::code",
            "publish_package_txn",
            [],
            [artefact.meta, artefact.bytecodes],
          ),
        );

        await executeTransaction(argv.network, txPayload);
      },
    )
    .command(
      "deploy-wormhole <package-dir> <seed>",
      "Deploy the wormhole package using a resource account.",
      (yargs) => {
        return yargs
          .positional("package-dir", { type: "string" })
          .positional("seed", { type: "string" })
          .option("deployer", DEPLOYER_OPTION)
          .option("network", NETWORK_OPTION);
      },
      async (argv) => {
        const sender = getSender();
        const derivedAddress = generateDerivedAddress(
          sender.address().toString(),
          argv.seed!,
        );

        const namedAddresses = `deployer=${argv.deployer},wormhole=0x${derivedAddress}`;
        const txPayload = createDeployDerivedTransaction(
          argv["package-dir"],
          argv.deployer,
          argv.seed,
          namedAddresses,
        );

        await executeTransaction(argv.network, txPayload);
      },
    )
    .command(
      "deploy-pyth <package-dir> <seed>",
      "Deploy the pyth package using a resource account.",
      (yargs) => {
        return yargs
          .positional("package-dir", { type: "string" })
          .positional("seed", { type: "string" })
          .option("deployer", DEPLOYER_OPTION)
          .option("wormhole", WORMHOLE_OPTION)
          .option("network", NETWORK_OPTION);
      },
      async (argv) => {
        const sender = getSender();
        const derivedAddress = generateDerivedAddress(
          sender.address().toString(),
          argv.seed!,
        );

        const namedAddresses = `wormhole=${argv.wormhole},deployer=${argv.deployer},pyth=0x${derivedAddress}`;
        const txPayload = createDeployDerivedTransaction(
          argv["package-dir"],
          argv.deployer,
          argv.seed,
          namedAddresses,
        );

        await executeTransaction(argv.network, txPayload);
      },
    )
    .command(
      "derived-address <seed>",
      "Generate the derived address for the given seed and sender address",
      (yargs) => {
        return yargs
          .positional("seed", { demandOption: true, type: "string" })
          .option("signer", { type: "string" });
      },
      async (argv) => {},
    )
    .command(
      "init-wormhole",
      "Init Wormhole core contract",
      (yargs) => {
        return yargs
          .option("network", NETWORK_OPTION)
          .option("channel", CHANNEL_OPTION);
      },
      async (argv) => {
        const chain_id = DefaultStore.chains[argv.network].getWormholeChainId();
        const config = getDefaultDeploymentConfig(argv.channel).wormholeConfig;

        const governance_contract = config.governanceContract;
        const governance_chain_id = config.governanceChainId;
        const guardian_address = config.initialGuardianSet[0]; // assuming only one guardian for now

        const guardian_addresses_serializer = new BCS.Serializer();
        guardian_addresses_serializer.serializeU32AsUleb128(1);
        guardian_addresses_serializer.serializeBytes(
          Buffer.from(guardian_address!, "hex"),
        );

        const args = [
          BCS.bcsSerializeUint64(chain_id),
          BCS.bcsSerializeUint64(governance_chain_id),
          BCS.bcsSerializeBytes(Buffer.from(governance_contract, "hex")),
          guardian_addresses_serializer.getBytes(),
        ];
        const sender = getSender();
        const wormholeAddress = generateDerivedAddress(
          sender.address().hex(),
          "wormhole",
        );
        const txPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
          TxnBuilderTypes.EntryFunction.natural(
            `${wormholeAddress}::wormhole`,
            "init",
            [],
            args,
          ),
        );

        await executeTransaction(argv.network, txPayload);
      },
    )
    .command(
      "init-pyth <seed>",
      "Init Pyth contract",
      (yargs) => {
        return yargs
          .positional("seed", { demandOption: true, type: "string" })
          .option("network", NETWORK_OPTION)
          .option("stale-price-threshold", {
            demandOption: true,
            describe: "Stale price threshold",
            type: "number",
          })
          .option("update-fee", {
            demandOption: true,
            describe: "Update fee",
            type: "number",
          })
          .option("channel", CHANNEL_OPTION);
      },
      async (argv) => {
        const stale_price_threshold = argv["stale-price-threshold"];
        const update_fee = argv["update-fee"];

        const config = getDefaultDeploymentConfig(argv.channel);
        const governance_emitter_chain_id =
          config.governanceDataSource.emitterChain;
        const governance_emitter_address =
          config.governanceDataSource.emitterAddress;

        const dataSourceChainIdsSerializer = new BCS.Serializer();
        dataSourceChainIdsSerializer.serializeU32AsUleb128(
          config.dataSources.length,
        );
        const dataSourceEmitterAddressesSerializer = new BCS.Serializer();
        dataSourceEmitterAddressesSerializer.serializeU32AsUleb128(
          config.dataSources.length,
        );
        config.dataSources.forEach((ds) => {
          dataSourceChainIdsSerializer.serializeU64(ds.emitterChain);
          dataSourceEmitterAddressesSerializer.serializeBytes(
            Buffer.from(ds.emitterAddress, "hex"),
          );
        });

        const args = [
          BCS.bcsSerializeUint64(stale_price_threshold),
          BCS.bcsSerializeUint64(governance_emitter_chain_id),
          BCS.bcsSerializeBytes(Buffer.from(governance_emitter_address, "hex")),
          dataSourceChainIdsSerializer.getBytes(),
          dataSourceEmitterAddressesSerializer.getBytes(),
          BCS.bcsSerializeUint64(update_fee),
        ];
        const sender = getSender();
        const pythAddress = generateDerivedAddress(
          sender.address().hex(),
          argv.seed,
        );
        const txPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
          TxnBuilderTypes.EntryFunction.natural(
            `${pythAddress}::pyth`,
            "init",
            [],
            args,
          ),
        );

        await executeTransaction(argv.network, txPayload);
      },
    )
    .command(
      "hash-contracts <package-dir>",
      "Hash contract bytecodes for upgrade, the named addresses should be the same as the currently deployed ones",
      (yargs) => {
        return yargs
          .positional("package-dir", {
            required: true,
            type: "string",
          })
          .option("deployer", DEPLOYER_OPTION)
          .option("wormhole", WORMHOLE_OPTION)
          .option("pyth", PYTH_OPTION);
      },
      (argv) => {
        const namedAddresses = `wormhole=${argv.wormhole},deployer=${argv.deployer},pyth=${argv.pyth}`;
        const p = buildPackage(argv["package-dir"]!, namedAddresses);
        const _b = serializePackage(p);
      },
    )
    .command(
      "upgrade <package-dir>",
      "Perform Pyth contract upgrade after governance VAA has been submitted",
      (_yargs) => {
        return yargs
          .positional("package-dir", {
            required: true,
            type: "string",
          })
          .option("network", NETWORK_OPTION)
          .option("deployer", DEPLOYER_OPTION)
          .option("wormhole", WORMHOLE_OPTION)
          .option("pyth", PYTH_OPTION);
      },
      async (argv) => {
        const namedAddresses = `wormhole=${argv.wormhole},deployer=${argv.deployer},pyth=${argv.pyth}`;
        const artefact = serializePackage(
          buildPackage(argv["package-dir"]!, namedAddresses),
        );

        const pythAddress = argv.pyth;
        const txPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
          TxnBuilderTypes.EntryFunction.natural(
            `${pythAddress}::contract_upgrade`,
            "do_contract_upgrade",
            [],
            [artefact.meta, artefact.bytecodes],
          ),
        );

        await executeTransaction(argv.network, txPayload);
      },
    )
    .command(
      "diff-abi <addr-1> <addr-2>",
      "Finds the differences between the ABIs of two published packages, can be used to make sure that the upgrade will be backward compatible",
      (_yargs) => {
        return yargs
          .positional("addr-1", {
            required: true,
            type: "string",
          })
          .positional("addr-2", {
            required: true,
            type: "string",
          })
          .option("network", NETWORK_OPTION);
      },
      async (argv) => {
        const endpoint = (DefaultStore.chains[argv.network] as AptosChain)
          .rpcUrl;
        const addr1 = argv["addr-1"];
        const addr2 = argv["addr-2"];
        const url = `${endpoint}/accounts/${addr1}/resource/0x1::code::PackageRegistry`;
        const response = await (await fetch(url)).json();
        // @ts-expect-error - TODO: Please improve typings on the .json() response here
        for (const module of response?.data?.packages[0]?.modules ?? []) {
          const moduleName = module.name;
          const addr1Module = `${endpoint}/accounts/${addr1}/module/${moduleName}`;
          const addr2Module = `${endpoint}/accounts/${addr2}/module/${moduleName}`;
          const module1Response = await (await fetch(addr1Module)).text();
          const module2Response = await (await fetch(addr2Module)).text();
          // Replace the addresses with 0x0 so that we can compare the ABIs skipping the irrelevant address differences
          const module1Stripped = module1Response.replace(
            new RegExp(addr1, "g"),
            "0x0",
          );
          const module2Stripped = module2Response.replace(
            new RegExp(addr2, "g"),
            "0x0",
          );
          if (
            JSON.stringify(JSON.parse(module1Stripped).abi) !==
            JSON.stringify(JSON.parse(module2Stripped).abi)
          ) {
          } else {
          }
        }
      },
    )
    .demandCommand();

function getSender() {
  const key = process.env.APTOS_PRIVATE_KEY;
  if (key === undefined) {
    throw new Error(
      `Please set the APTOS_PRIVATE_KEY environment variable to the private key of the sender in hex format`,
    );
  }
  return new AptosAccount(new Uint8Array(Buffer.from(key, "hex")));
}

async function executeTransaction(
  network: string,
  txPayload: TxnBuilderTypes.TransactionPayloadEntryFunction,
) {
  const endpoint = (DefaultStore.chains[network] as AptosChain).rpcUrl;
  const _client = new AptosClient(endpoint);
  const _sender = getSender();
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
    byteArray[i] = Number.parseInt(hexString.substr(i * 2, 2), 16);
  }
  return byteArray;
}

function generateDerivedAddress(signer_address: string, seed: string): string {
  const derive_resource_account_scheme = Buffer.alloc(1);
  derive_resource_account_scheme.writeUInt8(255);
  return sha3.sha3_256(
    Buffer.concat([
      hexStringToByteArray(signer_address),
      Buffer.from(seed, "ascii"),
      derive_resource_account_scheme,
    ]),
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
    process.exit(1);
  }

  const result: any = JSON.parse(aptos.stdout.toString("utf8"));
  const buildDirs = fs
    .readdirSync(`${dir}/build`, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
  if (buildDirs.length !== 1) {
    process.exit(1);
  }
  const buildDir = `${dir}/build/${buildDirs[0]}`;
  return {
    meta_file: `${buildDir}/package-metadata.bcs`,
    mv_files: result.Result.map(
      (mod: string) => `${buildDir}/bytecode_modules/${mod.split("::")[1]}.mv`,
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
    bytecodes: serializedModules,
    codeHash,
    meta: serializedPackageMetadata,
  };
}

function createDeployDerivedTransaction(
  packageDir: string,
  deployer: string,
  seed: string,
  namedAddresses: string,
) {
  const artifact = serializePackage(buildPackage(packageDir, namedAddresses));

  return new TxnBuilderTypes.TransactionPayloadEntryFunction(
    TxnBuilderTypes.EntryFunction.natural(
      deployer + "::deployer",
      "deploy_derived",
      [],
      [
        artifact.meta,
        artifact.bytecodes,
        BCS.bcsSerializeBytes(Buffer.from(seed, "ascii")),
      ],
    ),
  );
}
