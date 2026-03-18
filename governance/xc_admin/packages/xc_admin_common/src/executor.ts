import {
  deriveFeeCollectorKey,
  getWormholeBridgeData,
} from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import type { Wallet } from "@coral-xyz/anchor";
import { AccountType, parseProductData } from "@pythnetwork/client";
import type { PythCluster } from "@pythnetwork/client/lib/cluster";
import type { PriorityFeeConfig } from "@pythnetwork/solana-utils";
import {
  sendTransactions,
  TransactionBuilder,
} from "@pythnetwork/solana-utils";
import type { AccountMeta, Commitment, PublicKey } from "@solana/web3.js";
import { SystemProgram, Transaction } from "@solana/web3.js";
import type SquadsMesh from "@sqds/mesh";
import { getIxPDA } from "@sqds/mesh";
import type { TransactionAccount } from "@sqds/mesh/lib/types";
import BN from "bn.js";
import { getCreateAccountWithSeedInstruction } from "./deterministic_oracle_accounts";
import {
  MultisigParser,
  PythMultisigInstruction,
  WormholeMultisigInstruction,
} from "./multisig_transaction";

/**
 * Returns the instruction to pay the fee for a wormhole postMessage instruction
 * This instruction is usually not included in the proposals to save space and shorten the tx size
 * @param wormholeBridgeAddress address of the wormhole bridge program deployed on the cluster
 * @param squad
 */
export async function getPostMessageFeeInstruction(
  wormholeBridgeAddress: PublicKey,
  squad: SquadsMesh,
) {
  const wormholeFee = wormholeBridgeAddress
    ? (
        await getWormholeBridgeData(
          squad.connection,
          wormholeBridgeAddress,
          "confirmed",
        )
      ).config.fee
    : 0;

  return SystemProgram.transfer({
    fromPubkey: squad.wallet.publicKey,
    lamports: wormholeFee,
    toPubkey: deriveFeeCollectorKey(wormholeBridgeAddress),
  });
}

/**
 * Continues executing a multisig proposal from the last executed instruction
 * Each instruction is executed in a separate transaction
 * Returns the signatures of the executed transactions
 * @param proposal the account which stores the proposed transaction
 * @param squad squad owning the proposal
 * @param cluster cluster the proposal and squad are on
 * @param commitment commitment level to use for RPC calls
 */
export async function executeProposal(
  proposal: TransactionAccount,
  squad: SquadsMesh,
  cluster: PythCluster,
  _: Commitment = "confirmed",
  priorityFeeConfig: PriorityFeeConfig,
) {
  const multisigParser = MultisigParser.fromCluster(cluster);
  const signatures: string[] = [];
  for (
    let i = proposal.executedIndex + 1;
    i <= proposal.instructionIndex;
    i++
  ) {
    const instructionPda = getIxPDA(
      proposal.publicKey,
      new BN(i),
      squad.multisigProgramId,
    )[0];
    const instruction = await squad.getInstruction(instructionPda);
    const parsedInstruction = multisigParser.parseInstruction({
      data: instruction.data as Buffer,
      keys: instruction.keys as AccountMeta[],
      programId: instruction.programId,
    });
    const transaction = new Transaction();

    if (
      parsedInstruction instanceof WormholeMultisigInstruction &&
      parsedInstruction.name == "postMessage"
    ) {
      transaction.add(
        await getPostMessageFeeInstruction(
          // biome-ignore lint/style/noNonNullAssertion: legacy assertion
          multisigParser.wormholeBridgeAddress!,
          squad,
        ),
      );
    } else if (
      parsedInstruction instanceof PythMultisigInstruction &&
      parsedInstruction.name == "addProduct"
    ) {
      /// Add product, fetch the symbol from the instruction
      transaction.add(
        await getCreateAccountWithSeedInstruction(
          squad.connection,
          cluster,
          squad.wallet.publicKey,
          parsedInstruction.args.symbol,
          AccountType.Product,
        ),
      );
    } else if (
      parsedInstruction instanceof PythMultisigInstruction &&
      parsedInstruction.name == "addPrice"
    ) {
      /// Add price, fetch the symbol from the product account
      const productAccountPubkey =
        parsedInstruction.accounts.named.productAccount?.pubkey;
      if (!productAccountPubkey) {
        throw new Error(
          "productAccount pubkey is required for addPrice instruction",
        );
      }
      const productAccount =
        await squad.connection.getAccountInfo(productAccountPubkey);
      if (productAccount) {
        transaction.add(
          await getCreateAccountWithSeedInstruction(
            squad.connection,
            cluster,
            squad.wallet.publicKey,
            // biome-ignore lint/style/noNonNullAssertion: legacy assertion
            parseProductData(productAccount.data).product.symbol!,
            AccountType.Price,
          ),
        );
      } else {
        throw new Error("Product account not found");
      }
    }

    TransactionBuilder.addPriorityFee(transaction, priorityFeeConfig);

    transaction.add(
      await squad.buildExecuteInstruction(
        proposal.publicKey,
        getIxPDA(proposal.publicKey, new BN(i), squad.multisigProgramId)[0],
      ),
    );

    signatures.push(
      ...(await sendTransactions(
        [{ signers: [], tx: transaction }],
        squad.connection,
        squad.wallet as Wallet,
      )),
    );
  }
  return signatures;
}
