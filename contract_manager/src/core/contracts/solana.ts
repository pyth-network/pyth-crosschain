import { createHash } from "node:crypto";

import { AnchorProvider, Program, utils, Wallet } from "@coral-xyz/anchor";
import type { PythLazerSolanaContract } from "@pythnetwork/pyth-lazer-solana-sdk";
import { PYTH_LAZER_SOLANA_CONTRACT_IDL } from "@pythnetwork/pyth-lazer-solana-sdk";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { sleep } from "../../utils/sleep";
import { Storable } from "../base";
import type { Chain } from "../chains";
import { SvmChain } from "../chains";

const { bs58 } = utils.bytes;

/** Seed for the program's singleton `Storage` PDA (`b"storage"`). */
const STORAGE_SEED = Buffer.from("storage");

/** A 20-byte EVM address as a `0x`-prefixed lowercase hex string. */
export type EvmAddress = string;

function evmAddressToBytes(address: EvmAddress): number[] {
  const hex = address.startsWith("0x") ? address.slice(2) : address;
  const bytes = Buffer.from(hex, "hex");
  if (bytes.length !== 20) {
    throw new Error(`EVM address must be 20 bytes, got ${bytes.length}`);
  }
  return [...bytes];
}

function bytesToEvmAddress(bytes: ArrayLike<number>): EvmAddress {
  return "0x" + Buffer.from(Array.from(bytes)).toString("hex");
}

/**
 * Lazer on Solana is a single Anchor program (`pyth-lazer-solana-contract`),
 * gated directly by an on-chain `top_authority: Signer` constraint — there is no
 * Wormhole executor / VAA dispatch like the EVM / Sui / Stellar deployments. The
 * `top_authority` is the Pyth DAO Squads multisig signer on mainnet.
 *
 * The program keeps two independent trusted-signer sets in its singleton
 * `Storage` account:
 * - `trusted_signers` — ed25519 keys (Solana pubkeys), used to verify ed25519
 *   Lazer messages.
 * - `trusted_ecdsa_signers` — secp256k1 keys identified by 20-byte EVM address,
 *   used to verify ECDSA Lazer messages.
 *
 * Each set is a fixed-size array with a separate `num_*` counter; only the first
 * `num_*` entries are live. Setting a signer's `expires_at` to 0 removes it.
 */
export class SolanaLazerContract extends Storable {
  static type = "SolanaLazerContract";

  /**
   * @param chain - the Solana (SVM) chain this program is deployed on
   * @param programId - base58 program id of the `pyth-lazer-solana-contract`
   */
  constructor(
    public readonly chain: SvmChain,
    public readonly programId: string,
  ) {
    super();
  }

  getId(): string {
    return `${this.chain.getId()}_${this.programId}`;
  }

