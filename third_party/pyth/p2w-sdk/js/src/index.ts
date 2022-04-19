import { getSignedVAA, CHAIN_ID_SOLANA } from "@certusone/wormhole-sdk";
import { zeroPad } from "ethers/lib/utils";
import { PublicKey } from "@solana/web3.js";

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


/*
  // Definitions exist in p2w-sdk/rust/
  
  struct Rational {
      int64 value;
      int64 numerator;
      int64 denominator;
  }

  struct PriceAttestation {
      uint32 magic; // constant "P2WH"
      uint16 version;

      // PayloadID uint8 = 1
      uint8 payloadId;

      bytes32 productId;
      bytes32 priceId;

      uint8 priceType;

      int64 price;
      int32 exponent;

      Rational emaPrice;
      Rational emaConfidence;

      uint64 confidenceInterval;

      uint8 status;
      uint8 corpAct;

      uint64 timestamp;
  }

0   uint32        magic // constant "P2WH"
4   u16           version
6   u8            payloadId // 1
7   [u8; 32]      productId
39  [u8; 32]      priceId
71  u8            priceType
72  i64           price
80  i32           exponent
84  PythRational  emaPrice
108 PythRational  emaConfidence
132 u64           confidenceInterval
140 u8            status
141 u8            corpAct
142 u64           timestamp

In version 2 prices are sent in batch with the following structure:

  struct BatchPriceAttestation {
      uint32 magic; // constant "P2WH"
      uint16 version;

      // PayloadID uint8 = 2
      uint8 payloadId;

      // number of attestations 
      uint16 nAttestations;

      // Length of each price attestation in bytes
      //
      // This field is provided for forwards compatibility. Fields in future may be added in
      // an append-only way allowing for parsers to continue to work by parsing only up to
      // the fields they know, leaving unread input in the buffer. Code may still need to work
      // with the full size of the value however, such as when iterating over lists of attestations,
      // for these use-cases the structure size is included as a field.
      //
      // attestation_size >= 150
      uint16 attestationSize;
      
      priceAttestations: PriceAttestation[]
  }

0   uint32    magic // constant "P2WH"
4   u16       version
6   u8        payloadId // 2
7   u16       n_attestations
9   u16       attestation_size // >= 150
11  ..        price_attestation (Size: attestation_size x [n_attestations])

*/

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
    status: number;
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

export function rawToPriceAttestation(rawVal: any): PriceAttestation {
    return {
	productId: rawVal.product_id,
	priceId: rawVal.price_id,
	price: rawVal.price,
	conf: rawVal.conf,
	expo: rawVal.expo,
	emaPrice: rawVal.ema_price,
	emaConf: rawVal.ema_conf,
	status: rawVal.status,
	numPublishers: rawVal.num_publishers,
	maxNumPublishers: rawVal.max_num_publishers,
	attestationTime: rawVal.attestation_time,
	publishTime: rawVal.publish_time,
	prevPublishTime: rawVal.prev_publish_time,
	prevPrice: rawVal.prev_price,
	prevConf: rawVal.prev_conf,
    };
}

export async function parseBatchPriceAttestation(
    arr: Buffer
): Promise<BatchPriceAttestation> {
    
    let wasm = await importWasm();
    let rawVal = await wasm.parse_batch_attestation(arr);

    let priceAttestations = [];

    for (let rawAttestation of rawVal.price_attestations) {
	priceAttestations.push(rawToPriceAttestation(rawAttestation));
    }

    return {
        priceAttestations,
    };
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

function computePrice(rawPrice: BigInt, expo: number): number {
    return Number(rawPrice) * 10 ** expo;
}

function sol_addr2buf(addr: PublicKey): Buffer {
    return Buffer.from(zeroPad(addr.toBytes(), 32));
}
