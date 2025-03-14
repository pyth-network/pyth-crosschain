import { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";
import Transport, {
  StatusCodes,
  TransportStatusError,
} from "@ledgerhq/hw-transport";
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

export class LedgerNodeWallet implements Wallet {
  private _derivationPath: Buffer;
  private _transport: Transport;
  publicKey: PublicKey;

  constructor(
    derivationPath: Buffer,
    transport: Transport,
    publicKey: PublicKey,
  ) {
    this._derivationPath = derivationPath;
    this._transport = transport;
    this.publicKey = publicKey;
  }

  static async createWallet(
    derivationAccount?: number,
    derivationChange?: number,
  ): Promise<LedgerNodeWallet> {
    const transport = await TransportNodeHid.create();
    const derivationPath = getDerivationPath(
      derivationAccount,
      derivationChange,
    );
    const publicKey = await getPublicKey(transport, derivationPath);
    console.log(`Loaded ledger: ${publicKey.toBase58()}}`);
    return new LedgerNodeWallet(derivationPath, transport, publicKey);
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(
    tx: T,
  ): Promise<T> {
    console.log("Please approve the transaction on your ledger device...");
    const transport = this._transport;
    const publicKey = this.publicKey;

    if (tx instanceof Transaction) {
      const signature = await signTransaction(
        transport,
        tx,
        this._derivationPath,
      );
      tx.addSignature(publicKey, signature);
    } else {
      // Handle VersionedTransaction if necessary
      throw new Error("VersionedTransaction is not supported yet.");
    }
    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: T[],
  ): Promise<T[]> {
    return await Promise.all(txs.map((tx) => this.signTransaction(tx)));
  }
}

/** @internal */
function getDerivationPath(account?: number, change?: number): Buffer {
  const length = account !== undefined ? (change === undefined ? 3 : 4) : 2;
  const derivationPath = Buffer.alloc(1 + length * 4);

  let offset = derivationPath.writeUInt8(length, 0);
  offset = derivationPath.writeUInt32BE(harden(44), offset); // Using BIP44
  offset = derivationPath.writeUInt32BE(harden(501), offset); // Solana's BIP44 path

  if (account !== undefined) {
    offset = derivationPath.writeUInt32BE(harden(account), offset);
    if (change !== undefined) {
      derivationPath.writeUInt32BE(harden(change), offset);
    }
  }

  return derivationPath;
}

const BIP32_HARDENED_BIT = (1 << 31) >>> 0;

/** @internal */
function harden(n: number): number {
  return (n | BIP32_HARDENED_BIT) >>> 0;
}

const INS_GET_PUBKEY = 0x05;
const INS_SIGN_MESSAGE = 0x06;

const P1_NON_CONFIRM = 0x00;
const P1_CONFIRM = 0x01;

const P2_EXTEND = 0x01;
const P2_MORE = 0x02;

const MAX_PAYLOAD = 255;

const LEDGER_CLA = 0xe0;

/** @internal */
export async function getPublicKey(
  transport: Transport,
  derivationPath: Buffer,
): Promise<PublicKey> {
  const bytes = await send(
    transport,
    INS_GET_PUBKEY,
    P1_NON_CONFIRM,
    derivationPath,
  );
  return new PublicKey(bytes);
}

/** @internal */
export async function signTransaction(
  transport: Transport,
  transaction: Transaction,
  derivationPath: Buffer,
): Promise<Buffer> {
  const paths = Buffer.alloc(1);
  paths.writeUInt8(1, 0);

  const message = transaction.serializeMessage();
  const data = Buffer.concat([paths, derivationPath, message]);

  return await send(transport, INS_SIGN_MESSAGE, P1_CONFIRM, data);
}

/** @internal */
async function send(
  transport: Transport,
  instruction: number,
  p1: number,
  data: Buffer,
): Promise<Buffer> {
  let p2 = 0;
  let offset = 0;

  if (data.length > MAX_PAYLOAD) {
    while (data.length - offset > MAX_PAYLOAD) {
      const buffer = data.subarray(offset, offset + MAX_PAYLOAD);
      const response = await transport.send(
        LEDGER_CLA,
        instruction,
        p1,
        p2 | P2_MORE,
        buffer,
      );
      if (response.length !== 2)
        throw new TransportStatusError(StatusCodes.INCORRECT_DATA);

      p2 |= P2_EXTEND;
      offset += MAX_PAYLOAD;
    }
  }

  const buffer = data.subarray(offset);
  const response = await transport.send(
    LEDGER_CLA,
    instruction,
    p1,
    p2,
    buffer,
  );

  return response.subarray(0, response.length - 2);
}
