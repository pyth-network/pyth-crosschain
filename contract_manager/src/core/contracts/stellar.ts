import {
  CallStellarExecutor,
  UpgradeStellarExecutor,
} from "@pythnetwork/xc-admin-common";
import {
  Account,
  BASE_FEE,
  Contract,
  nativeToScVal,
  Keypair as StellarKeypair,
  scValToNative,
  rpc as stellarRpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

import { sleep } from "../../utils/sleep";
import type { PrivateKey, TxResult } from "../base";
import { Storable } from "../base";
import type { Chain } from "../chains";
import { StellarChain } from "../chains";

/**
 * Lazer on Stellar (Soroban) is split across two contracts (see
 * `pyth-network/pyth-lazer` `contracts/stellar`), each represented by its own
 * `Storable` type here, mirroring the EVM split between {@link EvmLazerContract}
 * and {@link EvmExecutorContract}:
 *
 * - {@link StellarLazerContract} — the **verifier** (`pyth-lazer-stellar`), which
 *   verifies signed price updates and stores the trusted signer set.
 * - {@link StellarExecutorContract} — the **executor**
 *   (`wormhole-executor-stellar`), which verifies Wormhole governance VAAs and
 *   dispatches the decoded PTGM action to the verifier (or upgrades itself).
 *
 * Governance always enters through the executor: a Pyth governance VAA carrying a
 * PTGM `Call` is submitted to `execute_governance_action`, which invokes the
 * named function on the verifier.
 */

/**
 * The Lazer **verifier** (`pyth-lazer-stellar`).
 *
 * Governance does not enter the verifier directly — the verifier's payload
 * builders frame each action as an executor `Call` and resolve the authorized
 * executor from the verifier's on-chain state, the same way
 * {@link EvmLazerContract} resolves its owning executor.
 */
export class StellarLazerContract extends Storable {
  static type = "StellarLazerContract";

  /**
   * @param chain - the Stellar chain this contract is deployed on
   * @param address - Soroban contract id of the `pyth-lazer-stellar` verifier
   */
  constructor(
    public readonly chain: StellarChain,
    public readonly address: string,
  ) {
    super();
  }

  getId(): string {
    return `${this.chain.getId()}_${this.address}`;
  }

  getType(): string {
    return StellarLazerContract.type;
  }

  toJson() {
    return {
      address: this.address,
      chain: this.chain.getId(),
      type: StellarLazerContract.type,
    };
  }

  static fromJson(
    chain: Chain,
    parsed: { type: string; address: string },
  ): StellarLazerContract {
    if (parsed.type !== StellarLazerContract.type) {
      throw new Error("Invalid type");
    }
    if (!(chain instanceof StellarChain)) {
      throw new Error(`Wrong chain type ${chain}`);
    }
    return new StellarLazerContract(chain, parsed.address);
  }

  /**
   * Build the PTGM payload that updates (or, with `expiresAt = 0n`, removes) a
   * trusted Lazer signer on the verifier. Encoded as a generic executor `Call`
   * to `update_trusted_signer(pubkey: BytesN<33>, expires_at: u64)`.
   *
   * @param publicKey - 33-byte compressed secp256k1 signer key, hex without 0x
   * @param expiresAt - expiry timestamp in unix seconds (0 removes the signer)
   */
  async generateUpdateTrustedSignerPayload(
    publicKey: string,
    expiresAt: bigint,
  ): Promise<Buffer> {
    const pubkey = Buffer.from(publicKey, "hex");
    if (pubkey.length !== 33) {
      throw new Error(
        `Trusted signer key must be 33 bytes, got ${pubkey.length}`,
      );
    }
    const args = encodeScVecArgs([
      xdr.ScVal.scvBytes(pubkey),
      nativeToScVal(expiresAt, { type: "u64" }),
    ]);
    return new CallStellarExecutor(
      this.chain.wormholeChainName,
      await this.getExecutor(),
      this.address,
      "update_trusted_signer",
      args,
    ).encode();
  }

  /**
   * Build the PTGM payload that upgrades the verifier contract WASM. Encoded as
   * a generic executor `Call` to `upgrade(new_wasm_hash: BytesN<32>)`.
   *
   * @param wasmHash - 32-byte WASM hash of the new verifier, hex without 0x
   */
  async generateUpgradeVerifierPayload(wasmHash: string): Promise<Buffer> {
    const hash = Buffer.from(wasmHash, "hex");
    if (hash.length !== 32) {
      throw new Error(`WASM hash must be 32 bytes, got ${hash.length}`);
    }
    const args = encodeScVecArgs([xdr.ScVal.scvBytes(hash)]);
    return new CallStellarExecutor(
      this.chain.wormholeChainName,
      await this.getExecutor(),
      this.address,
      "upgrade",
      args,
    ).encode();
  }

  /**
   * Read the executor address authorized for governance on the verifier. This is
   * the executor that {@link StellarExecutorContract} wraps; a mismatch with the
   * registered executor means the registry is stale.
   */
  async getExecutor(): Promise<string> {
    const value = await readInstanceStorage(
      this.chain,
      this.address,
      "Executor",
    );
    if (!value) {
      throw new Error("Verifier has no executor set (not initialized)");
    }
    return scValToNative(value) as string;
  }

  /**
   * Read the expiry timestamp (unix seconds) of a trusted signer, or `undefined`
   * if the signer is not currently trusted.
   *
   * This reads the individual `TrustedSigner(<pubkey>)` storage entry directly,
   * so it requires knowing the key of interest. To enumerate the full set
   * instead, use {@link getTrustedSigners}.
   *
   * @param publicKey - 33-byte compressed secp256k1 key, hex without 0x
   */
  async getTrustedSignerExpiry(publicKey: string): Promise<bigint | undefined> {
    const server = this.chain.getProvider();
    const key = xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol("TrustedSigner"),
      xdr.ScVal.scvBytes(Buffer.from(publicKey, "hex")),
    ]);
    try {
      const entry = await server.getContractData(
        this.address,
        key,
        stellarRpc.Durability.Persistent,
      );
      return BigInt(
        scValToNative(entry.val.contractData().val()) as number | bigint,
      );
    } catch {
      // getContractData throws when the entry does not exist.
      return undefined;
    }
  }

  /**
   * Enumerate every currently trusted signer by invoking the verifier's
   * `list_trusted_signers` view, returning each `(publicKey, expiresAt)` pair.
   *
   * Unlike {@link getTrustedSignerExpiry} (a direct storage read), this is a
   * contract function call, so it is run through simulation — nothing is
   * submitted on-chain and no signing is required.
   */
  async getTrustedSigners(): Promise<
    { publicKey: string; expiresAt: bigint }[]
  > {
    const server = this.chain.getProvider();
    const contract = new Contract(this.address);

    // Simulation never submits the transaction, so a throwaway source account
    // with a zero sequence number suffices — no on-chain account or signature.
    const source = new Account(StellarKeypair.random().publicKey(), "0");
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.chain.networkPassphrase,
    })
      .addOperation(contract.call("list_trusted_signers"))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (stellarRpc.Api.isSimulationError(sim)) {
      throw new Error(`Failed to list trusted signers: ${sim.error}`);
    }
    const retval = sim.result?.retval;
    if (!retval) {
      return [];
    }
    // `list_trusted_signers` returns Vec<(BytesN<33>, u64)>, which decodes to an
    // array of [pubkeyBytes, expiry] tuples.
    const signers = scValToNative(retval) as [Uint8Array, bigint | number][];
    return signers.map(([pubkey, expiresAt]) => ({
      expiresAt: BigInt(expiresAt),
      publicKey: Buffer.from(pubkey).toString("hex"),
    }));
  }
}

