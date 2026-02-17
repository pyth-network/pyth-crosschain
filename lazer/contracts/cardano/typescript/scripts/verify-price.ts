import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
    BlockfrostProvider,
    MeshTxBuilder,
    MeshWallet,
    type UTxO,
} from '@meshsdk/core'
import { PythLazerClient } from '@pythnetwork/pyth-lazer-sdk'
import { buildVerifyPriceTx, getRewardAddressFromUtxo } from '../src/dapp.js'
import { parsePriceMessage, parsePriceUpdate } from '../src/parse.js'
import { bytesToHex } from '../src/hex.js'

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

function parseArgs(): {
    network: Network
    mnemonic: string
    blockfrostKey: string
    signerPolicyId: string
    token?: string
    feedId: number
    priceHex?: string
} {
    const args = process.argv.slice(2)

    // Parse positional network arg
    const network = args[0] as Network
    if (!VALID_NETWORKS.includes(network)) {
        console.error(
            'Usage: npx tsx scripts/verify-price.ts <preview|preprod> --signer-policy-id <id> --token <lazer-auth-token> [--feed-id <id>]\n' +
                '       npx tsx scripts/verify-price.ts <preview|preprod> --signer-policy-id <id> --price-hex <hex>'
        )
        process.exit(1)
    }

    // Parse named args
    let signerPolicyId: string | undefined
    let token: string | undefined
    let feedId = 1
    let priceHex: string | undefined

    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--signer-policy-id' && args[i + 1]) {
            signerPolicyId = args[++i]
        } else if (args[i] === '--token' && args[i + 1]) {
            token = args[++i]
        } else if (args[i] === '--feed-id' && args[i + 1]) {
            feedId = parseInt(args[++i], 10)
            if (isNaN(feedId)) {
                console.error('Error: --feed-id must be a number')
                process.exit(1)
            }
        } else if (args[i] === '--price-hex' && args[i + 1]) {
            priceHex = args[++i]
        }
    }

    if (!signerPolicyId) {
        console.error(
            'Error: --signer-policy-id <id> is required (printed during deploy as "Signer Policy ID")'
        )
        process.exit(1)
    }

    if (!/^[0-9a-fA-F]{56}$/.test(signerPolicyId)) {
        console.error(
            `Error: Invalid signer policy ID "${signerPolicyId}" — must be 56 hex chars (28 bytes)`
        )
        process.exit(1)
    }

    if (!token && !priceHex) {
        console.error(
            'Error: Either --token <lazer-auth-token> or --price-hex <hex> is required'
        )
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

    const blockfrostKey =
        process.env.BLOCKFROST_KEY || fileConfig.blockfrostKey
    if (!blockfrostKey) {
        console.error(
            'Error: BLOCKFROST_KEY not found.\n' +
                `Set the BLOCKFROST_KEY env var or add "blockfrostKey" to ${CONFIG_FILE}`
        )
        process.exit(1)
    }

    return { network, mnemonic, blockfrostKey, signerPolicyId, token, feedId, priceHex }
}

async function getCurrentSlot(
    network: Network,
    blockfrostKey: string
): Promise<number> {
    const url = `https://cardano-${network}.blockfrost.io/api/v0/blocks/latest`
    const res = await fetch(url, {
        headers: { project_id: blockfrostKey },
    })
    if (!res.ok) {
        throw new Error(
            `Blockfrost /blocks/latest failed: ${res.status} ${res.statusText}`
        )
    }
    const block = (await res.json()) as { slot: number }
    return block.slot
}

