/** biome-ignore-all lint/suspicious/noConsole: CLI script */
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Wallet } from "@coral-xyz/anchor";
import type { PythCluster } from "@pythnetwork/client/lib/cluster";
import { getPythClusterApiUrl } from "@pythnetwork/client/lib/cluster";
import {
  AuthorizeGovernanceDataSourceTransfer,
  CosmosUpgradeContract,
  EvmExecute,
  EvmSetWormholeAddress,
  EvmUpgradeContract,
  getProposalInstructions,
  MultisigParser,
  RequestGovernanceDataSourceTransfer,
  SetDataSources,
  UpdateTrustedSigner256Bit,
  UpdateTrustedSigner264Bit,
  UpgradeSuiLazerContract,
  WormholeMultisigInstruction,
} from "@pythnetwork/xc-admin-common";
import type { AccountMeta } from "@solana/web3.js";
import { Keypair, PublicKey } from "@solana/web3.js";
import SquadsMeshClass from "@sqds/mesh";
import Web3 from "web3";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { DeploymentType } from "../src/core/base";
import { getDefaultDeploymentConfig, toDeploymentType } from "../src/core/base";
import {
  CosmWasmChain,
  EvmChain,
  IotaChain,
  SuiChain,
} from "../src/core/chains";
import { IotaLazerContract, SuiLazerContract } from "../src/core/contracts";
import {
  EvmEntropyContract,
  EvmLazerContract,
  EvmPriceFeedContract,
  EvmWormholeContract,
  getCodeDigestWithoutAddress,
} from "../src/core/contracts/evm";
import { DefaultStore } from "../src/node/utils/store";
import {
  dataSourcesEqual,
  findStoredWormhole,
  normalizeHex,
} from "./evm_pro_cutover";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function getSquadsMesh() {
  // Handle nested default export from @sqds/mesh
  return (
    (SquadsMeshClass as { default?: typeof SquadsMeshClass }).default ??
    SquadsMeshClass
  );
}

type CutoverGroup = {
  upgrade?: EvmUpgradeContract;
  setDataSources?: SetDataSources;
  setWormhole?: EvmSetWormholeAddress;
  governanceTransfer?: string;
};

function matchingEvmChains(
  targetChainId: string,
  cluster: PythCluster,
): EvmChain[] {
  return Object.values(DefaultStore.chains).filter(
    (chain): chain is EvmChain =>
      chain instanceof EvmChain &&
      chain.isMainnet() === (cluster === "mainnet-beta") &&
      chain.wormholeChainName === targetChainId,
  );
}

function guardianSetsEqual(onChain: string[], expected: string[]): boolean {
  if (onChain.length !== expected.length) return false;
  return onChain.every(
    (guardian, i) => normalizeHex(guardian) === normalizeHex(expected[i] ?? ""),
  );
}

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0 --cluster <cluster_id> --proposal <proposal_address>")
  .options({
    cluster: {
      demandOption: true,
      desc: "Multsig Cluster name to check proposal on can be one of [devnet, testnet, mainnet-beta]",
      type: "string",
    },
    "contract-type": {
      choices: ["entropy", "lazer"],
      demandOption: false,
      desc: "Type of EVM contract to verify (entropy or lazer). Required when checking EvmExecute instructions.",
      type: "string",
    },
    "deployment-type": {
      demandOption: false,
      desc: "Pro deployment config to check against. Defaults from --cluster: mainnet-beta → pro-compatible-production, otherwise pro-compatible-staging",
      type: "string",
    },
    proposal: {
      demandOption: true,
      desc: "The proposal address to check",
      type: "string",
    },
  });

