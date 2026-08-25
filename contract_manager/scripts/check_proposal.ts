/** biome-ignore-all lint/suspicious/noConsole: CLI script */
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { BN } from "@coral-xyz/anchor";
import { Wallet } from "@coral-xyz/anchor";
import type { PythCluster } from "@pythnetwork/client/lib/cluster";
import { getPythClusterApiUrl } from "@pythnetwork/client/lib/cluster";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import type { MultisigInstruction } from "@pythnetwork/xc-admin-common";
import {
  AnchorMultisigInstruction,
  BpfUpgradableLoaderInstruction,
  CosmosUpgradeContract,
  EvmExecute,
  EvmSetWormholeAddress,
  EvmUpgradeContract,
  ExecutePostedVaa,
  getProgramName,
  getProposalInstructions,
  MultisigInstructionProgram,
  MultisigParser,
  SetFee,
  UpdateTrustedSigner256Bit,
  UpdateTrustedSigner264Bit,
  UpgradeSuiLazerContract,
  WithdrawFee,
  WormholeMultisigInstruction,
} from "@pythnetwork/xc-admin-common";
import type { AccountMeta } from "@solana/web3.js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import SquadsMeshClass from "@sqds/mesh";
import Web3 from "web3";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import {
  CosmWasmChain,
  EvmChain,
  IotaChain,
  SuiChain,
  SvmChain,
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

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function getSquadsMesh() {
  // Handle nested default export from @sqds/mesh
  return (
    (SquadsMeshClass as { default?: typeof SquadsMeshClass }).default ??
    SquadsMeshClass
  );
}

// wormholeChainName is unique per deployment, so it identifies the target chain on
// its own. Filtering on the multisig's cluster instead would drop the testnet chains
// that mainnet-beta proposals legitimately target.
function evmChainsFor(targetChainId: string): EvmChain[] {
  const chains = Object.values(DefaultStore.chains).filter(
    (chain): chain is EvmChain =>
      chain instanceof EvmChain && chain.wormholeChainName === targetChainId,
  );
  if (chains.length === 0) {
    console.log(`  NO CHAIN IN STORE FOR ${targetChainId} — not checked`);
  }
  return chains;
}

function svmChainFor(
  targetChainId: string,
  cluster: PythCluster,
): SvmChain | undefined {
  const chains = Object.values(DefaultStore.chains).filter(
    (chain): chain is SvmChain =>
      chain instanceof SvmChain && chain.wormholeChainName === targetChainId,
  );
  // Solana mainnet and devnet share the "solana" wormhole chain name, so fall back
  // to the multisig's cluster to pick between them.
  return (
    chains.find(
      (chain) => chain.isMainnet() === (cluster === "mainnet-beta"),
    ) ?? chains[0]
  );
}

// UpgradeableLoaderState::Buffer is a 4-byte enum tag followed by an
// Option<Pubkey> authority; the ELF starts right after it.
const BPF_BUFFER_HEADER_SIZE = 37;
// UpgradeableLoaderState::ProgramData is a 4-byte enum tag, a u64 deploy slot and
// then an Option<Pubkey> authority.
const BPF_PROGRAM_DATA_AUTHORITY_OFFSET = 12;
const BPF_PROGRAM_DATA_HEADER_SIZE = 45;

type ReceiverDataSource = { chain: number; emitter: PublicKey };
type ReceiverConfig = {
  validDataSources: ReceiverDataSource[];
  singleUpdateFeeInLamports: BN;
};

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function accountAddress(
  instruction: MultisigInstruction,
  name: string,
): PublicKey {
  const account = instruction.accounts.named[name];
  if (account === undefined) {
    throw new Error(`${instruction.name} has no ${name} account`);
  }
  return account.pubkey;
}

async function fetchReceiverConfig(
  connection: Connection,
  config: PublicKey,
): Promise<ReceiverConfig | undefined> {
  const account = await connection.getAccountInfo(config);
  if (account === null) {
    return undefined;
  }
  const { receiver } = new PythSolanaReceiver({
    connection,
    wallet: new Wallet(Keypair.generate()), // dummy wallet
  });
  return receiver.coder.accounts.decode<ReceiverConfig>("Config", account.data);
}

async function checkReceiverInstruction(
  instruction: AnchorMultisigInstruction,
  connection: Connection,
  chainLabel: string,
): Promise<void> {
  const config = accountAddress(instruction, "config");
  console.log(
    `\nVerifying Pyth Solana Receiver ${instruction.name} on ${chainLabel}`,
  );

  if (instruction.name === "setDataSources") {
    for (const source of instruction.args
      .validDataSources as ReceiverDataSource[]) {
      console.log(
        `  new data source: chain ${source.chain} emitter ${source.emitter.toBase58()}`,
      );
    }
  } else {
    console.log(
      `  new fee: ${String(instruction.args.singleUpdateFeeInLamports)} lamports`,
    );
  }

  const current = await fetchReceiverConfig(connection, config);
  if (current === undefined) {
    console.log(
      `${chainLabel}  CONFIG DOES NOT EXIST — ${config.toBase58()} holds no account, the instruction will fail`,
    );
    return;
  }
  if (instruction.name === "setDataSources") {
    for (const source of current.validDataSources) {
      console.log(
        `${chainLabel}  Config:${config.toBase58()} current data source: chain ${source.chain} emitter ${source.emitter.toBase58()}`,
      );
    }
  } else {
    console.log(
      `${chainLabel}  Config:${config.toBase58()} current fee:${current.singleUpdateFeeInLamports.toString()} lamports`,
    );
  }
}

async function checkProgramUpgrade(
  instruction: BpfUpgradableLoaderInstruction,
  connection: Connection,
  chainLabel: string,
): Promise<void> {
  const program = accountAddress(instruction, "program");
  const programData = accountAddress(instruction, "programData");
  const buffer = accountAddress(instruction, "buffer");
  const spill = accountAddress(instruction, "spill");
  const upgradeAuthority = accountAddress(instruction, "upgradeAuthority");

  console.log(`\nVerifying program Upgrade on ${chainLabel}`);
  console.log(`  program:          ${program.toBase58()}`);
  console.log(`  programData:      ${programData.toBase58()}`);
  console.log(`  buffer:           ${buffer.toBase58()}`);
  console.log(`  spill:            ${spill.toBase58()}`);
  console.log(`  upgradeAuthority: ${upgradeAuthority.toBase58()}`);

  const bufferAccount = await connection.getAccountInfo(buffer);
  if (bufferAccount === null) {
    console.log(
      `${chainLabel}  BUFFER DOES NOT EXIST — ${buffer.toBase58()} holds no account, the upgrade will fail`,
    );
  } else {
    const elf = bufferAccount.data.subarray(BPF_BUFFER_HEADER_SIZE);
    console.log(
      `${chainLabel}  new ELF length:${elf.length} sha256:${sha256(elf)}`,
    );
  }

  const programDataAccount = await connection.getAccountInfo(programData);
  if (programDataAccount === null) {
    console.log(
      `${chainLabel}  PROGRAM DATA DOES NOT EXIST — ${programData.toBase58()} holds no account, the upgrade will fail`,
    );
    return;
  }
  const deployed = programDataAccount.data.subarray(
    BPF_PROGRAM_DATA_HEADER_SIZE,
  );
  console.log(
    `${chainLabel}  deployed ELF length:${deployed.length} sha256:${sha256(deployed)}`,
  );

  const hasAuthority =
    programDataAccount.data[BPF_PROGRAM_DATA_AUTHORITY_OFFSET] !== 0;
  if (!hasAuthority) {
    console.log(
      `${chainLabel}  PROGRAM IS IMMUTABLE — ${programData.toBase58()} has no upgrade authority, the upgrade will fail`,
    );
    return;
  }
  const currentAuthority = new PublicKey(
    programDataAccount.data.subarray(
      BPF_PROGRAM_DATA_AUTHORITY_OFFSET + 1,
      BPF_PROGRAM_DATA_HEADER_SIZE,
    ),
  );
  if (currentAuthority.equals(upgradeAuthority)) {
    console.log(
      `${chainLabel}  upgrade authority matches:${currentAuthority.toBase58()}`,
    );
  } else {
    console.log(
      `${chainLabel}  UPGRADE AUTHORITY MISMATCH — ${programData.toBase58()} is controlled by ${currentAuthority.toBase58()} but the instruction signs as ${upgradeAuthority.toBase58()}, the upgrade will fail`,
    );
  }
}

async function checkSvmInstruction(
  instruction: MultisigInstruction,
  connection: Connection,
  chainLabel: string,
): Promise<void> {
  if (
    instruction instanceof AnchorMultisigInstruction &&
    instruction.program === MultisigInstructionProgram.SolanaReceiver &&
    (instruction.name === "setDataSources" || instruction.name === "setFee")
  ) {
    await checkReceiverInstruction(instruction, connection, chainLabel);
  } else if (
    instruction instanceof BpfUpgradableLoaderInstruction &&
    instruction.name === "Upgrade"
  ) {
    await checkProgramUpgrade(instruction, connection, chainLabel);
  } else {
    console.log(
      `\n${chainLabel}  NOT CHECKED — ${getProgramName(instruction.program)} ${instruction.name}`,
    );
  }
}

async function checkExecutePostedVaa(
  action: ExecutePostedVaa,
  multisigParser: MultisigParser,
  cluster: PythCluster,
): Promise<void> {
  console.log(`\nVerifying ExecutePostedVaa on ${action.targetChainId}`);
  const chain = svmChainFor(action.targetChainId, cluster);
  if (chain === undefined) {
    console.log(
      `  NO SVM CHAIN IN STORE FOR ${action.targetChainId} — ${action.instructions.length} inner instruction(s) not checked`,
    );
    return;
  }
  for (const inner of action.instructions) {
    await checkSvmInstruction(
      multisigParser.parseInstruction(inner),
      chain.getConnection(),
      chain.getId(),
    );
  }
}

function pythContractsOn(chain: EvmChain): EvmPriceFeedContract[] {
  return Object.values(DefaultStore.contracts).filter(
    (contract): contract is EvmPriceFeedContract =>
      contract instanceof EvmPriceFeedContract &&
      contract.getChain().getId() === chain.getId(),
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
  const clusterConnection = new Connection(getPythClusterApiUrl(cluster));

  for (const instruction of parsedInstructions) {
    if (
      instruction instanceof AnchorMultisigInstruction ||
      instruction instanceof BpfUpgradableLoaderInstruction
    ) {
      await checkSvmInstruction(instruction, clusterConnection, cluster);
    }
    if (instruction instanceof WormholeMultisigInstruction) {
      if (instruction.governanceAction instanceof ExecutePostedVaa) {
        await checkExecutePostedVaa(
          instruction.governanceAction,
          multisigParser,
          cluster,
        );
      }
      if (instruction.governanceAction instanceof EvmSetWormholeAddress) {
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
        const { address, targetChainId } = instruction.governanceAction;
        console.log(`Verifying EVM Upgrade Contract on ${targetChainId}`);
        for (const chain of evmChainsFor(targetChainId)) {
          const contract = new EvmPriceFeedContract(chain, address);
          const code = await contract.getCodeDigestWithoutAddress();
          // this should be the same keccak256 of the deployedCode property generated by truffle
          console.log(`${chain.getId()}  Address:${address} digest:${code}`);
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
      if (instruction.governanceAction instanceof SetFee) {
        const { targetChainId, newFeeValue, newFeeExpo } =
          instruction.governanceAction;
        const newFee = instruction.governanceAction.getNewFeeAmount();

        console.log(`\nVerifying SetFee on ${targetChainId}`);
        console.log(
          `  new fee: ${
            newFee ?? `<expo ${newFeeExpo} exceeds ${SetFee.MAX_EXPO}>`
          } (${newFeeValue} * 10^${newFeeExpo})`,
        );
        for (const chain of evmChainsFor(targetChainId)) {
          for (const contract of pythContractsOn(chain)) {
            const currentFee = await contract.getBaseUpdateFee();
            console.log(
              `${chain.getId()}  Address:${contract.address} current fee:${currentFee.amount}`,
            );
          }
        }
      }
      if (instruction.governanceAction instanceof WithdrawFee) {
        const { targetChainId, expo } = instruction.governanceAction;
        const recipient = `0x${instruction.governanceAction.targetAddress.toString("hex")}`;
        const requested = instruction.governanceAction.getTotalAmount();

        console.log(`\nVerifying WithdrawFee on ${targetChainId}`);
        console.log(`  recipient: ${recipient}`);
        console.log(
          `  amount:    ${
            requested ?? `<expo ${expo} exceeds ${WithdrawFee.MAX_EXPO}>`
          }`,
        );
        for (const chain of evmChainsFor(targetChainId)) {
          const web3 = chain.getWeb3();
          const hasCode = (await web3.eth.getCode(recipient)) !== "0x";
          const recipientBalance = BigInt(await web3.eth.getBalance(recipient));
          if (hasCode || recipientBalance > 0n) {
            console.log(
              `${chain.getId()}  recipient exists — code:${hasCode ? "yes" : "no"} balance:${recipientBalance}`,
            );
          } else {
            console.log(
              `${chain.getId()}  RECIPIENT DOES NOT EXIST — ${recipient} has no code and no balance on this chain`,
            );
          }
          // A chain can host several Pyth deployments, only one of which
          // executes this instruction, so the withdrawal only definitely
          // reverts when none of them holds the requested amount.
          let funded = false;
          for (const contract of pythContractsOn(chain)) {
            const balance = (await contract.getTotalFee()).amount;
            funded ||= requested !== undefined && requested <= balance;
            console.log(
              `${chain.getId()}  Address:${contract.address} balance:${balance}`,
            );
          }
          if (requested !== undefined && !funded) {
            console.log(
              `${chain.getId()}  INSUFFICIENT BALANCE — no Pyth contract on ${chain.getId()} holds ${requested}, withdrawFee reverts`,
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
}

main();
