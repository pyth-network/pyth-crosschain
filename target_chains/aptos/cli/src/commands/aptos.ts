import { Argv } from "yargs";
import { spawnSync } from "child_process";
import { AptosAccount, AptosClient, BCS, TxnBuilderTypes } from "aptos";
import fs from "fs";
import sha3 from "js-sha3";
import { ethers } from "ethers";
import { DefaultStore } from "@pythnetwork/contract-manager/node/store";
import { AptosChain } from "@pythnetwork/contract-manager/core/chains";
import { getDefaultDeploymentConfig } from "@pythnetwork/contract-manager/core/base";

const NETWORK_CHOICES = Object.entries(DefaultStore.chains)
  .filter(([chain, config]) => {
    return config instanceof AptosChain;
  })
  .map(([chain, _]) => {
    return chain;
  });

const NETWORK_OPTION = {
  alias: "n",
  describe: "network",
  type: "string",
  choices: NETWORK_CHOICES,
  demandOption: true,
} as const;
const CHANNEL_OPTION = {
  describe: "channel",
  type: "string",
  choices: ["stable", "beta"],
  demandOption: true,
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
  describe: "pyth contract address deployed in the network",
  type: "string",
  default: "0x7e783b349d3e89cf5931af376ebeadbfab855b3fa239b7ada8f5a92fbea6b387",
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
        console.log("Building the package with the following named addresses:");
        console.log(`Deployer=${argv.deployer}`);
        console.log(`Wormhole=${derivedAddress}`);
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
        console.log("Building the package with the following named addresses:");
        console.log(`Wormhole=${argv.wormhole}`);
        console.log(`Deployer=${argv.deployer}`);
        console.log(`Pyth=${derivedAddress}`);
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
          .positional("seed", { type: "string", demandOption: true })
          .option("signer", { type: "string" });
      },
      async (argv) => {
        console.log(
          generateDerivedAddress(
            argv.signer || getSender().address().toString(),
            argv.seed,
          ),
        );
      },
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
          Buffer.from(guardian_address, "hex"),
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
          .positional("seed", { type: "string", demandOption: true })
          .option("network", NETWORK_OPTION)
          .option("stale-price-threshold", {
            describe: "Stale price threshold",
            type: "number",
            demandOption: true,
          })
          .option("update-fee", {
            describe: "Update fee",
            type: "number",
            demandOption: true,
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
            type: "string",
            required: true,
          })
          .option("deployer", DEPLOYER_OPTION)
          .option("wormhole", WORMHOLE_OPTION)
          .option("pyth", PYTH_OPTION);
      },
      (argv) => {
        const namedAddresses = `wormhole=${argv.wormhole},deployer=${argv.deployer},pyth=${argv.pyth}`;
        const p = buildPackage(argv["package-dir"]!, namedAddresses);
        const b = serializePackage(p);
        console.log(Buffer.from(b.codeHash).toString("hex"));
      },
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

        let pythAddress = argv.pyth;
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
            type: "string",
            required: true,
          })
          .positional("addr-2", {
            type: "string",
            required: true,
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
        for (const module of response.data.packages[0].modules) {
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
            console.log(`Module ${moduleName} ABI changed`);
          } else {
            console.log(`Module ${moduleName} ABI not changed`);
          }
        }
      },
    )
    .demandCommand();

function getSender() {
  const key = process.env["APTOS_PRIVATE_KEY"];
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
  const client = new AptosClient(endpoint);
  const sender = getSender();
  console.log(
    await client.generateSignSubmitWaitForTransaction(sender, txPayload, {
      maxGasAmount: BigInt(30000),
    }),
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

function generateDerivedAddress(signer_address: string, seed: string): string {
  let derive_resource_account_scheme = Buffer.alloc(1);
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
      `Unexpected directory structure in ${dir}/build: expected a single directory`,
    );
    process.exit(1);
  }
  const buildDir = `${dir}/build/${buildDirs[0]}`;
  return {
    meta_file: `${buildDir}/package-metadata.bcs`,
    mv_files: result["Result"].map(
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
    meta: serializedPackageMetadata,
    bytecodes: serializedModules,
    codeHash,
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

function hex(x: string): string {
  return ethers.utils.hexlify(x, { allowMissingPrefix: true });
}

function evm_address(x: string): string {
  return hex(x).substring(2).padStart(64, "0");
}