async function findSignerNftUtxo(
    network: Network,
    blockfrostKey: string,
    provider: BlockfrostProvider,
    signerPolicyId: string
): Promise<UTxO> {
    const asset = signerPolicyId + SIGNER_TOKEN_NAME
    const url = `https://cardano-${network}.blockfrost.io/api/v0/assets/${asset}/addresses`
    const res = await fetch(url, {
        headers: { project_id: blockfrostKey },
    })
    if (!res.ok) {
        throw new Error(
            `Blockfrost /assets/.../addresses failed: ${res.status} ${res.statusText}\n` +
                'Make sure the oracle is deployed and the signer policy ID is correct.'
        )
    }
    const addresses = (await res.json()) as Array<{ address: string; quantity: string }>
    if (addresses.length === 0) {
        throw new Error(
            'Signer NFT not found on-chain.\n' +
                'Make sure the oracle is deployed and the signer policy ID is correct.'
        )
    }

    const signerAddress = addresses[0].address
    const utxos = await provider.fetchAddressUTxOs(signerAddress)
    const nftUtxo = utxos.find((u: UTxO) =>
        u.output.amount.some((a) => a.unit === asset)
    )

    if (!nftUtxo) {
        throw new Error(
            'Signer NFT address found but UTxO not found — this should not happen.'
        )
    }

    return nftUtxo
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
    const {
        network,
        mnemonic,
        blockfrostKey,
        signerPolicyId,
        token,
        feedId,
        priceHex,
    } = parseArgs()

    console.log(
        `Verifying Pyth Lazer price on Cardano ${network}...\n`
    )

    // 1. Set up wallet and provider
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
    console.log(`Wallet address: ${walletAddr}`)

    // 2. Find signer NFT UTxO via Blockfrost asset lookup
    console.log(`Signer policy ID:     ${signerPolicyId}`)
    console.log(`\nLooking up signer NFT...`)
    const signerNftUtxo = await findSignerNftUtxo(
        network,
        blockfrostKey,
        provider,
        signerPolicyId
    )
    console.log(
        `Signer NFT UTxO: ${signerNftUtxo.input.txHash}#${signerNftUtxo.input.outputIndex}`
    )

    // 3. Derive reward address from the on-chain reference script
    const rewardAddress = getRewardAddressFromUtxo(signerNftUtxo, 0)
    console.log(`Price reward address: ${rewardAddress}`)

    // 4. Get price update — either from CLI arg or live from Pyth Lazer
    let update: Buffer

    if (priceHex) {
        console.log(`\nUsing provided price data (${priceHex.length / 2} bytes)`)
        update = Buffer.from(priceHex, 'hex')
    } else {
        console.log(`\nFetching live price for feed ${feedId} from Pyth Lazer...`)

        const lazer = await PythLazerClient.create({ token: token! })
        const latestPrice = await lazer.getLatestPrice({
            priceFeedIds: [feedId],
            properties: [
                'price',
                'bestBidPrice',
                'bestAskPrice',
                'exponent',
            ],
            formats: ['solana'],
            channel: 'fixed_rate@200ms',
            jsonBinaryEncoding: 'hex',
        })

        const solanaHex = latestPrice.solana?.data
        if (!solanaHex) {
            console.error(
                'Error: No Solana-format data received from Pyth Lazer'
            )
            process.exit(1)
        }

        update = Buffer.from(solanaHex, 'hex')
        console.log(`Received signed price update (${update.length} bytes)`)
    }

    // 5. Parse and display price data
    const envelope = parsePriceMessage(update)
    const priceData = parsePriceUpdate(envelope.payload)
    console.log(`\n--- Price Data ---`)
    console.log(`Signer pubkey: ${bytesToHex(envelope.pubkey)}`)
    console.log(
        `Timestamp:     ${new Date(Number(priceData.timestamp / 1000n)).toISOString()}`
    )

    for (const feed of priceData.feeds) {
        console.log(`Feed ID:       ${feed.feedId}`)
        if (feed.price !== undefined) {
            console.log(`Price (raw):   ${feed.price}`)
        }
        if (feed.exponent !== undefined) {
            console.log(`Exponent:      ${feed.exponent}`)
            if (feed.price !== undefined) {
                const humanPrice =
                    Number(feed.price) * Math.pow(10, feed.exponent)
                console.log(`Price (human): $${humanPrice.toFixed(Math.abs(feed.exponent))}`)
            }
        }
        if (feed.bestBidPrice !== undefined) {
            console.log(`Best bid:      ${feed.bestBidPrice}`)
        }
        if (feed.bestAskPrice !== undefined) {
            console.log(`Best ask:      ${feed.bestAskPrice}`)
        }
    }

    // 6. Get current slot for validity range
    console.log(`\nFetching current slot...`)
    const currentSlot = await getCurrentSlot(network, blockfrostKey)
    console.log(`Current slot: ${currentSlot}`)

    // 7. Build verification transaction
    console.log(`\nBuilding verification transaction...`)
    const walletUtxos = await provider.fetchAddressUTxOs(walletAddr)
    if (walletUtxos.length === 0) {
        console.error(
            'Error: Wallet has no UTxOs — fund it with test ADA first'
        )
        process.exit(1)
    }

    const txBuilder = new MeshTxBuilder({
        fetcher: provider,
        submitter: provider,
    })

    buildVerifyPriceTx(
        txBuilder,
        signerNftUtxo,
        [update],
        currentSlot - 100,
        currentSlot + 600,
        walletAddr
    )
    txBuilder.selectUtxosFrom(walletUtxos)
    txBuilder.txInCollateral(
        walletUtxos[0].input.txHash,
        walletUtxos[0].input.outputIndex,
        walletUtxos[0].output.amount,
        walletUtxos[0].output.address
    )

    // 8. Sign and submit
    console.log(`Signing and submitting transaction...`)
    const unsignedTx = await txBuilder.complete()
    const signedTx = await wallet.signTx(unsignedTx)
    console.log(`Signed tx CBOR: ${signedTx}`)
    const txHash = await provider.submitTx(signedTx)
    console.log(`Transaction submitted: ${txHash}`)

    // 9. Wait for confirmation
    console.log(`Waiting for confirmation...`)
    await waitForTx(provider, txHash, walletAddr)

    console.log(`\n=== Price Verification Successful ===`)
    console.log(`Tx hash: ${txHash}`)
    console.log(
        `Explorer: https://${network}.cardanoscan.io/transaction/${txHash}`
    )
}

main().catch((e) => {
    console.error('Price verification failed:', e)
    process.exit(1)
})
