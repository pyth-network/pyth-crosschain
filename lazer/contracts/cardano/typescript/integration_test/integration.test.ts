import { describe, it, expect, beforeAll } from 'vitest';
import {
    MeshTxBuilder,
    MeshWallet,
    deserializeAddress,
    type UTxO,
} from '@meshsdk/core';
import { getWalletForYaci, getYaciProvider } from './yaci-provider.js';
import { buildVerifyPriceTx } from '../src/dapp.js';
import {
    buildBurnSignerNftTx,
    buildMintSignerNftTx,
    buildRegisterStakeTx,
    buildUpdateSignersTx,
    initializeValidators,
} from '../src/admin.js';
import { hexToBytes } from '../src/hex.js';

const TEST_VECTOR_HEX =
    'b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f50500000000';

const SIGNER_PUBKEY = TEST_VECTOR_HEX.slice(8 + 128, 8 + 128 + 64);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function addCollateral(txBuilder: MeshTxBuilder, utxo: UTxO) {
    txBuilder.txInCollateral(
        utxo.input.txHash,
        utxo.input.outputIndex,
        utxo.output.amount,
        utxo.output.address
    );
}

async function getCurrentSlot(): Promise<number> {
    const res = await fetch('http://localhost:8080/api/v1/blocks/latest');
    const block = await res.json();
    return block.slot;
}

/**
 * Integration tests require a running Yaci devnet.
 * Start with: devkit start, then create-node -o --start
 * Skip these tests in CI by setting SKIP_INTEGRATION=1
 */