async function verifyCutoverGroup(
  targetChainId: string,
  group: CutoverGroup,
  cluster: PythCluster,
  deploymentType: DeploymentType,
): Promise<boolean> {
  const expected = getDefaultDeploymentConfig(deploymentType);
  let ok = true;
  console.log(
    `\nVerifying Pro cutover triple on ${targetChainId} against ${deploymentType}`,
  );

  if (group.governanceTransfer) {
    console.error(
      `FAIL: cutover for ${targetChainId} also contains ${group.governanceTransfer}; governance emitter must not change`,
    );
    ok = false;
  }

  for (const chain of matchingEvmChains(targetChainId, cluster)) {
    if (group.upgrade) {
      const contract = new EvmPriceFeedContract(chain, group.upgrade.address);
      const digest = await contract.getCodeDigestWithoutAddress();
      console.log(
        `${chain.getId()}  UpgradeContract address:${group.upgrade.address} digest:${digest}`,
      );
    }

    if (group.setDataSources) {
      const match = dataSourcesEqual(
        group.setDataSources.dataSources,
        expected.dataSources,
      );
      console.log(
        `${chain.getId()}  SetDataSources ${match ? "MATCH" : "MISMATCH"} expected ${JSON.stringify(expected.dataSources)} got ${JSON.stringify(group.setDataSources.dataSources)}`,
      );
      if (!match) ok = false;
    }

    if (group.setWormhole) {
      const address = group.setWormhole.address;
      const stored = findStoredWormhole(chain, address);
      if (!stored) {
        console.error(
          `FAIL: ${chain.getId()} SetWormholeAddress ${address} is not an EvmWormholeContract in the store`,
        );
        ok = false;
      } else if (stored.deploymentType !== deploymentType) {
        console.error(
          `FAIL: ${chain.getId()} wormhole ${address} deploymentType=${stored.deploymentType ?? "unlabeled"}, expected ${deploymentType}`,
        );
        ok = false;
      } else {
        console.log(
          `${chain.getId()}  SetWormholeAddress ${address} store deploymentType=${stored.deploymentType} MATCH`,
        );
      }

      const prefixed = address.startsWith("0x") ? address : `0x${address}`;
      const contract = new EvmWormholeContract(chain, prefixed);
      const currentIndex = await contract.getCurrentGuardianSetIndex();
      const guardianSet = await contract.getGuardianSet();
      const proxyContract = new EvmPriceFeedContract(chain, prefixed);
      const proxyCode = await proxyContract.getCode();
      const receiverImplementation =
        await proxyContract.getImplementationAddress();
      const implementationCode = await new EvmPriceFeedContract(
        chain,
        receiverImplementation,
      ).getCode();
      const proxyDigest = Web3.utils.keccak256(proxyCode);
      const implementationDigest = Web3.utils.keccak256(implementationCode);
      const guardianMatch = guardianSetsEqual(
        guardianSet,
        expected.wormholeConfig.initialGuardianSet,
      );
      const halfQuorum = Math.floor(guardianSet.length / 2) + 1;
      console.log(
        `${chain.getId()}  wormhole proxy digest:\t${proxyDigest}\nimplementation digest:\t${implementationDigest} (should be ReceiverImplementationHalf)\nguardian set index:\t${currentIndex}\nguardian set vs ${deploymentType} initialGuardianSet:\t${guardianMatch ? "MATCH" : "MISMATCH"}\nconfig quorum:\t${expected.wormholeConfig.quorum} (half quorum of ${guardianSet.length} is ${halfQuorum})`,
      );
      if (!guardianMatch) ok = false;
      if (expected.wormholeConfig.quorum !== "half") {
        console.error(
          `FAIL: ${deploymentType} wormholeConfig.quorum is ${expected.wormholeConfig.quorum}, expected half`,
        );
        ok = false;
      }
    }
  }

  return ok;
}

