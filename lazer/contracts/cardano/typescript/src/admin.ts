import {
    applyParamsToScript,
    mConStr0,
    mConStr1,
    MeshTxBuilder,
    resolveScriptHash,
    serializePlutusScript,
    type UTxO,
} from '@meshsdk/core';
import blueprint from '../../aiken/plutus.json';
import { getPythPriceScript } from './dapp.js';

const SIGNER_TOKEN_NAME = '7369676e6572'; // hex("signer")

/**
 * Load and parameterize the signer NFT validator from the Aiken blueprint.
 *
 * This validator manages the lifecycle of the signer NFT (mint, spend/update, burn).
 * Applies the `owner` parameter and derives the script address and policy ID.
 *
 * @param ownerPkh - The owner's public key hash as a hex string (56 hex chars / 28 bytes).
 * @param networkId - Cardano network: `0` for testnet/preview (default), `1` for mainnet.
 * @returns `{ scriptCbor, address, policyId }`
 */
export function getSignerNftScript(
    ownerPkh: string,
    networkId: number = 0
) {
    const mintValidator = blueprint.validators.find(
        (v) => v.title === 'signer_nft.signer_nft.mint'
    );
    if (!mintValidator) {
        throw new Error('signer_nft mint validator not found in blueprint');
    }

    const scriptCbor = applyParamsToScript(mintValidator.compiledCode, [
        ownerPkh,
    ]);

    const { address } = serializePlutusScript(
        { code: scriptCbor, version: 'V3' },
        undefined,
        networkId
    );

    const policyId = resolveScriptHash(scriptCbor, 'V3');

    return { scriptCbor, address, policyId };
}

/**
 * Initialize both validators and return all needed values.
 *
 * Convenience function that calls `getSignerNftScript()` then `getPythPriceScript()`
 * with the derived signer policy ID.
 *
 * @param ownerPkh - The owner's public key hash as a hex string.
 * @param networkId - Cardano network: `0` for testnet/preview (default), `1` for mainnet.
 * @returns All script values needed for transaction building.
 */
export function initializeValidators(
    ownerPkh: string,
    networkId: number = 0
) {
    const signerScript = getSignerNftScript(ownerPkh, networkId);
    const priceScript = getPythPriceScript(signerScript.policyId, networkId);

    return {
        signerScript,
        priceScript,
        signerAddress: signerScript.address,
        signerPolicyId: signerScript.policyId,
        priceRewardAddress: priceScript.rewardAddress,
    };
}

// Helper for Constr(2, fields) — PosInf in Aiken's BoundType
function mConStr2(fields: any[]): any {
    return { alternative: 2, fields };
}

/**
 * Build a Plutus datum representing a `PythSigningPolicy` for on-chain storage.
 *
 * Constructs the Mesh Data structure matching the Aiken type:
 * `PythSigningPolicy { trusted_signers: List<(VerificationKey, Interval<Int>)> }`.
 *
 * @param signers - Array of signer configurations. Each entry has:
 *   - `pubkey`: 32-byte Ed25519 public key as a hex string (64 hex chars).
 *   - `validFrom`: Optional validity start (slot number). Omit for no lower bound (NegInf).
 *   - `validTo`: Optional validity end (slot number). Omit for no upper bound (PosInf).
 * @returns A Mesh Data value suitable for passing to `txOutInlineDatumValue()`.
 */
export function buildSigningPolicyDatum(
    signers: Array<{
        pubkey: string;
        validFrom?: number;
        validTo?: number;
    }>
) {
    const signerList = signers.map((s) => {
        // In Aiken, Bool is: True = Constr(1, []), False = Constr(0, [])
        const trueData = mConStr1([]);

        const lowerBound =
            s.validFrom !== undefined
                ? mConStr0([mConStr1([s.validFrom]), trueData]) // Finite, inclusive
                : mConStr0([mConStr0([]), trueData]); // NegInf, inclusive

        const upperBound =
            s.validTo !== undefined
                ? mConStr0([mConStr1([s.validTo]), trueData]) // Finite, inclusive
                : mConStr0([mConStr2([]), trueData]); // PosInf, inclusive

        const interval = mConStr0([lowerBound, upperBound]);

        // Aiken 2-tuples are Plutus lists [a, b], not Constr 0 [a, b]
        return [s.pubkey, interval];
    });

    // PythSigningPolicy { trusted_signers: List<(VerificationKey, Interval)> }
    return mConStr0([signerList]);
}

/**
 * Build a transaction that mints the signer NFT with an initial signing policy.
 *
 * This is a one-time setup operation. The NFT is locked at the script address
 * with an inline datum containing the full set of trusted signers. After minting,
 * use {@link buildUpdateSignersTx} to change the signer set, or
 * {@link buildBurnSignerNftTx} to destroy the NFT entirely.
 *
 * @param txBuilder - A fresh `MeshTxBuilder` instance.
 * @param scriptCbor - Compiled signer NFT script CBOR hex (from {@link getSignerNftScript}).
 * @param scriptAddress - Bech32 script address (from {@link getSignerNftScript}).
 * @param policyId - Script hash / policy ID hex (from {@link getSignerNftScript}).
 * @param ownerPkh - The owner's public key hash as hex (NOT bech32).
 * @param signers - The initial set of trusted signers to store in the datum.
 * @param priceScriptCbor - Compiled price script CBOR hex to store as a reference script on the NFT output.
 * @returns The `txBuilder` with mint + output operations chained.
 */