describe('Cardano Integration', () => {
        let provider: ReturnType<typeof getYaciProvider>;
        let wallet: MeshWallet;
        let ownerAddr: string;
        let ownerPkh: string;
        let signerScriptCbor: string;
        let signerAddress: string;
        let signerPolicyId: string;
        let priceScriptCbor: string;
        let priceRewardAddress: string;

        beforeAll(async () => {
            provider = getYaciProvider();
            wallet = getWalletForYaci();

            ownerAddr = await wallet.getChangeAddress();
            const deserialized = deserializeAddress(ownerAddr);
            ownerPkh = deserialized.pubKeyHash;

            const validators = initializeValidators(ownerPkh, 0);
            signerScriptCbor = validators.signerScript.scriptCbor;
            signerAddress = validators.signerAddress;
            signerPolicyId = validators.signerPolicyId;
            priceScriptCbor = validators.priceScript.scriptCbor;
            priceRewardAddress = validators.priceRewardAddress;
        });

        it('should register staking address', async () => {
            const walletUtxos = await provider.fetchAddressUTxOs(ownerAddr);
            const txBuilder = new MeshTxBuilder({
                fetcher: provider,
                submitter: provider,
            });

            buildRegisterStakeTx(txBuilder, priceRewardAddress, ownerAddr);
            txBuilder.selectUtxosFrom(walletUtxos);

            try {
                const unsignedTx = await txBuilder.complete();
                const signedTx = await wallet.signTx(unsignedTx);
                const txHash = await provider.submitTx(signedTx);
                await sleep(2000);
                expect(txHash).toBeTruthy();
            } catch (e: any) {
                // Already registered from a previous test run is OK
                const msg = typeof e === 'string' ? e : e?.message ?? JSON.stringify(e);
                if (msg.includes('StakeKeyRegisteredDELEG')) {
                    return;
                }
                throw e;
            }
        });

        it('should mint signer NFT', async () => {
            // Check if signer NFT already exists from a previous run
            const existingUtxos = await provider.fetchAddressUTxOs(signerAddress);
            const existing = existingUtxos.find((u) =>
                u.output.amount.some(
                    (a) => a.unit === signerPolicyId + '7369676e6572'
                )
            );
            if (existing) {
                // Already minted from a previous test run
                return;
            }

            const walletUtxos = await provider.fetchAddressUTxOs(ownerAddr);
            const txBuilder = new MeshTxBuilder({
                fetcher: provider,
                submitter: provider,
            });

            buildMintSignerNftTx(
                txBuilder,
                signerScriptCbor,
                signerAddress,
                signerPolicyId,
                ownerPkh,
                [{ pubkey: SIGNER_PUBKEY }],
                priceScriptCbor
            );
            txBuilder
                .changeAddress(ownerAddr)
                .selectUtxosFrom(walletUtxos);
            addCollateral(txBuilder, walletUtxos[0]);

            const unsignedTx = await txBuilder.complete();
            const signedTx = await wallet.signTx(unsignedTx);
            const txHash = await provider.submitTx(signedTx);
            await sleep(2000);

            expect(txHash).toBeTruthy();
        });

        it('should verify price via withdraw-0 trick', async () => {
            const utxos = await provider.fetchAddressUTxOs(signerAddress);
            const signerUtxo = utxos.find((u) =>
                u.output.amount.some(
                    (a) =>
                        a.unit ===
                        signerPolicyId + '7369676e6572'
                )
            );
            expect(signerUtxo).toBeTruthy();

            const walletUtxos = await provider.fetchAddressUTxOs(ownerAddr);
            const txBuilder = new MeshTxBuilder({
                fetcher: provider,
                submitter: provider,
            });

            const currentSlot = await getCurrentSlot();
            const signedPrice = hexToBytes(TEST_VECTOR_HEX);

            buildVerifyPriceTx(
                txBuilder,
                signerUtxo!,
                [signedPrice],
                currentSlot - 100,
                currentSlot + 100,
                ownerAddr
            );
            txBuilder.selectUtxosFrom(walletUtxos);
            addCollateral(txBuilder, walletUtxos[0]);

            const unsignedTx = await txBuilder.complete();
            const signedTx = await wallet.signTx(unsignedTx);
            const txHash = await provider.submitTx(signedTx);
            await sleep(2000);

            expect(txHash).toBeTruthy();
        });

        it('should update signer set', async () => {
            const utxos = await provider.fetchAddressUTxOs(signerAddress);
            const signerUtxo = utxos.find((u) =>
                u.output.amount.some(
                    (a) =>
                        a.unit ===
                        signerPolicyId + '7369676e6572'
                )
            );
            expect(signerUtxo).toBeTruthy();

            const walletUtxos = await provider.fetchAddressUTxOs(ownerAddr);
            const txBuilder = new MeshTxBuilder({
                fetcher: provider,
                submitter: provider,
            });

            buildUpdateSignersTx(
                txBuilder,
                signerScriptCbor,
                signerAddress,
                signerPolicyId,
                ownerPkh,
                signerUtxo!,
                [{ pubkey: SIGNER_PUBKEY }],
                priceScriptCbor
            );
            txBuilder
                .changeAddress(ownerAddr)
                .selectUtxosFrom(walletUtxos);
            addCollateral(txBuilder, walletUtxos[0]);

            const unsignedTx = await txBuilder.complete();
            const signedTx = await wallet.signTx(unsignedTx);
            const txHash = await provider.submitTx(signedTx);
            await sleep(2000);

            expect(txHash).toBeTruthy();
        });

        it('should burn signer NFT', async () => {
            const utxos = await provider.fetchAddressUTxOs(signerAddress);
            const signerUtxo = utxos.find((u) =>
                u.output.amount.some(
                    (a) =>
                        a.unit ===
                        signerPolicyId + '7369676e6572'
                )
            );
            expect(signerUtxo).toBeTruthy();

            const walletUtxos = await provider.fetchAddressUTxOs(ownerAddr);
            const txBuilder = new MeshTxBuilder({
                fetcher: provider,
                submitter: provider,
            });

            buildBurnSignerNftTx(
                txBuilder,
                signerScriptCbor,
                signerPolicyId,
                ownerPkh,
                signerUtxo!
            );
            txBuilder
                .changeAddress(ownerAddr)
                .selectUtxosFrom(walletUtxos);
            addCollateral(txBuilder, walletUtxos[0]);

            const unsignedTx = await txBuilder.complete();
            const signedTx = await wallet.signTx(unsignedTx);
            const txHash = await provider.submitTx(signedTx);
            await sleep(2000);

            expect(txHash).toBeTruthy();
        });
});
