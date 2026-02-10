import {
    applyParamsToScript,
    mConStr0,
    MeshTxBuilder,
    resolveScriptHash,
    serializeRewardAddress,
} from '@meshsdk/core';
import blueprint from '../../aiken/plutus.json';
import { bytesToHex } from './hex.js';

/**
 * Load and parameterize the price verification validator from the Aiken blueprint.
 *
 * This validator handles price verification via the withdraw-0 trick.
 * It takes the signer NFT's policy ID as a parameter so it knows where to
 * find the signing policy reference input.
 *
 * @param signerPolicyId - The policy ID of the signer NFT validator (hex string).
 *   This is published by Pyth after deploying the signer NFT contract.
 * @param networkId - Cardano network: `0` for testnet/preview (default), `1` for mainnet.
 * @returns `{ scriptCbor, policyId, rewardAddress }`
 */
export function getPythPriceScript(
    signerPolicyId: string,
    networkId: number = 0
) {
    const withdrawValidator = blueprint.validators.find(
        (v) => v.title === 'pyth_price.pyth_price.withdraw'
    );
    if (!withdrawValidator) {
        throw new Error(
            'pyth_price withdraw validator not found in blueprint'
        );
    }

    const scriptCbor = applyParamsToScript(
        withdrawValidator.compiledCode,
        [signerPolicyId]
    );

    const policyId = resolveScriptHash(scriptCbor, 'V3');

    const rewardAddress = serializeRewardAddress(
        policyId,
        true, // isScriptHash
        networkId as 0 | 1
    );

    return { scriptCbor, policyId, rewardAddress };
}

/**
 * Build a transaction that verifies Pyth price feeds on-chain using the withdraw-0 trick.
 *
 * This is the main integration point for dApp developers. It adds a 0-ADA withdrawal
 * from the price validator's staking credential, which triggers the on-chain price
 * verification logic. The signing policy UTxO is included as a **reference input**.
 *
 * **Prerequisites:**
 * - The staking credential must be registered (done by Pyth during deployment).
 * - A signer NFT must exist at the signer script address (done by Pyth during deployment).
 *
 * You can chain additional transaction operations (inputs, outputs, etc.) onto the
 * returned builder before calling `.complete()`.
 *
 * @param txBuilder - A `MeshTxBuilder` instance.
 * @param priceScriptCbor - Compiled price script CBOR hex (from {@link getPythPriceScript}).
 * @param rewardAddress - The price script's staking address (from {@link getPythPriceScript}).
 * @param signerRefUtxo - Location of the signing policy UTxO to use as a reference input.
 * @param signedPrices - One or more raw signed price messages (Solana envelope format).
 * @param validFromSlot - Transaction `invalidBefore` slot.
 * @param validToSlot - Transaction `invalidHereafter` slot.
 * @param changeAddress - Bech32 address to receive leftover ADA.
 * @returns The `txBuilder` with withdrawal + reference input operations chained.
 */
export function buildVerifyPriceTx(
    txBuilder: MeshTxBuilder,
    priceScriptCbor: string,
    rewardAddress: string,
    signerRefUtxo: { txHash: string; outputIndex: number },
    signedPrices: Uint8Array[],
    validFromSlot: number,
    validToSlot: number,
    changeAddress: string
): MeshTxBuilder {
    const priceHexList = signedPrices.map((p) => bytesToHex(p));

    // PriceRedeemer { signed_prices: List<ByteArray> }
    const redeemer = mConStr0([priceHexList]);

    return txBuilder
        .readOnlyTxInReference(
            signerRefUtxo.txHash,
            signerRefUtxo.outputIndex
        )
        .withdrawalPlutusScriptV3()
        .withdrawal(rewardAddress, '0')
        .withdrawalScript(priceScriptCbor)
        .withdrawalRedeemerValue(redeemer)
        .invalidBefore(validFromSlot)
        .invalidHereafter(validToSlot)
        .changeAddress(changeAddress);
}