/**
 * The Wormhole governance **executor** (`wormhole-executor-stellar`). It verifies
 * Pyth governance VAAs and dispatches the decoded PTGM action to the verifier, or
 * upgrades itself. Mirrors {@link EvmExecutorContract}.
 */
export class StellarExecutorContract extends Storable {
  static type = "StellarExecutorContract";

  /**
   * @param chain - the Stellar chain this contract is deployed on
   * @param address - Soroban contract id of the `wormhole-executor-stellar`
   *   governance executor
   */
  constructor(
    public readonly chain: StellarChain,
    public readonly address: string,
  ) {
    super();
  }

  getId(): string {
    return `${this.chain.getId()}_${this.address}`;
  }

  getType(): string {
    return StellarExecutorContract.type;
  }

  toJson() {
    return {
      address: this.address,
      chain: this.chain.getId(),
      type: StellarExecutorContract.type,
    };
  }

  static fromJson(
    chain: Chain,
    parsed: { type: string; address: string },
  ): StellarExecutorContract {
    if (parsed.type !== StellarExecutorContract.type) {
      throw new Error("Invalid type");
    }
    if (!(chain instanceof StellarChain)) {
      throw new Error(`Wrong chain type ${chain}`);
    }
    return new StellarExecutorContract(chain, parsed.address);
  }