  getType(): string {
    return SolanaLazerContract.type;
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      programId: this.programId,
      type: SolanaLazerContract.type,
    };
  }

  static fromJson(
    chain: Chain,
    parsed: { type: string; programId: string },
  ): SolanaLazerContract {
    if (parsed.type !== SolanaLazerContract.type) {
      throw new Error("Invalid type");
    }
    if (!(chain instanceof SvmChain)) {
      throw new Error(`Wrong chain type ${chain}`);
    }
    return new SolanaLazerContract(chain, parsed.programId);
  }

  /** Address of the singleton `Storage` PDA derived from the program id. */
  getStoragePda(): PublicKey {
    return PublicKey.findProgramAddressSync(
      [STORAGE_SEED],
      new PublicKey(this.programId),
    )[0];
  }

  /**
   * Build an Anchor program client. A wallet is only used to sign + pay for
   * `update*` instructions; read-only callers pass a throwaway wallet. The IDL's
   * canonical `address` is overridden with this instance's `programId` so the
   * client also works against a throwaway devnet deployment.
   */
  private getProgram(wallet: Wallet): Program<PythLazerSolanaContract> {
    const provider = new AnchorProvider(this.chain.getConnection(), wallet, {
      commitment: "confirmed",
    });
    // Override the IDL's canonical `address` with this instance's programId so
    // the client also works against a throwaway devnet deployment. The cast
    // re-widens past the IDL's literal `address` type.
    const idl = {
      ...PYTH_LAZER_SOLANA_CONTRACT_IDL,
      address: this.programId,
    } as PythLazerSolanaContract;
    return new Program<PythLazerSolanaContract>(idl, provider);
  }

  private async fetchStorage() {
    // Reads never sign; a throwaway wallet satisfies the provider interface.
    const program = this.getProgram(new Wallet(Keypair.generate()));
    return await program.account.storage.fetch(this.getStoragePda());
  }

  /** Read the `top_authority` authorized to update trusted signers (base58). */
  async getTopAuthority(): Promise<string> {
    const storage = await this.fetchStorage();
    return storage.topAuthority.toBase58();
  }

  /**
   * Read the live ed25519 trusted signers — the first `num_trusted_signers`
   * array entries.
   *
   * @returns one entry per signer: base58 `publicKey` and `expiresAt` (unix
   *   seconds)
   */
  async getTrustedSigners(): Promise<
    { publicKey: string; expiresAt: bigint }[]
  > {
    const storage = await this.fetchStorage();
    // Anchor cannot resolve the `TrustedSignerInfo<T>` generic, so `pubkey`
    // decodes as `unknown`; it is a `PublicKey` (resp. 20-byte array) at runtime.
    return storage.trustedSigners
      .slice(0, storage.numTrustedSigners)
      .map((signer) => ({
        publicKey: (signer.pubkey as PublicKey).toBase58(),
        expiresAt: BigInt(signer.expiresAt.toString()),
      }));
  }

  /**
   * Read the live secp256k1 trusted signers, keyed by 20-byte EVM address — the
   * first `num_trusted_ecdsa_signers` entries.
   *
   * @returns one entry per signer: `0x`-prefixed `address` and `expiresAt` (unix
   *   seconds)
   */
  async getTrustedEcdsaSigners(): Promise<
    { address: EvmAddress; expiresAt: bigint }[]
  > {
    const storage = await this.fetchStorage();
    return storage.trustedEcdsaSigners
      .slice(0, storage.numTrustedEcdsaSigners)
      .map((signer) => ({
        address: bytesToEvmAddress(signer.pubkey as number[]),
        expiresAt: BigInt(signer.expiresAt.toString()),
      }));
  }

  /**
   * Add, update, or (with `expiresAt = 0`) remove an ed25519 trusted signer. The
   * caller supplies the `top_authority` keypair directly — on mainnet this is the
   * DAO Squads multisig; for testing it is a keypair you control.
   *
   * @returns the transaction signature
   */
  async updateTrustedSigner(
    topAuthority: Keypair,
    trustedSigner: PublicKey,
    expiresAt: bigint,
  ): Promise<string> {
    const program = this.getProgram(new Wallet(topAuthority));
    return await program.methods
      .update(trustedSigner, new BN(expiresAt.toString()))
      .accountsPartial({
        storage: this.getStoragePda(),
        topAuthority: topAuthority.publicKey,
      })
      .signers([topAuthority])
      .rpc();
  }

  /**
   * Add, update, or (with `expiresAt = 0`) remove a secp256k1 trusted signer,
   * identified by its 20-byte EVM address.
   *
   * @returns the transaction signature
   */
  async updateTrustedEcdsaSigner(
    topAuthority: Keypair,
    trustedSigner: EvmAddress,
    expiresAt: bigint,
  ): Promise<string> {
    const program = this.getProgram(new Wallet(topAuthority));
    return await program.methods
      .updateEcdsaSigner(
        evmAddressToBytes(trustedSigner),
        new BN(expiresAt.toString()),
      )
      .accountsPartial({
        storage: this.getStoragePda(),
        topAuthority: topAuthority.publicKey,
      })
      .signers([topAuthority])
      .rpc();
  }
}

/**
 * The Pyth Core price-feed programs on SVM, as published in the Core upgrade docs. Every
 * per-feed account address changes across the upgrade, so the two deployments are entirely
 * separate on-chain and are counted separately.
 *
 * These are constants rather than store entries because a `PriceFeedContract` subclass would
 * have to stub out a dozen governance/point-read methods the SVM deployment does not expose,
 * and the scan needs only the program ids.
 */
export const SVM_PRICE_FEED_PROGRAMS = {
  legacy: {
    pushOracle: "pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT",
    receiver: "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ",
  },
  upgraded: {
    pushOracle: "pyt2F414BA6dPttK6RddPZUdHfapoBN24GL5wbrPCou",
    receiver: "rec2HHDDnjLfj4kE7VyEtFA1HPGQLK33259532cRyHp",
  },
} as const;

/** Number of receiver price posts keyed by 64-char hex feed id, without the `0x` prefix. */
export type SvmPriceFeedUpdateCounts = Map<string, number>;

