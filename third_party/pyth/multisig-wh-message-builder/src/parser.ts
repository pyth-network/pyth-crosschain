import { ChainId, CHAIN_ID_SOLANA } from "@certusone/wormhole-sdk";
import {
  AccountMeta,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { pythOracleCoder, pythIdl } from "@pythnetwork/client";
import { Cluster, CONFIG } from ".";
import { Idl } from "@project-serum/anchor";

/// A summary of a proposal instruction :
/// For two proposals A and B in the multisig the set of all the summarized instructions of A and all the summarized instructions of B should have null intersection
type Summary = {
  targetChain: ChainId;
  component: OracleProgram;
};
type OracleProgram = {
  oracleAction:
    | UpdatePriceFeed
    | "updatePermissions"
    | UpdateProductAccount
    | undefined;
};

type UpdatePriceFeed = {
  priceAccount: PublicKey;
};

type UpdateProductAccount = {
  productAccount: PublicKey;
};

type NamedAccounts = Record<string, AccountMeta>;

export function parseProposalInstruction(
  cluster: Cluster,
  instruction: TransactionInstruction
) {
  switch (instruction.programId.toBase58()) {
    case CONFIG[cluster].pythOracleSolana.toBase58():
      const deserializedInstruction = pythOracleCoder().instruction.decode(
        instruction.data
      );
      if (deserializedInstruction) {
        const namedAccounts = resolveAccountNames(
          pythIdl as unknown as Idl,
          deserializedInstruction.name,
          instruction
        );
        const summary: Summary = summarizeOracleInstruction(
          deserializedInstruction.name,
          namedAccounts
        );
        return { ...deserializedInstruction, namedAccounts, summary };
      } else {
        return null;
      }

    default:
      return null;
  }
}

export function resolveAccountNames(
  idl: Idl,
  name: string,
  instruction: TransactionInstruction
): NamedAccounts {
  const ix = idl.instructions.find((ix) => ix.name == name);
  if (!ix) {
    throw Error("Instruction name not found");
  }
  let namedAccounts: NamedAccounts = {};
  ix.accounts.map((account, idx) => {
    if (idx < instruction.keys.length) {
      namedAccounts[account.name] = instruction.keys[idx];
    }
  });
  return namedAccounts;
}

export function summarizeOracleInstruction(
  name: string,
  namedAccounts: NamedAccounts
): Summary {
  switch (name) {
    case "addProduct":
    case "updProduct":
    case "delProduct":
      return {
        targetChain: CHAIN_ID_SOLANA,
        component: {
          oracleAction: { productAccount: namedAccounts.productAccount.pubkey },
        },
      };
    case "addPrice":
    case "addPublisher":
    case "delPublisher":
    case "setMinPub":
    case "delPrice":
      return {
        targetChain: CHAIN_ID_SOLANA,
        component: {
          oracleAction: { priceAccount: namedAccounts.priceAccount.pubkey },
        },
      };
    case "updPermissions":
      return {
        targetChain: CHAIN_ID_SOLANA,
        component: { oracleAction: "updatePermissions" },
      };
    default:
      return {
        targetChain: CHAIN_ID_SOLANA,
        component: { oracleAction: undefined },
      };
  }
}
