import { getSignedVAA, CHAIN_ID_SOLANA } from "@certusone/wormhole-sdk";
import { zeroPad } from "ethers/lib/utils";
import { PublicKey } from "@solana/web3.js";
import { PriceFeed, PriceStatus } from "@pythnetwork/pyth-sdk-js";

let _P2W_WASM: any = undefined;


async function importWasm() {
    if (!_P2W_WASM) {
	if (typeof window === 'undefined') {
	  _P2W_WASM = await import("./solana/p2w-core/nodejs/p2w_sdk");
	} else {
	  _P2W_WASM = await import("./solana/p2w-core/bundler/p2w_sdk");
	}
    }
    return _P2W_WASM;
}

export type Rational = {
    value: BigInt;
    numerator: BigInt;
    denominator: BigInt;
};

export type PriceAttestation = {
    productId: string;
    priceId: string;
    price: BigInt;
    conf: BigInt;
    expo: number;
    emaPrice: BigInt;
    emaConf: BigInt;
    status: PriceStatus;
    numPublishers: BigInt;
    maxNumPublishers: BigInt;
    attestationTime: BigInt;
    publishTime: BigInt;
    prevPublishTime: BigInt;
    prevPrice: BigInt;
    prevConf: BigInt;
};

export type BatchPriceAttestation = {
    priceAttestations: PriceAttestation[];
};

export async function parseBatchPriceAttestation(
    arr: Buffer
): Promise<BatchPriceAttestation> {
    
    let wasm = await importWasm();
    let rawVal = await wasm.parse_batch_attestation(arr);

    return rawVal;
}

// Returns a hash of all priceIds within the batch, it can be used to identify whether there is a
// new batch with exact same symbols (and ignore the old one)
export function getBatchAttestationHashKey(
    batchAttestation: BatchPriceAttestation
): string {
    const priceIds: string[] = batchAttestation.priceAttestations.map(
        (priceAttestation) => priceAttestation.priceId
    );
    priceIds.sort();

    return priceIds.join("#");
}

export function getBatchSummary(
    batch: BatchPriceAttestation
): string {
    let abstractRepresentation = {
        num_attestations: batch.priceAttestations.length,
        prices: batch.priceAttestations.map((priceAttestation) => {
            return {
                price_id: priceAttestation.priceId,
                price: computePrice(priceAttestation.price, priceAttestation.expo),
                conf: computePrice(
                    priceAttestation.conf,
                    priceAttestation.expo
                ),
            };
        }),
    };
    return JSON.stringify(abstractRepresentation);
}

export async function getSignedAttestation(host: string, p2w_addr: string, sequence: number, extraGrpcOpts = {}): Promise<any> {
    let [emitter, _] = await PublicKey.findProgramAddress([Buffer.from("p2w-emitter")], new PublicKey(p2w_addr));

    let emitterHex = sol_addr2buf(emitter).toString("hex");
    return await getSignedVAA(host, CHAIN_ID_SOLANA, emitterHex, "" + sequence, extraGrpcOpts);
}

export function priceAttestationToPriceFeed(priceAttestation: PriceAttestation): PriceFeed {
    let status;

    return new PriceFeed({
        conf: priceAttestation.conf.toString(),
        emaConf: priceAttestation.emaConf.toString(),
        emaPrice: priceAttestation.emaPrice.toString(),
        expo: priceAttestation.expo as any,
        id: priceAttestation.priceId,
        maxNumPublishers: priceAttestation.maxNumPublishers as any,
        numPublishers: priceAttestation.numPublishers as any,
        prevConf: priceAttestation.prevConf.toString(),
        prevPrice: priceAttestation.prevPrice.toString(),
        prevPublishTime: priceAttestation.prevPublishTime as any,
        price: priceAttestation.price.toString(),
        productId: priceAttestation.productId,
        publishTime: priceAttestation.publishTime as any,
        status: priceAttestation.status,
    })
}

function computePrice(rawPrice: BigInt, expo: number): number {
    return Number(rawPrice) * 10 ** expo;
}

function sol_addr2buf(addr: PublicKey): Buffer {
    return Buffer.from(zeroPad(addr.toBytes(), 32));
}
