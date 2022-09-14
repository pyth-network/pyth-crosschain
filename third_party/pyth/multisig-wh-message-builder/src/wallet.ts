import type { default as Transport } from "@ledgerhq/hw-transport";
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import { Wallet } from "@project-serum/anchor/dist/cjs/provider.js";
import type { PublicKey, Transaction } from "@solana/web3.js";
import { getDerivationPath, getPublicKey, signTransaction } from "./util";

export class LedgerNodeWallet implements Wallet {
  private _derivationPath: Buffer;
  private _transport: Transport;
  publicKey: PublicKey;

  constructor(
    derivationPath: Buffer,
    transport: Transport,
    publicKey: PublicKey
  ) {
    this._derivationPath = derivationPath;
    this._transport = transport;
    this.publicKey = publicKey;
  }

  static async createWallet(
    derivationAccount?: number,
    derivationChange?: number
  ): Promise<LedgerNodeWallet> {
    const transport = await TransportNodeHid.create();
    const derivationPath = getDerivationPath(
      derivationAccount,
      derivationChange
    );
    const publicKey = await getPublicKey(transport, derivationPath);
    return new LedgerNodeWallet(derivationPath, transport, publicKey);
  }

  async signTransaction(transaction: Transaction): Promise<Transaction> {
    const transport = this._transport;
    const publicKey = this.publicKey;

    const signature = await signTransaction(
      transport,
      transaction,
      this._derivationPath
    );
    transaction.addSignature(publicKey, signature);
    return transaction;
  }

  async signAllTransactions(txs: Transaction[]): Promise<Transaction[]> {
    return await Promise.all(txs.map((tx) => this.signTransaction(tx)));
  }
}
