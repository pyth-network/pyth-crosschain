import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { CosmWasmChain, EvmChain } from "../src/chains";
import { createHash } from "crypto";
import { DefaultStore } from "../src/store";
import {
  CosmosUpgradeContract,
  EvmExecute,
  EvmSetWormholeAddress,
  EvmUpgradeContract,
  getProposalInstructions,
  MultisigParser,
  WormholeMultisigInstruction,
} from "xc_admin_common";
import SquadsMesh from "@sqds/mesh";
import {
  getPythClusterApiUrl,
  PythCluster,
} from "@pythnetwork/client/lib/cluster";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { AccountMeta, Keypair, PublicKey } from "@solana/web3.js";
import {
  EvmEntropyContract,
  EvmPriceFeedContract,
  WormholeEvmContract,
} from "../src/contracts/evm";
import Web3 from "web3";

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0 --cluster <cluster_id> --proposal <proposal_address>")
  .options({
    cluster: {
      type: "string",
      demandOption: true,
      desc: "Multsig Cluster name to check proposal on can be one of [devnet, testnet, mainnet-beta]",
    },
    proposal: {
      type: "string",
      demandOption: true,
      desc: "The proposal address to check",
    },
  });

async function main() {
  const argv = await parser.argv;
  const cluster = argv.cluster as PythCluster;
  const squad = SquadsMesh.endpoint(
    getPythClusterApiUrl(cluster),
    new NodeWallet(Keypair.generate()) // dummy wallet
  );
  const transaction = await squad.getTransaction(new PublicKey(argv.proposal));
  const instructions = await getProposalInstructions(squad, transaction);
  const multisigParser = MultisigParser.fromCluster(cluster);
  const parsedInstructions = instructions.map((instruction) => {
    return multisigParser.parseInstruction({
      programId: instruction.programId,
      data: instruction.data as Buffer,
      keys: instruction.keys as AccountMeta[],
    });
  });

  for (const instruction of parsedInstructions) {
    if (instruction instanceof WormholeMultisigInstruction) {
      if (instruction.governanceAction instanceof EvmSetWormholeAddress) {
        console.log(
          `Verifying EVM set wormhole address on ${instruction.governanceAction.targetChainId}`
        );
        for (const chain of Object.values(DefaultStore.chains)) {
          if (
            chain instanceof EvmChain &&
            chain.wormholeChainName ===
              instruction.governanceAction.targetChainId
          ) {
            const address = instruction.governanceAction.address;
            const contract = new WormholeEvmContract(chain, address);
            const currentIndex = await contract.getCurrentGuardianSetIndex();
            const guardianSet = await contract.getGuardianSet();

            const proxyContract = new EvmPriceFeedContract(chain, address);
            const proxyCode = await proxyContract.getCode();
            const receiverImplementation =
              await proxyContract.getImplementationAddress();
            const implementationCode = await new EvmPriceFeedContract(
              chain,
              receiverImplementation
            ).getCode();
            const proxyDigest = Web3.utils.keccak256(proxyCode);
            const implementationDigest =
              Web3.utils.keccak256(implementationCode);
            const guardianSetDigest = Web3.utils.keccak256(
              JSON.stringify(guardianSet)
            );
            console.log(
              `${chain.getId()}  Address:\t\t${address}\nproxy digest:\t\t${proxyDigest}\nimplementation digest:\t${implementationDigest} \nguardian set index:\t${currentIndex} \nguardian set:\t\t${guardianSetDigest}`
            );
          }
        }
      }
      if (instruction.governanceAction instanceof EvmUpgradeContract) {
        console.log(
          `Verifying EVM Upgrade Contract on ${instruction.governanceAction.targetChainId}`
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
      if (instruction.governanceAction instanceof CosmosUpgradeContract) {
        console.log(
          `Verifying Cosmos Upgrade Contract on ${instruction.governanceAction.targetChainId}`
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
                .digest("hex")}`
            );
          }
        }
      }
      if (instruction.governanceAction instanceof EvmExecute) {
        // Note: it only checks for upgrade entropy contracts right now
        console.log(
          `Verifying EVMExecute Contract on ${instruction.governanceAction.targetChainId}`
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

            // currently executor is only being used by the entropy contract
            const contract = new EvmEntropyContract(chain, callAddress);
            const owner = await contract.getOwner();

            if (
              executorAddress.toUpperCase() !==
              owner.replace("0x", "").toUpperCase()
            ) {
              console.log(
                `Executor Address: ${executorAddress.toUpperCase()} is not equal to Owner Address: ${owner
                  .replace("0x", "")
                  .toUpperCase()}`
              );
              continue;
            }

            const calldataHex = calldata.toString("hex");
            let newImplementationAddress: string | undefined = undefined;
            // Method signature for upgradeTo method is 3659cfe6
            if (calldataHex.startsWith("3659cfe6000000000000000000000000")) {
              newImplementationAddress = calldataHex.replace(
                "3659cfe6000000000000000000000000",
                "0x"
              );
            }

            if (newImplementationAddress === undefined) {
              console.log(
                `No new implementation address found for ${chain.getId()}`
              );
              continue;
            }

            const newImplementationContract = new EvmEntropyContract(
              chain,
              newImplementationAddress
            );

            const newImplementationCode =
              await newImplementationContract.getCodeDigestWithoutAddress();
            // this should be the same keccak256 of the deployedCode property generated by truffle
            console.log(
              `${chain.getId()}  new implementation address:${newImplementationAddress} digest:${newImplementationCode}`
            );
          }
        }
      }
    }
  }
}

main();