export type SvmPriceFeedUpdateBatch = {
  fromSlot: number;
  toSlot: number;
  counts: SvmPriceFeedUpdateCounts;
};

export type SvmPriceFeedUpdateScanOptions = {
  fromSlot: number;
  toSlot: number;
  /**
   * `getTransaction` calls per JSON-RPC batch. The public endpoint answers 5 and rejects the
   * rest of a 20-batch with HTTP 429, so this is deliberately tiny by default.
   */
  batchSize?: number;
  onRetry?: (message: string) => void;
};

function anchorDiscriminator(name: string): string {
  return createHash("sha256")
    .update(`global:${name}`)
    .digest()
    .subarray(0, 8)
    .toString("hex");
}

type SvmInstruction = { programIdIndex: number; data: string };

type SvmTransaction = {
  slot: number;
  transaction: {
    message: { accountKeys: string[]; instructions: SvmInstruction[] };
  };
  meta: {
    innerInstructions?: { instructions: SvmInstruction[] }[];
    loadedAddresses?: { writable: string[]; readonly: string[] };
  } | null;
};

/**
 * Counts Pyth price posts on an SVM chain over a slot range.
 *
 * There is no log/event equivalent of the EVM `PriceFeedUpdate` here — the receiver program
 * emits nothing — so updates are reconstructed from instruction data. Two traps this handles:
 *
 * - On a sponsored push the *top-level* instruction belongs to the push-oracle program and the
 *   receiver's `post_update` is a CPI, so `message.instructions` alone matches nothing;
 *   `meta.innerInstructions` has to be walked too.
 * - These are v0 transactions using address lookup tables, so `meta.loadedAddresses` must be
 *   appended to `accountKeys` before resolving `programIdIndex`.
 *
 * Only the receiver instructions are counted. They are the actual writes and cover both
 * sponsored pushes and consumer pull updates, whereas the push-oracle instruction is a
 * strict subset that would double-count if added.
 */
export class SvmPriceFeedUpdateScanner {
  constructor(
    public chain: SvmChain,
    public receiverProgramId: string,
  ) {}

  async *streamPriceFeedUpdateCounts(
    options: SvmPriceFeedUpdateScanOptions,
  ): AsyncGenerator<SvmPriceFeedUpdateBatch> {
    const { batchSize = 5, fromSlot, onRetry, toSlot } = options;
    const postUpdate = anchorDiscriminator("post_update");
    const postUpdateAtomic = anchorDiscriminator("post_update_atomic");

    // Signatures are only enumerable newest-first, so the scan walks the window backwards and
    // each yielded batch closes off the *bottom* of the range covered so far. Enumeration
    // always starts at the chain head, which on a resumed run sits well above `toSlot`, so
    // pages above the window are paged past without being counted or reported as covered.
    let before: string | undefined;
    let frontier = toSlot;
    for (;;) {
      const signatures = await this.rpc<
        { signature: string; slot: number; err: unknown }[]
      >(
        "getSignaturesForAddress",
        [
          this.receiverProgramId,
          { limit: 1000, ...(before === undefined ? {} : { before }) },
        ],
        onRetry,
      );
      if (signatures.length === 0) return;

      const inWindow = signatures.filter(
        (signature) =>
          signature.slot >= fromSlot &&
          signature.slot <= toSlot &&
          signature.err === null,
      );
      const counts: SvmPriceFeedUpdateCounts = new Map();
      for (let index = 0; index < inWindow.length; index += batchSize) {
        const chunk = inWindow.slice(index, index + batchSize);
        const transactions = await this.getTransactions(
          chunk.map((signature) => signature.signature),
          onRetry,
        );
        for (const transaction of transactions) {
          for (const feedId of this.extractFeedIds(
            transaction,
            postUpdate,
            postUpdateAtomic,
          )) {
            counts.set(feedId, (counts.get(feedId) ?? 0) + 1);
          }
        }
      }

      const last = signatures.at(-1);
      if (last === undefined) return;
      const reachedWindowStart = last.slot < fromSlot;
      const batchBottom = reachedWindowStart ? fromSlot : last.slot;
      // While the page is still entirely above the window there is nothing to close off —
      // reporting `batchBottom` as covered here would claim a range above `toSlot`.
      if (batchBottom <= frontier) {
        yield { counts, fromSlot: batchBottom, toSlot: frontier };
        frontier = batchBottom - 1;
      }
      if (reachedWindowStart || signatures.length < 1000) return;
      before = last.signature;
    }
  }

