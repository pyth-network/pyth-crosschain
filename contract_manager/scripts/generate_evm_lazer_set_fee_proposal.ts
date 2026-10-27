/** biome-ignore-all lint/suspicious/noConsole: CLI script */

/**
 * Creates a governance proposal that sets the fee PythLazer charges in
 * `verifyUpdate` on each selected EVM chain. Each payload is an EvmExecute
 * instruction in which the chain's executor (the proxy owner) calls
 * `setVerificationFee(fee)`.
 *
 * Every chain is checked first: its proxy must be owned by the executor in the
 * store, that executor must trust the vault's emitter, its fee must differ from
 * the new one, and `setVerificationFee` must succeed when simulated from the
 * owner (it does not exist before 0.3.0).
 *
 * Default is a dry run. Pass --submit with --ops-key-path to create the
 * proposal.
 *
 * Usage:
 *   pnpm tsx scripts/generate_evm_lazer_set_fee_proposal.ts \
 *     --chain base_sepolia --chain arbitrum_sepolia --fee 0 \
 *     [--submit --ops-key-path <path>]
 */
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { EvmLazerContract } from "../src/core/contracts";
import { loadHotWallet } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";
import { findExecutorContract, getSelectedChains } from "./common";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Usage: $0 --chain <chain_1> --chain <chain_2> --fee <wei> [--submit --ops-key-path <path>]",
  )
  .options({
    chain: {
      demandOption: true,
      desc: "Chains to set the fee on",
      string: true,
      type: "array",
    },
    fee: {
      demandOption: true,
      desc: "New verification fee in wei",
      type: "string",
    },
    "ops-key-path": {
      desc: "Path to the ops key file (required with --submit)",
      type: "string",
    },
    submit: {
      default: false,
      desc: "Create the proposal (otherwise dry run)",
      type: "boolean",
    },
    vault: {
      default: "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj",
      desc: "Vault ID",
      type: "string",
    },
  });

async function main() {
  const argv = await parser.argv;
  const fee = BigInt(argv.fee);
  if (fee < 0n) throw new Error("--fee must not be negative");
  const chains = getSelectedChains({
    allChains: false,
    chain: argv.chain,
    testnet: false,
  });
  const vault = DefaultStore.vaults[argv.vault];
  if (!vault) throw new Error(`Vault '${argv.vault}' does not exist.`);
  const vaultEmitter = (await vault.getEmitter()).toBuffer().toString("hex");

  const payloads: Buffer[] = [];
  const summary: string[] = [];
  const problems: string[] = [];
  for (const chain of chains) {
    const contracts = Object.values(DefaultStore.lazer_contracts).filter(
      (c): c is EvmLazerContract =>
        c instanceof EvmLazerContract && c.chain.getId() === chain.getId(),
    );
    const contract = contracts[0];
    if (contracts.length !== 1 || !contract) {
      problems.push(
        `${chain.getId()}: expected 1 EVM Lazer contract in the store, found ${contracts.length}`,
      );
      continue;
    }
    try {
      const executor = findExecutorContract(chain);
      if (!executor) {
        problems.push(`${chain.getId()}: no executor contract in the store`);
        continue;
      }
      const [version, owner, currentFee, governance] = await Promise.all([
        contract.getVersion(),
        contract.getOwner(),
        contract.getVerificationFee(),
        executor.getGovernanceDataSource(),
      ]);
      if (owner.toLowerCase() !== executor.address.toLowerCase()) {
        problems.push(
          `${chain.getId()}: owner ${owner} is not the store executor ${executor.address}`,
        );
        continue;
      }
      if (governance.emitterAddress.toLowerCase() !== vaultEmitter) {
        problems.push(
          `${chain.getId()}: executor trusts emitter ${governance.emitterAddress}, not vault ${vault.getId()} (${vaultEmitter})`,
        );
        continue;
      }
      if (currentFee === fee) {
        problems.push(`${chain.getId()}: fee is already ${fee} wei`);
        continue;
      }
      const data = contract
        .getContract()
        .methods.setVerificationFee(fee.toString())
        .encodeABI();
      try {
        await chain
          .getWeb3()
          .eth.call({ data, from: owner, to: contract.address });
      } catch (error) {
        problems.push(
          `${chain.getId()}: setVerificationFee reverts when simulated from the owner (version ${version}): ${String(error)}`,
        );
        continue;
      }
      payloads.push(await contract.generateSetVerificationFeePayload(fee));
      summary.push(
        `${payloads.length}. ${chain.getId()} ${contract.address} v${version}: ${currentFee} -> ${fee} wei, executor ${owner}`,
      );
    } catch (error) {
      problems.push(`${chain.getId()}: ${String(error)}`);
    }
  }

  console.log(`\n=== ${payloads.length} payloads ===`);
  for (const line of summary) console.log(line);
  if (problems.length > 0) {
    throw new Error(
      `Not proposing. Fix or drop these chains:\n${problems.join("\n")}`,
    );
  }

  if (!argv.submit) {
    console.log(
      "\nDry run complete. Re-run with --submit --ops-key-path <path> to create the proposal.",
    );
    return;
  }
  if (!argv["ops-key-path"])
    throw new Error("--submit requires --ops-key-path");
  const wallet = await loadHotWallet(argv["ops-key-path"]);
  console.log(
    "Using vault",
    vault.getId(),
    "wallet",
    wallet.publicKey.toBase58(),
  );
  vault.connect(wallet);
  const proposal = await vault.proposeWormholeMessage(payloads);
  console.log("Proposal address", proposal.address.toBase58());
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
