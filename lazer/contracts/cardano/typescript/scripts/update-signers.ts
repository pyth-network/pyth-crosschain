import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import {
    BlockfrostProvider,
    deserializeAddress,
    deserializeDatum,
    MeshTxBuilder,
    MeshWallet,
    type UTxO,
} from '@meshsdk/core'
import {
    buildUpdateSignersTx,
    initializeValidators,
} from '../src/admin.js'
import { getPythPriceScript } from '../src/dapp.js'

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

function parseSignerArg(arg: string): ParsedSigner {
    // Format: <pubkey>[:<validFrom>:<validTo>]
    // validFrom/validTo are slot numbers; empty means unbounded
    const parts = arg.split(':')
    const pubkey = parts[0].toLowerCase()

    if (!/^[0-9a-fA-F]{64}$/.test(pubkey)) {
        console.error(
            `Error: Invalid signer pubkey "${pubkey}" — must be 64 hex chars (32 bytes)`
        )
        process.exit(1)
    }

    const result: ParsedSigner = { pubkey }

    if (parts.length >= 2 && parts[1] !== '') {
        const from = parseInt(parts[1], 10)
        if (isNaN(from)) {
            console.error(`Error: Invalid validFrom "${parts[1]}" — must be a slot number`)
            process.exit(1)
        }
        result.validFrom = from
    }

    if (parts.length >= 3 && parts[2] !== '') {
        const to = parseInt(parts[2], 10)
        if (isNaN(to)) {
            console.error(`Error: Invalid validTo "${parts[2]}" — must be a slot number`)
            process.exit(1)
        }
        result.validTo = to
    }

    return result
}

function parseArgs(): {
    network: Network
    mnemonic: string
    blockfrostKey: string
    signers: ParsedSigner[]
} {
    const args = process.argv.slice(2)

    const network = args[0] as Network
    if (!VALID_NETWORKS.includes(network)) {
        console.error(
            'Usage: npx tsx scripts/update-signers.ts <preview|preprod> --signer <pubkey>[:<from>:<to>] [...]\n' +
                '\n' +
                'Examples:\n' +
                '  --signer abc123...def456                   # valid forever\n' +
                '  --signer abc123...def456:1000:2000         # valid from slot 1000 to 2000\n' +
                '  --signer abc123...def456:1000:             # valid from slot 1000, no end\n' +
                '  --signer abc123...def456::2000             # no start, valid until slot 2000'
        )
        process.exit(1)
    }

    const signers: ParsedSigner[] = []

    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--signer' && args[i + 1]) {
            signers.push(parseSignerArg(args[++i]))
        }
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

    return { network, mnemonic, blockfrostKey, signers }
}

interface ParsedSigner {
    pubkey: string
    validFrom?: number
    validTo?: number
}

/**
 * Decode the on-chain signing policy datum into a list of signers.
 *
 * The datum structure is:
 *   Constr(0, [List<[pubkey_bytes, Constr(0, [lower_bound, upper_bound])]>])
 *
 * Where bounds are Constr(0, [BoundType, is_inclusive]):
 *   BoundType: Constr(0,[])=NegInf, Constr(1,[value])=Finite, Constr(2,[])=PosInf
 */
/**
 * Decode the on-chain signing policy datum into a list of signers.
 *
 * Mesh's deserializeDatum returns:
 *   { constructor: BigInt, fields: [...] } for Constr nodes
 *   { list: [...] } for lists
 *   { bytes: "hex" } for byte strings
 *   { int: BigInt } for integers
 *
 * The datum structure is:
 *   Constr(0, [List<[pubkey_bytes, Constr(0, [lower_bound, upper_bound])]>])
 *
 * Where bounds are Constr(0, [BoundType, is_inclusive]):
 *   BoundType: Constr(0,[])=NegInf, Constr(1,[value])=Finite, Constr(2,[])=PosInf
 */
function parseSigningPolicyDatum(datumCbor: string): ParsedSigner[] {
    const datum = deserializeDatum(datumCbor) as any

    const signerListWrapper = datum.fields?.[0]
    const signerList = signerListWrapper?.list
    if (!Array.isArray(signerList)) {
        return []
    }

    return signerList.map((entry: any) => {
        // Each entry is { list: [{ bytes: pubkey }, { constructor, fields: [lower, upper] }] }
        const tuple = entry.list
        const pubkey: string = tuple[0].bytes
        const interval = tuple[1]

        const result: ParsedSigner = { pubkey }

        if (interval?.fields) {
            const lower = interval.fields[0]
            const upper = interval.fields[1]

            // Extract finite bounds — Constr(1, [value]) = Finite
            const lowerType = lower?.fields?.[0]
            if (lowerType?.constructor === 1n && lowerType.fields?.length > 0) {
                result.validFrom = Number(lowerType.fields[0].int)
            }

            const upperType = upper?.fields?.[0]
            if (upperType?.constructor === 1n && upperType.fields?.length > 0) {
                result.validTo = Number(upperType.fields[0].int)
            }
        }

        return result
    })
}

function formatRange(s: ParsedSigner): string {
    const from = s.validFrom !== undefined ? `slot ${s.validFrom}` : '-inf'
    const to = s.validTo !== undefined ? `slot ${s.validTo}` : '+inf'
    return `${from} .. ${to}`
}

function formatSigner(s: ParsedSigner): string {
    let line = `  ${s.pubkey}`
    if (s.validFrom !== undefined || s.validTo !== undefined) {
        line += ` (valid: ${formatRange(s)})`
    }
    return line
}