export function buildMintSignerNftTx(
    txBuilder: MeshTxBuilder,
    scriptCbor: string,
    scriptAddress: string,
    policyId: string,
    ownerPkh: string,
    signers: Array<{
        pubkey: string;
        validFrom?: number;
        validTo?: number;
    }>,
    priceScriptCbor: string
): MeshTxBuilder {
    const datum = buildSigningPolicyDatum(signers);

    return txBuilder
        .mintPlutusScriptV3()
        .mint('1', policyId, SIGNER_TOKEN_NAME)
        .mintingScript(scriptCbor)
        .mintRedeemerValue(mConStr0([]))
        .txOut(scriptAddress, [
            { unit: policyId + SIGNER_TOKEN_NAME, quantity: '1' },
        ])
        .txOutInlineDatumValue(datum)
        .txOutReferenceScript(priceScriptCbor, 'V3')
        .requiredSignerHash(ownerPkh);
}

/**
 * Build a transaction that updates the signer set by spending the NFT UTxO
 * and recreating it with an updated datum.
 *
 * The signer NFT is not burned/reminted — it moves from the old UTxO to a new
 * output at the same script address with the new signing policy datum.
 *
 * @param txBuilder - A fresh `MeshTxBuilder` instance.
 * @param scriptCbor - Compiled signer NFT script CBOR hex (from {@link getSignerNftScript}).
 * @param scriptAddress - Bech32 script address (from {@link getSignerNftScript}).
 * @param policyId - Script hash / policy ID hex (from {@link getSignerNftScript}).
 * @param ownerPkh - The owner's public key hash as hex (NOT bech32).
 * @param signerUtxo - The existing UTxO at the script address containing the signer NFT.
 * @param newSigners - The new set of signers to store in the datum.
 * @param priceScriptCbor - Compiled price script CBOR hex to re-attach as a reference script on the NFT output.
 * @returns The `txBuilder` with spend + output operations chained.
 */
export function buildUpdateSignersTx(
    txBuilder: MeshTxBuilder,
    scriptCbor: string,
    scriptAddress: string,
    policyId: string,
    ownerPkh: string,
    signerUtxo: UTxO,
    newSigners: Array<{
        pubkey: string;
        validFrom?: number;
        validTo?: number;
    }>,
    priceScriptCbor: string
): MeshTxBuilder {
    const datum = buildSigningPolicyDatum(newSigners);

    return txBuilder
        .spendingPlutusScriptV3()
        .txIn(
            signerUtxo.input.txHash,
            signerUtxo.input.outputIndex,
            signerUtxo.output.amount,
            signerUtxo.output.address
        )
        .txInInlineDatumPresent()
        .txInScript(scriptCbor)
        .txInRedeemerValue(mConStr0([]))
        .txOut(scriptAddress, [
            { unit: policyId + SIGNER_TOKEN_NAME, quantity: '1' },
        ])
        .txOutInlineDatumValue(datum)
        .txOutReferenceScript(priceScriptCbor, 'V3')
        .requiredSignerHash(ownerPkh);
}

/**
 * Build a transaction that burns the signer NFT, destroying the signing policy.
 *
 * This is a teardown operation — it permanently removes the signer NFT from
 * the script address. After this, price verification will no longer work
 * (no reference input to find). Only the contract owner can do this.
 *
 * @param txBuilder - A fresh `MeshTxBuilder` instance.
 * @param scriptCbor - Compiled signer NFT script CBOR hex (from {@link getSignerNftScript}).
 * @param policyId - Script hash / policy ID hex (from {@link getSignerNftScript}).
 * @param ownerPkh - The owner's public key hash as hex (NOT bech32).
 * @param signerUtxo - The UTxO at the script address containing the signer NFT to burn.
 * @returns The `txBuilder` with spend + burn operations chained.
 */
export function buildBurnSignerNftTx(
    txBuilder: MeshTxBuilder,
    scriptCbor: string,
    policyId: string,
    ownerPkh: string,
    signerUtxo: UTxO
): MeshTxBuilder {
    return txBuilder
        .spendingPlutusScriptV3()
        .txIn(
            signerUtxo.input.txHash,
            signerUtxo.input.outputIndex,
            signerUtxo.output.amount,
            signerUtxo.output.address
        )
        .txInInlineDatumPresent()
        .txInScript(scriptCbor)
        .txInRedeemerValue(mConStr0([]))
        .mintPlutusScriptV3()
        .mint('-1', policyId, SIGNER_TOKEN_NAME)
        .mintingScript(scriptCbor)
        .mintRedeemerValue(mConStr0([]))
        .requiredSignerHash(ownerPkh);
}

/**
 * Build a transaction to register the price script's staking credential on-chain.
 *
 * **This is a one-time prerequisite** before {@link buildVerifyPriceTx} can be used.
 * Cardano requires staking credentials to be registered before they can participate
 * in withdrawals (even 0-ADA withdrawals).
 *
 * @param txBuilder - A fresh `MeshTxBuilder` instance.
 * @param rewardAddress - The price script's staking address (from {@link getPythPriceScript}).
 * @param changeAddress - Bech32 address to receive leftover ADA (registration costs a deposit of ~2 ADA).
 * @returns The `txBuilder` with the registration certificate chained.
 */
export function buildRegisterStakeTx(
    txBuilder: MeshTxBuilder,
    rewardAddress: string,
    changeAddress: string
): MeshTxBuilder {
    return txBuilder
        .registerStakeCertificate(rewardAddress)
        .changeAddress(changeAddress);
}
