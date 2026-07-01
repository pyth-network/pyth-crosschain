import type {
  CardanoUTxO,
  TrustedSigner,
} from "@pythnetwork/pyth-lazer-cardano-js";
import {
  getPythScriptHash,
  getPythState,
  getTrustedSigners,
} from "@pythnetwork/pyth-lazer-cardano-js";
import {
  UpdateTrustedSigner256Bit,
  UpgradeCardanoSpendScript,
  UpgradeCardanoWithdrawScript,
} from "@pythnetwork/xc-admin-common";

import { Storable } from "../base";
import type { Chain } from "../chains";
import { CardanoChain } from "../chains";

/**
 * Lazer on Cardano. The deployment is identified by its **policy id** — the
 * NFT-minting policy that gates the on-chain State UTxO (Cardano's analogue of a
 * contract address). Governance is Wormhole-VAA based, like Sui/Stellar, but
 * there is no separate executor contract: a governance VAA is submitted as
 * redeemer data in a Cardano transaction that the spending/withdraw scripts
 * validate in-line. See `pyth-crosschain/lazer/contracts/cardano/DESIGN.md`.
 *
 * Reads wrap the existing `@pythnetwork/pyth-lazer-cardano-js` SDK; the governance
 * payload builders wrap `@pythnetwork/xc-admin-common`, producing the raw
 * Wormhole payload (not a VAA) so a test script can sign and dispatch it the same
 * way Stellar's does.
 */
export class CardanoLazerContract extends Storable {
  static type = "CardanoLazerContract";

  /**
   * @param chain - the Cardano chain this contract is deployed on
   * @param policyId - hex-encoded policy id of the Pyth state NFT
   */
  constructor(
    public readonly chain: CardanoChain,
    public readonly policyId: string,
  ) {
    super();
  }

  getId(): string {
    return `${this.chain.getId()}_${this.policyId}`;
  }

  getType(): string {
    return CardanoLazerContract.type;
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      policyId: this.policyId,
      type: CardanoLazerContract.type,
    };
  }

  static fromJson(
    chain: Chain,
    parsed: { type: string; policyId: string },
  ): CardanoLazerContract {
    if (parsed.type !== CardanoLazerContract.type) {
      throw new Error("Invalid type");
    }
    if (!(chain instanceof CardanoChain)) {
      throw new Error(`Wrong chain type ${chain}`);
    }
    return new CardanoLazerContract(chain, parsed.policyId);
  }

  /** Fetch the on-chain State UTxO (carries the inline datum) for this policy. */
  getPythState(): Promise<CardanoUTxO> {
    return getPythState(this.policyId, this.chain.getProvider());
  }

  /** Hex-encoded hash of the withdraw script currently stored in the state. */
  async getWithdrawScriptHash(): Promise<string> {
    return getPythScriptHash(await this.getPythState());
  }

  /**
   * Read the trusted Lazer signers from the on-chain state, each with its expiry
   * as a unix timestamp in seconds. This is the read path the signer audit uses.
   */
  async getTrustedSigners(): Promise<TrustedSigner[]> {
    return getTrustedSigners(await this.getPythState());
  }

  /**
   * Build the raw Wormhole governance payload that updates (or, with
   * `expiresAt = 0n`, removes) a trusted Lazer signer.
   *
   * @param publicKey - 32-byte Ed25519 signer key, hex without `0x`
   * @param expiresAt - expiry timestamp in unix seconds (0 removes the signer)
   */
  generateUpdateTrustedSignerPayload(
    publicKey: string,
    expiresAt: bigint,
  ): Buffer {
    const key = Buffer.from(publicKey, "hex");
    if (key.length !== 32) {
      throw new Error(`Trusted signer key must be 32 bytes, got ${key.length}`);
    }
    return new UpdateTrustedSigner256Bit(
      this.chain.wormholeChainName,
      publicKey,
      expiresAt,
    ).encode();
  }

  /**
   * Build the raw Wormhole governance payload that upgrades the spending script.
   *
   * TODO(i-hrvptavr): end-to-end dispatch of the upgrade actions is out of scope;
   * only the payload builder is wired up here.
   *
   * @param scriptHash - 28-byte spend script hash, hex without `0x`
   */
  generateUpgradeSpendScriptPayload(scriptHash: string): Buffer {
    return new UpgradeCardanoSpendScript(
      this.chain.wormholeChainName,
      scriptHash,
    ).encode();
  }

  /**
   * Build the raw Wormhole governance payload that upgrades the withdraw script.
   *
   * TODO(i-hrvptavr): end-to-end dispatch of the upgrade actions is out of scope;
   * only the payload builder is wired up here.
   *
   * @param scriptHash - 28-byte new withdraw script hash, hex without `0x`
   * @param previousExpiresAt - expiry (unix seconds) of the superseded script
   */
  generateUpgradeWithdrawScriptPayload(
    scriptHash: string,
    previousExpiresAt: bigint,
  ): Buffer {
    return new UpgradeCardanoWithdrawScript(
      this.chain.wormholeChainName,
      scriptHash,
      previousExpiresAt,
    ).encode();
  }
}