async function main() {
  const argv = await parser.argv;
  const cluster = argv.cluster as PythCluster;
  let deploymentType: DeploymentType;
  if (argv["deployment-type"]) {
    deploymentType = toDeploymentType(argv["deployment-type"]);
  } else if (cluster === "mainnet-beta") {
    deploymentType = "pro-compatible-production";
  } else {
    deploymentType = "pro-compatible-staging";
  }
  const cutoverByTarget = new Map<string, CutoverGroup>();
  const record = (targetChainId: string) => {
    const current = cutoverByTarget.get(targetChainId) ?? {};
    cutoverByTarget.set(targetChainId, current);
    return current;
  };
  let failed = false;
  const mesh = getSquadsMesh();
  const squad = mesh.endpoint(
    getPythClusterApiUrl(cluster),
    new Wallet(Keypair.generate()), // dummy wallet
  );
  const transaction = await squad.getTransaction(new PublicKey(argv.proposal));
  const instructions = await getProposalInstructions(squad, transaction);
  const multisigParser = MultisigParser.fromCluster(cluster);
  const parsedInstructions = instructions.map((instruction) => {
    return multisigParser.parseInstruction({
      data: instruction.data as Buffer,
      keys: instruction.keys as AccountMeta[],
      programId: instruction.programId,
    });
  });

  for (const instruction of parsedInstructions) {
    if (instruction instanceof WormholeMultisigInstruction) {
      if (
        instruction.governanceAction instanceof
          AuthorizeGovernanceDataSourceTransfer ||
        instruction.governanceAction instanceof
          RequestGovernanceDataSourceTransfer
      ) {
        const targetChainId = instruction.governanceAction.targetChainId;
        const name =
          instruction.governanceAction instanceof
          AuthorizeGovernanceDataSourceTransfer
            ? "AuthorizeGovernanceDataSourceTransfer"
            : "RequestGovernanceDataSourceTransfer";
        console.error(
          `WARNING: proposal contains ${name} for ${targetChainId}. Cutover must not change the governance emitter.`,
        );
        record(targetChainId).governanceTransfer = name;
      }
      if (instruction.governanceAction instanceof EvmSetWormholeAddress) {
        record(instruction.governanceAction.targetChainId).setWormhole =
          instruction.governanceAction;
        console.log(
          `Verifying EVM set wormhole address on ${instruction.governanceAction.targetChainId}`,
        );
        for (const chain of Object.values(DefaultStore.chains)) {
          if (
            chain instanceof EvmChain &&
            chain.wormholeChainName ===
              instruction.governanceAction.targetChainId
          ) {
            const address = instruction.governanceAction.address;
            const contract = new EvmWormholeContract(chain, address);
            const currentIndex = await contract.getCurrentGuardianSetIndex();
            const guardianSet = await contract.getGuardianSet();

            const proxyContract = new EvmPriceFeedContract(chain, address);
            const proxyCode = await proxyContract.getCode();
            const receiverImplementation =
              await proxyContract.getImplementationAddress();
            const implementationCode = await new EvmPriceFeedContract(
              chain,
              receiverImplementation,
            ).getCode();
            const proxyDigest = Web3.utils.keccak256(proxyCode);
            const implementationDigest =
              Web3.utils.keccak256(implementationCode);
            const guardianSetDigest = Web3.utils.keccak256(
              JSON.stringify(guardianSet),
            );
            console.log(
              `${chain.getId()}  Address:\t\t${address}\nproxy digest:\t\t${proxyDigest}\nimplementation digest:\t${implementationDigest} \nguardian set index:\t${currentIndex} \nguardian set:\t\t${guardianSetDigest}`,
            );
          }
        }
      }
      if (instruction.governanceAction instanceof EvmUpgradeContract) {
        record(instruction.governanceAction.targetChainId).upgrade =
          instruction.governanceAction;
        console.log(
          `Verifying EVM Upgrade Contract on ${instruction.governanceAction.targetChainId}`,
        );
        for (const chain of Object.values(DefaultStore.chains)) {
          if (
            chain instanceof EvmChain &&
            chain.isMainnet() === (cluster === "mainnet-beta") &&
            chain.wormholeChainName ===
              instruction.governanceAction.targetChainId
          ) {
            const address = instruction.governanceAction.address;
            const contract = new EvmPriceFeedContract(chain, address);
            const code = await contract.getCodeDigestWithoutAddress();
            // this should be the same keccak256 of the deployedCode property generated by truffle
            console.log(`${chain.getId()}  Address:${address} digest:${code}`);
          }
        }
      }
      if (instruction.governanceAction instanceof SetDataSources) {
        record(instruction.governanceAction.targetChainId).setDataSources =
          instruction.governanceAction;
        const expected = getDefaultDeploymentConfig(deploymentType);
        console.log(
          `Verifying SetDataSources on ${instruction.governanceAction.targetChainId} against ${deploymentType}`,
        );
        const match = dataSourcesEqual(
          instruction.governanceAction.dataSources,
          expected.dataSources,
        );
        console.log(
          `  ${match ? "MATCH" : "MISMATCH"} expected ${JSON.stringify(expected.dataSources)} got ${JSON.stringify(instruction.governanceAction.dataSources)}`,
        );
        if (!match && argv["deployment-type"]) {
          failed = true;
        }
        for (const chain of matchingEvmChains(
          instruction.governanceAction.targetChainId,
          cluster,
        )) {
          console.log(
            `${chain.getId()}  SetDataSources emitters ${match ? "match" : "do not match"} ${deploymentType}`,
          );
        }
      }
      if (instruction.governanceAction instanceof CosmosUpgradeContract) {
        console.log(
          `Verifying Cosmos Upgrade Contract on ${instruction.governanceAction.targetChainId}`,
        );
        for (const chain of Object.values(DefaultStore.chains)) {
          if (
            chain instanceof CosmWasmChain &&
            chain.wormholeChainName ===
              instruction.governanceAction.targetChainId
          ) {
            const codeId = instruction.governanceAction.codeId;
            const code = await chain.getCode(Number(codeId));
            // this should be the same checksums.txt in our release file
            console.log(
              `${chain.getId()} Code Id:${codeId} digest:${createHash("sha256")
                .update(code)
                .digest("hex")}`,
            );
          }
        }
      }
      if (instruction.governanceAction instanceof EvmExecute) {
        // Note: it only checks for upgrade entropy contracts right now
        console.log(
          `\nVerifying EVMExecute on ${instruction.governanceAction.targetChainId}`,
        );
        for (const chain of Object.values(DefaultStore.chains)) {
          if (
            chain instanceof EvmChain &&
            chain.wormholeChainName ===
              instruction.governanceAction.targetChainId
          ) {
            const executorAddress =
              instruction.governanceAction.executorAddress;
            const callAddress = instruction.governanceAction.callAddress;
            const calldata = instruction.governanceAction.calldata;

            // Get contract type from flag, default to "entropy" for backward compatibility
            const contractType = argv["contract-type"] ?? "entropy";

            const contract: EvmEntropyContract | EvmLazerContract =
              contractType === "lazer"
                ? new EvmLazerContract(chain, callAddress)
                : new EvmEntropyContract(chain, callAddress);
            const owner = await contract.getOwner();

            if (
              executorAddress.toUpperCase() !==
              owner.replace("0x", "").toUpperCase()
            ) {
              console.log(
                `Executor Address: ${executorAddress.toUpperCase()} is not equal to Owner Address: ${owner
                  .replace("0x", "")
                  .toUpperCase()}`,
              );
              continue;
            }

            // TODO: This logic assumes we are calling upgradeTo on the contract at callAddress.
            // In the future, this logic may need to be generalized to support calling other functions.
            const invokedMethod = "upgradeTo(address)";
            const calldataHex = calldata.toString("hex");
            const web3 = new Web3();
            const methodSignature = web3.eth.abi
              .encodeFunctionSignature(invokedMethod)
              .replace("0x", "");

            let newImplementationAddress: string | undefined;
            if (calldataHex.startsWith(methodSignature)) {
              newImplementationAddress = web3.eth.abi.decodeParameter(
                "address",
                calldataHex.replace(methodSignature, ""),
              ) as unknown as string;
            }

            if (newImplementationAddress === undefined) {
              console.log(
                `We couldn't parse the instruction for ${chain.getId()}`,
              );
              continue;
            }

            const newImplementationCode = await getCodeDigestWithoutAddress(
              chain.getWeb3(),
              newImplementationAddress,
            );
            // this should be the same keccak256 of the deployedCode property generated by truffle
            console.log(
              `${chain.getId()}  call ${invokedMethod} with arguments (${newImplementationAddress}) on ${contract.getType()} at address:${callAddress} from executor:${executorAddress}.`,
            );
            console.log(
              `${chain.getId()}    new implementation address:${newImplementationAddress} has code digest:${newImplementationCode}`,
            );
          }
        }
      }
      if (
        instruction.governanceAction instanceof UpdateTrustedSigner264Bit ||
        instruction.governanceAction instanceof UpdateTrustedSigner256Bit
      ) {
        const { targetChainId, publicKey, expiresAt } =
          instruction.governanceAction;

        console.log(
          `Verifying ${instruction.governanceAction.action} on '${targetChainId}'`,
        );

        const expiresAtMs = expiresAt * 1000n;
        if (expiresAtMs > Number.MAX_SAFE_INTEGER) {
          console.error(
            "expiration value in milliseconds cannot be represented as a JS integer:",
            expiresAtMs,
          );
          continue;
        }
        const expiresAtDate = new Date(Number(expiresAtMs));

        console.log("Trusted signer proposal info:");
        console.log("  public key:", publicKey);
        console.log("  expires at:", expiresAtDate);
      }
      if (instruction.governanceAction instanceof UpgradeSuiLazerContract) {
        const { targetChainId, version, hash } = instruction.governanceAction;

        console.log(`Verifying UpgradeSuiLazerContract on '${targetChainId}'`);

        if (targetChainId === "sui") {
          const chain = DefaultStore.chains.sui_mainnet;

          if (!(chain instanceof SuiChain)) {
            console.error("Could not find valid Sui mainnet chain in store");
            continue;
          }

          const packagePath = path.resolve(
            scriptDir,
            "../../lazer/contracts/sui",
          );

          const contracts = Object.values(DefaultStore.lazer_contracts)
            .filter((c) => c instanceof SuiLazerContract)
            .filter((c) => c.chain.isMainnet());

          if (contracts.length === 0) {
            console.error("Could not find valid Sui Lazer contract in store");
            continue;
          }

          const client = chain.getProvider();
          for (const contract of contracts) {
            const info = await chain.getStatePackageInfo(
              client,
              contract.stateId,
            );
            if (BigInt(info.version) + 1n !== version) {
              console.log(
                "Proposal upgrade version does not follow current version:",
              );
              console.log(
                `  current version is ${info.version}, proposed ${version}`,
              );
            }
          }

          await chain.updateLazerMeta(packagePath, {
            receiver_chain_id: chain.getWormholeChainId(),
            version: version.toString(),
          });
          const pkg = await chain.buildPackage(packagePath);
          const buildHash = Buffer.from(pkg.digest).toString("hex");
          if (buildHash !== hash) {
            console.log("Proposal package digest does not match local build:");
            console.log(`  expected ${buildHash}`);
            console.log(`     found ${hash}`);
          }
        } else if (targetChainId.startsWith("iota_sui_")) {
          const chain = Object.values(DefaultStore.chains).find(
            (candidate) =>
              candidate instanceof IotaChain &&
              candidate.wormholeChainName === targetChainId,
          );

          if (!(chain instanceof IotaChain)) {
            console.error(`'${targetChainId}' is not a valid IOTA chain`);
            continue;
          }

          const packagePath = path.resolve(
            scriptDir,
            "../../lazer/contracts/iota",
          );

          const contracts = Object.values(DefaultStore.lazer_contracts)
            .filter((contract) => contract instanceof IotaLazerContract)
            .filter((contract) => contract.chain.getId() === chain.getId());

          if (contracts.length === 0) {
            console.error(
              `Could not find valid IOTA Lazer contract for '${targetChainId}' in store`,
            );
            continue;
          }

          const client = chain.getProvider();
          for (const contract of contracts) {
            const info = await chain.getStatePackageInfo(
              client,
              contract.stateId,
            );
            if (BigInt(info.version) + 1n !== version) {
              console.log(
                "Proposal upgrade version does not follow current version:",
              );
              console.log(
                `  current version is ${info.version}, proposed ${version}`,
              );
            }

            await chain.updateLazerMeta(
              packagePath,
              {
                receiver_chain_id: chain.getWormholeChainId(),
                version: version.toString(),
              },
              info.package,
            );
            const pkg = await chain.buildLazerPackage(
              packagePath,
              contract.wormholeStateId,
            );
            const buildHash = Buffer.from(pkg.digest).toString("hex");
            if (buildHash !== hash) {
              console.log(
                "Proposal package digest does not match local build:",
              );
              console.log(`  expected ${buildHash}`);
              console.log(`     found ${hash}`);
            }
          }
        } else {
          console.log(`Unsupported target chain '${targetChainId}'`);
        }
      }
    }
  }

  for (const [targetChainId, group] of cutoverByTarget) {
    if (group.upgrade && group.setDataSources && group.setWormhole) {
      const ok = await verifyCutoverGroup(
        targetChainId,
        group,
        cluster,
        deploymentType,
      );
      if (!ok) failed = true;
    } else if (
      group.governanceTransfer &&
      (group.upgrade || group.setDataSources || group.setWormhole)
    ) {
      console.error(
        `FAIL: ${targetChainId} mixes ${group.governanceTransfer} with cutover actions`,
      );
      failed = true;
    }
  }

  if (failed) {
    throw new Error("Proposal failed cutover / SetDataSources checks");
  }
}

main();
