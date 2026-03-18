/* eslint-disable @typescript-eslint/no-floating-promises */

/* eslint-disable unicorn/prefer-top-level-await */

/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { Wallet } from "@coral-xyz/anchor";
import type { PythCluster } from "@pythnetwork/client/lib/cluster";
import { getPythClusterApiUrl } from "@pythnetwork/client/lib/cluster";
import {
  CosmosUpgradeContract,
  EvmExecute,
  EvmSetWormholeAddress,
  EvmUpgradeContract,
  getProposalInstructions,
  MultisigParser,
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

import { CosmWasmChain, EvmChain, SuiChain } from "../src/core/chains";
import { SuiLazerContract } from "../src/core/contracts";
import {
  EvmEntropyContract,
  EvmLazerContract,
  EvmPriceFeedContract,
  EvmWormholeContract,
  getCodeDigestWithoutAddress,
} from "../src/core/contracts/evm";
import { DefaultStore } from "../src/node/utils/store";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function getSquadsMesh() {
  // Handle nested default export from @sqds/mesh
  return (
    (SquadsMeshClass as { default?: typeof SquadsMeshClass }).default ??
    SquadsMeshClass
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
    proposal: {
      demandOption: true,
      desc: "The proposal address to check",
      type: "string",
    },
  });

async function main() {
  const argv = await parser.argv;
  const cluster = argv.cluster as PythCluster;
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
      if (instruction.governanceAction instanceof EvmSetWormholeAddress) {
        for (const chain of Object.values(DefaultStore.chains)) {
          if (
            chain instanceof EvmChain &&
            chain.wormholeChainName ===
              instruction.governanceAction.targetChainId
          ) {
            const address = instruction.governanceAction.address;
            const contract = new EvmWormholeContract(chain, address);
            const _currentIndex = await contract.getCurrentGuardianSetIndex();
            const guardianSet = await contract.getGuardianSet();

            const proxyContract = new EvmPriceFeedContract(chain, address);
            const proxyCode = await proxyContract.getCode();
            const receiverImplementation =
              await proxyContract.getImplementationAddress();
            const implementationCode = await new EvmPriceFeedContract(
              chain,
              receiverImplementation,
            ).getCode();
            const _proxyDigest = Web3.utils.keccak256(proxyCode);
            const _implementationDigest =
              Web3.utils.keccak256(implementationCode);
            const _guardianSetDigest = Web3.utils.keccak256(
              JSON.stringify(guardianSet),
            );
          }
        }
      }
      if (instruction.governanceAction instanceof EvmUpgradeContract) {
        for (const chain of Object.values(DefaultStore.chains)) {
          if (
            chain instanceof EvmChain &&
            chain.isMainnet() === (cluster === "mainnet-beta") &&
            chain.wormholeChainName ===
              instruction.governanceAction.targetChainId
          ) {
            const address = instruction.governanceAction.address;
            const contract = new EvmPriceFeedContract(chain, address);
            const _code = await contract.getCodeDigestWithoutAddress();
          }
        }
      }
      if (instruction.governanceAction instanceof CosmosUpgradeContract) {
        for (const chain of Object.values(DefaultStore.chains)) {
          if (
            chain instanceof CosmWasmChain &&
            chain.wormholeChainName ===
              instruction.governanceAction.targetChainId
          ) {
            const codeId = instruction.governanceAction.codeId;
            const _code = await chain.getCode(Number(codeId));
          }
        }
      }
      if (instruction.governanceAction instanceof EvmExecute) {
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
              continue;
            }

            const _newImplementationCode = await getCodeDigestWithoutAddress(
              chain.getWeb3(),
              newImplementationAddress,
            );
          }
        }
      }
      if (instruction.governanceAction instanceof UpdateTrustedSigner264Bit) {
        const {
          targetChainId: _targetChainId,
          publicKey: _publicKey,
          expiresAt,
        } = instruction.governanceAction;

        const expiresAtMs = expiresAt * 1000n;
        if (expiresAtMs > Number.MAX_SAFE_INTEGER) {
          continue;
        }
        const _expiresAtDate = new Date(Number(expiresAtMs));
      }
      if (instruction.governanceAction instanceof UpgradeSuiLazerContract) {
        const { targetChainId, version, hash } = instruction.governanceAction;

        if (targetChainId === "sui") {
          const chain = DefaultStore.chains.sui_mainnet;

          if (!(chain instanceof SuiChain)) {
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
            continue;
          }

          const client = chain.getProvider();
          for (const contract of contracts) {
            const info = await chain.getStatePackageInfo(
              client,
              contract.stateId,
            );
            if (BigInt(info.version) + 1n !== version) {
              /* legacy no-op */
            }
          }

          await chain.updateLazerMeta(packagePath, {
            receiver_chain_id: chain.getWormholeChainId(),
            version: version.toString(),
          });
          const pkg = await chain.buildPackage(packagePath);
          const buildHash = Buffer.from(pkg.digest).toString("hex");
          if (buildHash !== hash) {
            /* legacy no-op */
          }
        } else {
          /* legacy no-op */
        }
      }
    }
  }
}

main();
