import {
  AccountType,
  getPythProgramKeyForCluster,
  PythCluster,
} from "@pythnetwork/client";
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { PRICE_FEED_OPS_KEY } from "./multisig";

/**
 * Get seed for deterministic creation of a price/product account
 * @param type Type of the account
 * @param symbol Symbol of the price feed
 * @returns
 */
function getSeed(accountType: AccountType, symbol: string): string {
  switch (accountType) {
    case AccountType.Price:
      return "price:" + symbol;
    case AccountType.Product:
      return "product:" + symbol;
    default:
      throw new Error("Unimplemented");
  }
}

/**
 * Get required account size for a given oracle account type
 * @param accountType Type of the account
 * @returns
 */
function getAccountTypeSize(accountType: AccountType): number {
  switch (accountType) {
    case AccountType.Price:
      return 3312;
    case AccountType.Product:
      return 512;
    default:
      throw new Error("Unimplemented");
  }
}

/**
 * Get the address and the seed of a deterministic price/product account
 * @param type Type of the account
 * @param symbol Symbol of the price feed
 * @param cluster Cluster in which to create the deterministic account
 * @returns
 */
export async function findDetermisticAccountAddress(
  type: AccountType,
  symbol: string,
  cluster: PythCluster
): Promise<[PublicKey, string]> {
  const seed: string = getSeed(type, symbol);
  const address: PublicKey = await PublicKey.createWithSeed(
    PRICE_FEED_OPS_KEY,
    seed,
    getPythProgramKeyForCluster(cluster)
  );
  return [address, seed];
}

/**
 * Get instruction to create a determistic price/product account
 * @param connection Connection used to compute rent, should be connected to `cluster`
 * @param cluster Cluster in which to create the determistic account
 * @param base Base for the determistic derivation
 * @param symbol Symbol of the price feed
 * @param accountType Type of the account
 * @returns
 */
export async function getCreateAccountWithSeedInstruction(
  connection: Connection,
  cluster: PythCluster,
  base: PublicKey,
  symbol: string,
  accountType: AccountType
): Promise<TransactionInstruction> {
  const [address, seed]: [PublicKey, string] =
    await findDetermisticAccountAddress(accountType, symbol, cluster);
  return SystemProgram.createAccountWithSeed({
    fromPubkey: base,
    basePubkey: base,
    newAccountPubkey: address,
    seed: seed,
    space: getAccountTypeSize(accountType),
    lamports: await connection.getMinimumBalanceForRentExemption(
      getAccountTypeSize(accountType)
    ),
    programId: getPythProgramKeyForCluster(cluster),
  });
}
