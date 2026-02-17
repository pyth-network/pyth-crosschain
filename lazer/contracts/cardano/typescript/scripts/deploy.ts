import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
    BlockfrostProvider,
    deserializeAddress,
    MeshTxBuilder,
    MeshWallet,
    type UTxO,
} from '@meshsdk/core'
import {
    buildMintSignerNftTx,
    buildRegisterStakeTx,
    initializeValidators,
} from '../src/admin.js'

const SIGNER_TOKEN_NAME = '7369676e6572' // hex("signer")

const VALID_NETWORKS = ['preview', 'preprod'] as const
type Network = (typeof VALID_NETWORKS)[number]

const CONFIG_DIR = path.join(os.homedir(), '.config', 'pyth-lazer-cardano')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

interface ConfigFile {
    walletMnemonic?: string
    blockfrostKey?: string
}

function loadConfigFile(): ConfigFile {
    try {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
        return JSON.parse(raw)
    } catch {
        return {}
    }
}

function getConfig(): { network: Network; mnemonic: string; blockfrostKey: string } {
    const network = process.argv[2] as Network
    if (!VALID_NETWORKS.includes(network)) {
        console.error(`Usage: npx tsx scripts/deploy.ts <preview|preprod>`)
        process.exit(1)
    }

    const fileConfig = loadConfigFile()

    const mnemonic = process.env.WALLET_MNEMONIC || fileConfig.walletMnemonic
    if (!mnemonic) {
        console.error(
            'Error: WALLET_MNEMONIC not found.\n' +
                `Set the WALLET_MNEMONIC env var or add "walletMnemonic" to ${CONFIG_FILE}`
        )
        process.exit(1)
    }

    const blockfrostKey = process.env.BLOCKFROST_KEY || fileConfig.blockfrostKey
    if (!blockfrostKey) {
        console.error(
            'Error: BLOCKFROST_KEY not found.\n' +
                `Set the BLOCKFROST_KEY env var or add "blockfrostKey" to ${CONFIG_FILE}`
        )
        process.exit(1)
    }

    return { network, mnemonic, blockfrostKey }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function waitForTx(
    provider: BlockfrostProvider,
    txHash: string,
    address: string,
    timeoutMs = 120_000
) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
        const utxos = await provider.fetchAddressUTxOs(address)
        if (utxos.some((u) => u.input.txHash === txHash)) return
        await sleep(3000)
    }
    throw new Error(`Timed out waiting for tx ${txHash} after ${timeoutMs}ms`)
}

async function main() {
    const { network, mnemonic, blockfrostKey } = getConfig()

    console.log(`Deploying Pyth Lazer oracle to Cardano ${network}...`)

    // 1. Load wallet
    const provider = new BlockfrostProvider(blockfrostKey)

    const wallet = new MeshWallet({
        networkId: 0,
        fetcher: provider,
        submitter: provider,
        key: {
            type: 'mnemonic',
            words: mnemonic.split(' '),
        },
    })

    const walletAddr = await wallet.getChangeAddress()
    const ownerPkh = deserializeAddress(walletAddr).pubKeyHash
    console.log(`Wallet address: ${walletAddr}`)
    console.log(`Owner PKH: ${ownerPkh}`)

    // 2. Initialize validators
    const validators = initializeValidators(ownerPkh, 0)
    const { signerScript, priceScript, signerAddress, signerPolicyId, priceRewardAddress } =
        validators

    console.log(`Signer policy ID: ${signerPolicyId}`)
    console.log(`Signer address: ${signerAddress}`)
    console.log(`Price reward address: ${priceRewardAddress}`)

    // 3. Register staking credential
    console.log('\nStep 1: Registering staking credential...')
    try {
        const walletUtxos = await provider.fetchAddressUTxOs(walletAddr)
        if (walletUtxos.length === 0) {
            throw new Error('Wallet has no UTxOs — fund it with test ADA first')
        }

        const txBuilder = new MeshTxBuilder({
            fetcher: provider,
            submitter: provider,
        })

        buildRegisterStakeTx(txBuilder, priceRewardAddress, walletAddr)
        txBuilder.selectUtxosFrom(walletUtxos)

        const unsignedTx = await txBuilder.complete()
        const signedTx = await wallet.signTx(unsignedTx)
        const txHash = await provider.submitTx(signedTx)
        console.log(`Registration tx submitted: ${txHash}`)
        console.log('Waiting for confirmation...')
        await waitForTx(provider, txHash, walletAddr)
        console.log('Staking credential registered.')
    } catch (e: any) {
        const msg = typeof e === 'string' ? e : e?.message ?? JSON.stringify(e)
        if (msg.includes('StakeKeyAlreadyRegistered') || msg.includes('StakeKeyRegisteredDELEG')) {
            console.log('Staking credential already registered — skipping.')
        } else {
            throw e
        }
    }

    // 4. Mint signer NFT
    console.log('\nStep 2: Minting signer NFT...')
    const existingUtxos = await provider.fetchAddressUTxOs(signerAddress)
    const existingNft = existingUtxos.find((u: UTxO) =>
        u.output.amount.some((a) => a.unit === signerPolicyId + SIGNER_TOKEN_NAME)
    )

    if (existingNft) {
        console.log('Signer NFT already exists — skipping.')
        console.log(`  UTxO: ${existingNft.input.txHash}#${existingNft.input.outputIndex}`)
    } else {
        const walletUtxos = await provider.fetchAddressUTxOs(walletAddr)
        const txBuilder = new MeshTxBuilder({
            fetcher: provider,
            submitter: provider,
        })

        buildMintSignerNftTx(
            txBuilder,
            signerScript.scriptCbor,
            signerAddress,
            signerPolicyId,
            ownerPkh,
            [] // empty signing policy — signers added later via buildUpdateSignersTx
        )
        txBuilder.changeAddress(walletAddr).selectUtxosFrom(walletUtxos)
        txBuilder.txInCollateral(
            walletUtxos[0].input.txHash,
            walletUtxos[0].input.outputIndex,
            walletUtxos[0].output.amount,
            walletUtxos[0].output.address
        )

        const unsignedTx = await txBuilder.complete()
        const signedTx = await wallet.signTx(unsignedTx)
        const txHash = await provider.submitTx(signedTx)
        console.log(`Mint tx submitted: ${txHash}`)
        console.log('Waiting for confirmation...')
        await waitForTx(provider, txHash, walletAddr)
        console.log('Signer NFT minted.')
    }

    // 5. Output deployment info
    const finalUtxos = await provider.fetchAddressUTxOs(signerAddress)
    const nftUtxo = finalUtxos.find((u: UTxO) =>
        u.output.amount.some((a) => a.unit === signerPolicyId + SIGNER_TOKEN_NAME)
    )

    console.log('\n=== Deployment Complete ===')
    console.log(`Network:              ${network}`)
    console.log(`Signer Policy ID:     ${signerPolicyId}`)
    console.log(`Signer Address:       ${signerAddress}`)
    console.log(`Price Reward Address: ${priceRewardAddress}`)
    if (nftUtxo) {
        console.log(`NFT UTxO:             ${nftUtxo.input.txHash}#${nftUtxo.input.outputIndex}`)
    }
    console.log('\ndApp developers need the Signer Policy ID to verify prices.')
}

main().catch((e) => {
    console.error('Deployment failed:', e)
    process.exit(1)
})
