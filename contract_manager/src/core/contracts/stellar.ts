import {
  CallStellarExecutor,
  UpgradeStellarExecutor,
} from "@pythnetwork/xc-admin-common";
import {
  BASE_FEE,
  Contract,
  nativeToScVal,
  Keypair as StellarKeypair,
  scValToNative,
  rpc as stellarRpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

import type { PrivateKey, TxResult } from "../base";
import { Storable } from "../base";
import type { Chain } from "../chains";
import { StellarChain } from "../chains";

/**
 * Lazer on Stellar is split across two Soroban contracts (see
 * `pyth-network/pyth-lazer` `contracts/stellar`):
 *
 * - the **verifier** (`pyth-lazer-stellar`) verifies signed price updates and
 *   stores the trusted signer set, and
 * - the **executor** (`wormhole-executor-stellar`) verifies Wormhole governance
 *   VAAs and dispatches the decoded PTGM action to the verifier (or upgrades
 *   itself).
 *
 * Governance always enters through the executor: a Pyth governance VAA carrying
 * a PTGM `Call` is submitted to `execute_governance_action`, which invokes the
 * named function on the verifier. This class wires both contract ids together
 * and builds the matching PTGM payloads.
 */
export class StellarLazerContract extends Storable {
  static type = "StellarLazerContract";

  /**
   * @param chain - the Stellar chain this contract is deployed on
   * @param verifierAddress - Soroban contract id of the `pyth-lazer-stellar`
   *   verifier
   * @param executorAddress - Soroban contract id of the
   *   `wormhole-executor-stellar` governance executor
   */
  constructor(
    public readonly chain: StellarChain,
    public readonly verifierAddress: string,
    public readonly executorAddress: string,
  ) {
    super();
  }

  getId(): string {
    return `${this.chain.getId()}_${this.verifierAddress}`;
  }

  getType(): string {
    return StellarLazerContract.type;
  }

  getChain(): StellarChain {
    return this.chain;
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      executorAddress: this.executorAddress,
      type: StellarLazerContract.type,
      verifierAddress: this.verifierAddress,
    };
  }

  static fromJson(
    chain: Chain,
    parsed: {
      type: string;
      verifierAddress: string;
      executorAddress: string;
    },
  ): StellarLazerContract {
    if (parsed.type !== StellarLazerContract.type) {
      throw new Error("Invalid type");
    }
    if (!(chain instanceof StellarChain)) {
      throw new Error(`Wrong chain type ${chain}`);
    }
    return new StellarLazerContract(
      chain,
      parsed.verifierAddress,
      parsed.executorAddress,
    );
  }

  /**
   * Build the PTGM payload that updates (or, with `expiresAt = 0n`, removes) a
   * trusted Lazer signer on the verifier. Encoded as a generic executor `Call`
   * to `update_trusted_signer(pubkey: BytesN<33>, expires_at: u64)`.
   *
   * @param publicKey - 33-byte compressed secp256k1 signer key, hex without 0x
   * @param expiresAt - expiry timestamp in unix seconds (0 removes the signer)
   */
  generateUpdateTrustedSignerPayload(
    publicKey: string,
    expiresAt: bigint,
  ): Buffer {
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
      this.executorAddress,
      this.verifierAddress,
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
  generateUpgradeVerifierPayload(wasmHash: string): Buffer {
    const hash = Buffer.from(wasmHash, "hex");
    if (hash.length !== 32) {
      throw new Error(`WASM hash must be 32 bytes, got ${hash.length}`);
    }
    const args = encodeScVecArgs([xdr.ScVal.scvBytes(hash)]);
    return new CallStellarExecutor(
      this.chain.wormholeChainName,
      this.executorAddress,
      this.verifierAddress,
      "upgrade",
      args,
    ).encode();
  }

  /**
   * Build the PTGM payload that self-upgrades the executor contract WASM.
   *
   * @param wasmDigest - 32-byte WASM digest of the new executor, hex without 0x
   */
  generateUpgradeExecutorPayload(wasmDigest: string): Buffer {
    return new UpgradeStellarExecutor(
      this.chain.wormholeChainName,
      this.executorAddress,
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
    const executor = new Contract(this.executorAddress);

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
   * Read the executor address authorized for governance on the verifier. Should
   * match {@link executorAddress}; a mismatch means the registry is stale.
   */
  async getExecutor(): Promise<string> {
    const value = await this.readInstanceStorage(
      this.verifierAddress,
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
   * The verifier keys trusted signers individually by public key and exposes no
   * enumeration, so callers must supply the key of interest — there is no
   * on-chain "list all signers" to mirror.
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
        this.verifierAddress,
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
   * Read the executor's current Wormhole guardian set index.
   */
  async getCurrentGuardianSetIndex(): Promise<number> {
    const value = await this.readInstanceStorage(
      this.executorAddress,
      "GuardianSetIndex",
    );
    if (!value) {
      throw new Error("Executor has no guardian set index (not initialized)");
    }
    return Number(scValToNative(value) as number | bigint);
  }

  /**
   * Read a single entry from a contract's instance storage. Instance storage is
   * bundled inside the contract instance ledger entry (not stored as separate
   * ledger entries), so the whole instance is fetched and its storage map is
   * scanned for `keySymbol`.
   */
  private async readInstanceStorage(
    contractId: string,
    keySymbol: string,
  ): Promise<xdr.ScVal | undefined> {
    const server = this.chain.getProvider();
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
}

/** XDR-encode an argument vector as the `ScVec` the executor's `Call` expects. */
function encodeScVecArgs(args: xdr.ScVal[]): Buffer {
  return xdr.ScVal.scvVec(args).toXDR();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