  /**
   * Build the PTGM payload that self-upgrades the executor contract WASM.
   *
   * @param wasmDigest - 32-byte WASM digest of the new executor, hex without 0x
   */
  generateUpgradeExecutorPayload(wasmDigest: string): Buffer {
    return new UpgradeStellarExecutor(
      this.chain.wormholeChainName,
      this.address,
      Buffer.from(wasmDigest, "hex"),
    ).encode();
  }

  /**
   * Submit a signed governance VAA to the executor's `execute_governance_action`
   * entry point and return the resulting transaction hash.
   *
   * @param senderPrivateKey - 32-byte ed25519 seed of the submitting account,
   *   hex without 0x. The submitter only pays fees; authority comes from the
   *   guardian-signed VAA, not the sender.
   * @param vaa - the signed Wormhole governance VAA wrapping the PTGM payload
   */
  async executeGovernanceAction(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult> {
    const server = this.chain.getProvider();
    const keypair = StellarKeypair.fromRawEd25519Seed(
      Buffer.from(senderPrivateKey, "hex"),
    );
    const account = await server.getAccount(keypair.publicKey());
    const executor = new Contract(this.address);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.chain.networkPassphrase,
    })
      .addOperation(
        executor.call("execute_governance_action", xdr.ScVal.scvBytes(vaa)),
      )
      .setTimeout(30)
      .build();

    const prepared = await server.prepareTransaction(tx);
    prepared.sign(keypair);

    const sent = await server.sendTransaction(prepared);
    if (sent.status === "ERROR") {
      throw new Error(
        `Failed to submit governance transaction: ${JSON.stringify(sent.errorResult)}`,
      );
    }

    let result = await server.getTransaction(sent.hash);
    while (result.status === stellarRpc.Api.GetTransactionStatus.NOT_FOUND) {
      await sleep(1000);
      result = await server.getTransaction(sent.hash);
    }

    if (result.status !== stellarRpc.Api.GetTransactionStatus.SUCCESS) {
      throw new Error(`Governance transaction ${sent.hash} failed`);
    }

    return { id: sent.hash, info: result };
  }

  /**
   * Read the executor's current Wormhole guardian set index.
   */
  async getCurrentGuardianSetIndex(): Promise<number> {
    const value = await readInstanceStorage(
      this.chain,
      this.address,
      "GuardianSetIndex",
    );
    if (!value) {
      throw new Error("Executor has no guardian set index (not initialized)");
    }
    return Number(scValToNative(value) as number | bigint);
  }
}

/** XDR-encode an argument vector as the `ScVec` the executor's `Call` expects. */
function encodeScVecArgs(args: xdr.ScVal[]): Buffer {
  return xdr.ScVal.scvVec(args).toXDR();
}

/**
 * Read a single entry from a contract's instance storage. Instance storage is
 * bundled inside the contract instance ledger entry (not stored as separate
 * ledger entries), so the whole instance is fetched and its storage map is
 * scanned for `keySymbol`.
 */
async function readInstanceStorage(
  chain: StellarChain,
  contractId: string,
  keySymbol: string,
): Promise<xdr.ScVal | undefined> {
  const server = chain.getProvider();
  const entry = await server.getContractData(
    contractId,
    xdr.ScVal.scvLedgerKeyContractInstance(),
    stellarRpc.Durability.Persistent,
  );
  const storage = entry.val.contractData().val().instance().storage() ?? [];
  for (const item of storage) {
    const key = scValToNative(item.key()) as unknown;
    if (Array.isArray(key) && key[0] === keySymbol) {
      return item.val();
    }
  }
  return undefined;
}