async function confirm(message: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    })
    return new Promise((resolve) => {
        rl.question(`${message} [y/N] `, (answer) => {
            rl.close()
            resolve(answer.trim().toLowerCase() === 'y')
        })
    })
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
    const { network, mnemonic, blockfrostKey, signers: newSigners } =
        parseArgs()

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

    const ownerAddr = await wallet.getChangeAddress()
    const ownerPkh = deserializeAddress(ownerAddr).pubKeyHash
    console.log(`Owner address: ${ownerAddr}`)

    // 2. Initialize validators
    const validators = initializeValidators(ownerPkh, 0)
    const { signerScript, signerAddress, signerPolicyId } = validators
    const priceScript = getPythPriceScript(signerPolicyId, 0)

    console.log(`Signer policy ID: ${signerPolicyId}`)

    // 3. Find signer NFT UTxO
    const signerUtxos = await provider.fetchAddressUTxOs(signerAddress)
    const signerNftUtxo = signerUtxos.find((u: UTxO) =>
        u.output.amount.some(
            (a) => a.unit === signerPolicyId + SIGNER_TOKEN_NAME
        )
    )

    if (!signerNftUtxo) {
        console.error(
            'Error: Signer NFT not found at the script address.\n' +
                'Make sure the oracle is deployed. Run: npm run deploy -- ' +
                network
        )
        process.exit(1)
    }

    console.log(
        `Signer NFT UTxO: ${signerNftUtxo.input.txHash}#${signerNftUtxo.input.outputIndex}`
    )

    // 4. Decode current signing policy
    const datumCbor = signerNftUtxo.output.plutusData
    let currentSigners: ParsedSigner[] = []
    if (datumCbor) {
        try {
            currentSigners = parseSigningPolicyDatum(datumCbor)
        } catch (e) {
            console.error('Warning: Could not parse existing datum:', e)
        }
    }

    // 5. Show diff
    const currentSet = new Set(currentSigners.map((s) => s.pubkey))
    const newSet = new Set(newSigners.map((s) => s.pubkey))

    const removed = currentSigners.filter((s) => !newSet.has(s.pubkey))
    const added = newSigners.filter((s) => !currentSet.has(s.pubkey))
    const kept = newSigners.filter((s) => currentSet.has(s.pubkey))

    console.log(`\n--- Current signers (${currentSigners.length}) ---`)
    if (currentSigners.length === 0) {
        console.log('  (none)')
    } else {
        for (const s of currentSigners) {
            console.log(formatSigner(s))
        }
    }

    console.log(`\n--- New signers (${newSigners.length}) ---`)
    for (const s of newSigners) {
        console.log(formatSigner(s))
    }

    console.log(`\n--- Changes ---`)

    const currentByPubkey = new Map(
        currentSigners.map((s) => [s.pubkey, s])
    )

    // Detect range changes for kept signers
    const modified = kept.filter((s) => {
        const old = currentByPubkey.get(s.pubkey)!
        return old.validFrom !== s.validFrom || old.validTo !== s.validTo
    })
    const unchanged = kept.filter((s) => {
        const old = currentByPubkey.get(s.pubkey)!
        return old.validFrom === s.validFrom && old.validTo === s.validTo
    })

    if (
        removed.length === 0 &&
        added.length === 0 &&
        modified.length === 0
    ) {
        console.log('  No changes.')
        return
    }
    for (const s of removed) {
        console.log(`  - REMOVE ${s.pubkey}`)
    }
    for (const s of added) {
        console.log(`  + ADD    ${s.pubkey}`)
        if (s.validFrom !== undefined || s.validTo !== undefined) {
            console.log(`           ${formatRange(s)}`)
        }
    }
    for (const s of modified) {
        const old = currentByPubkey.get(s.pubkey)!
        console.log(`  ~ UPDATE ${s.pubkey}`)
        console.log(`           ${formatRange(old)} -> ${formatRange(s)}`)
    }
    if (unchanged.length > 0) {
        console.log(`  = KEEP   ${unchanged.length} signer(s)`)
    }

    // 6. Confirm
    const ok = await confirm('\nProceed with update?')
    if (!ok) {
        console.log('Aborted.')
        return
    }

    // 7. Build and submit update transaction
    console.log('\nBuilding update transaction...')
    const walletUtxos = await provider.fetchAddressUTxOs(ownerAddr)
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

    buildUpdateSignersTx(
        txBuilder,
        signerScript.scriptCbor,
        signerAddress,
        signerPolicyId,
        ownerPkh,
        signerNftUtxo,
        newSigners,
        priceScript.scriptCbor
    )
    txBuilder.changeAddress(ownerAddr).selectUtxosFrom(walletUtxos)
    txBuilder.txInCollateral(
        walletUtxos[0].input.txHash,
        walletUtxos[0].input.outputIndex,
        walletUtxos[0].output.amount,
        walletUtxos[0].output.address
    )

    console.log('Signing and submitting transaction...')
    const unsignedTx = await txBuilder.complete()
    const signedTx = await wallet.signTx(unsignedTx)
    const txHash = await provider.submitTx(signedTx)
    console.log(`Transaction submitted: ${txHash}`)

    console.log('Waiting for confirmation...')
    await waitForTx(provider, txHash, ownerAddr)

    console.log(`\n=== Signers Updated ===`)
    console.log(`Tx hash: ${txHash}`)
    console.log(
        `Explorer: https://${network}.cardanoscan.io/transaction/${txHash}`
    )
}

main().catch((e) => {
    console.error('Update failed:', e)
    process.exit(1)
})
