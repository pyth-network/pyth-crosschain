import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import type { PythLazerSolanaContract } from "@pythnetwork/pyth-lazer-solana-sdk";
import { PYTH_LAZER_SOLANA_CONTRACT_IDL } from "@pythnetwork/pyth-lazer-solana-sdk";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { Storable } from "../base";
import type { Chain } from "../chains";
import { SvmChain } from "../chains";

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