  private extractFeedIds(
    transaction: SvmTransaction,
    postUpdate: string,
    postUpdateAtomic: string,
  ): string[] {
    const keys = [
      ...transaction.transaction.message.accountKeys,
      ...(transaction.meta?.loadedAddresses?.writable ?? []),
      ...(transaction.meta?.loadedAddresses?.readonly ?? []),
    ];
    const instructions = [
      ...transaction.transaction.message.instructions,
      ...(transaction.meta?.innerInstructions ?? []).flatMap(
        (group) => group.instructions,
      ),
    ];

    const feedIds: string[] = [];
    for (const instruction of instructions) {
      if (keys[instruction.programIdIndex] !== this.receiverProgramId) continue;
      const data = Buffer.from(bs58.decode(instruction.data));
      const discriminator = data.subarray(0, 8).toString("hex");
      // `post_update(params)` puts the merkle message first; `post_update_atomic(params)`
      // puts a variable-length VAA ahead of it. In both the message is a borsh `Vec<u8>`
      // whose first byte is the message type, followed by the 32-byte feed id.
      let messageStart: number;
      if (discriminator === postUpdate) {
        messageStart = 12;
      } else if (discriminator === postUpdateAtomic) {
        messageStart = 16 + data.readUInt32LE(8);
      } else {
        continue;
      }
      const feedId = data.subarray(messageStart + 1, messageStart + 33);
      if (feedId.length === 32) feedIds.push(feedId.toString("hex"));
    }
    return feedIds;
  }

  private async getTransactions(
    signatures: string[],
    onRetry?: (message: string) => void,
  ): Promise<SvmTransaction[]> {
    const results = await this.rpcBatch<SvmTransaction | null>(
      signatures.map((signature) => ({
        method: "getTransaction",
        params: [
          signature,
          { encoding: "json", maxSupportedTransactionVersion: 0 },
        ],
      })),
      onRetry,
    );
    return results.filter(
      (result): result is SvmTransaction => result !== null,
    );
  }

  private async rpc<T>(
    method: string,
    params: unknown[],
    onRetry?: (message: string) => void,
  ): Promise<T> {
    const [result] = await this.rpcBatch<T>([{ method, params }], onRetry);
    if (result === undefined) throw new Error(`empty response for ${method}`);
    return result;
  }

  private async rpcBatch<T>(
    calls: { method: string; params: unknown[] }[],
    onRetry?: (message: string) => void,
  ): Promise<T[]> {
    const endpoint = this.chain.getConnection().rpcEndpoint;
    const MAX_ATTEMPTS = 6;
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await fetch(endpoint, {
          body: JSON.stringify(
            calls.map((call, id) => ({ id, jsonrpc: "2.0", ...call })),
          ),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        const body = (await response.json()) as {
          id: number;
          result?: T;
          error?: { message: string };
        }[];
        const failed = body.find((entry) => entry.error !== undefined);
        if (failed?.error !== undefined) throw new Error(failed.error.message);
        return body
          .sort((a, b) => a.id - b.id)
          .map((entry) => entry.result as T);
      } catch (error) {
        if (attempt >= MAX_ATTEMPTS) throw error;
        const backoffMs = 1000 * 2 ** (attempt - 1);
        onRetry?.(
          `${calls[0]?.method} attempt ${attempt} failed, retrying in ${backoffMs}ms: ${error}`,
        );
        await sleep(backoffMs);
      }
    }
  }
}

/** Slot at or after `unixTimestamp`, by binary search over `getBlockTime`. */
export async function getSvmSlotAtTimestamp(
  chain: SvmChain,
  unixTimestamp: number,
): Promise<number> {
  const connection = chain.getConnection();
  const head = await connection.getSlot();
  const headTime = await connection.getBlockTime(head);
  if (headTime === null || unixTimestamp >= headTime) return head;
  // ~2.4 slots/sec; over-reach by 3x so the window start is inside the search range.
  let low = Math.max(0, head - Math.ceil((headTime - unixTimestamp) * 7.5));
  let high = head;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    let timestamp: number | null = null;
    try {
      timestamp = await connection.getBlockTime(mid);
    } catch {
      // Skipped or pruned slot: treat as older than the target so the search moves up.
    }
    if (timestamp !== null && timestamp >= unixTimestamp) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low;
}
