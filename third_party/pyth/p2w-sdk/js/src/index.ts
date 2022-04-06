import { getSignedVAA, CHAIN_ID_SOLANA } from "@certusone/wormhole-sdk";
import { zeroPad } from "ethers/lib/utils";
import { PublicKey } from "@solana/web3.js";


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

export const PYTH_PRICE_ATTESTATION_MIN_LENGTH: number = 150;
export const PYTH_BATCH_PRICE_ATTESTATION_MIN_LENGTH: number =
    11 + PYTH_PRICE_ATTESTATION_MIN_LENGTH;

export type Rational = {
    value: BigInt;
    numerator: BigInt;
    denominator: BigInt;
};

export type PriceAttestation = {
    magic: number;
    version: number;
    payloadId: number;
    productId: string;
    priceId: string;
    priceType: number;
    price: BigInt;
    exponent: number;
    emaPrice: Rational;
    emaConfidence: Rational;
    confidenceInterval: BigInt;
    status: number;
    corpAct: number;
    timestamp: BigInt;
};

export type BatchPriceAttestation = {
    magic: number;
    version: number;
    payloadId: number;
    nAttestations: number;
    attestationSize: number;
    priceAttestations: PriceAttestation[];
};

export const PYTH_MAGIC: number = 0x50325748;

function isPyth(payload: Buffer): boolean {
    if (payload.length < 4) return false;
    if (
        payload[0] === 80 &&
        payload[1] === 50 &&
        payload[2] === 87 &&
        payload[3] === 72
    ) {
        // The numbers correspond to "P2WH"
        return true;
    }

    return false;
}

export function parsePriceAttestation(arr: Buffer): PriceAttestation {
    return {
        magic: arr.readUInt32BE(0),
        version: arr.readUInt16BE(4),
        payloadId: arr[6],
        productId: arr.slice(7, 7 + 32).toString("hex"),
        priceId: arr.slice(39, 39 + 32).toString("hex"),
        priceType: arr[71],
        price: arr.readBigInt64BE(72),
        exponent: arr.readInt32BE(80),
        emaPrice: {
            value: arr.readBigInt64BE(84),
            numerator: arr.readBigInt64BE(92),
            denominator: arr.readBigInt64BE(100),
        },
        emaConfidence: {
            value: arr.readBigInt64BE(108),
            numerator: arr.readBigInt64BE(116),
            denominator: arr.readBigInt64BE(124),
        },
        confidenceInterval: arr.readBigUInt64BE(132),
        status: arr.readUInt32BE(140),
        corpAct: arr.readUInt32BE(141),
        timestamp: arr.readBigUInt64BE(142),
    };
}

export function parseBatchPriceAttestation(
    arr: Buffer
): BatchPriceAttestation {
    if (!isPyth(arr)) {
        throw new Error(
            "Cannot parse payload. Header mismatch: This is not a Pyth 2 Wormhole message"
        );
    }

    if (arr.length < PYTH_BATCH_PRICE_ATTESTATION_MIN_LENGTH) {
        throw new Error(
            "Cannot parse payload. Payload length is wrong: length: " +
            arr.length +
            ", expected length to be at least:" +
            PYTH_BATCH_PRICE_ATTESTATION_MIN_LENGTH
        );
    }

    const magic = arr.readUInt32BE(0);
    const version = arr.readUInt16BE(4);
    const payloadId = arr[6];
    const nAttestations = arr.readUInt16BE(7);
    const attestationSize = arr.readUInt16BE(9);

    if (attestationSize < PYTH_PRICE_ATTESTATION_MIN_LENGTH) {
        throw new Error(
            `Cannot parse payload. Size of attestation ${attestationSize} is less than V2 length ${PYTH_PRICE_ATTESTATION_MIN_LENGTH}`
        );
    }

    let priceAttestations: PriceAttestation[] = [];

    let offset = 11;
    for (let i = 0; i < nAttestations; i += 1) {
        priceAttestations.push(
            parsePriceAttestation(arr.subarray(offset, offset + attestationSize))
        );
        offset += attestationSize;
    }

    return {
        magic,
        version,
        payloadId,
        nAttestations,
        attestationSize,
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
    batchAttestation: BatchPriceAttestation
): string {
    let abstractRepresentation = {
        num_attestations: batchAttestation.nAttestations,
        prices: batchAttestation.priceAttestations.map((priceAttestation) => {
            return {
                price_id: priceAttestation.priceId,
                price: computePrice(priceAttestation.price, priceAttestation.exponent),
                conf: computePrice(
                    priceAttestation.confidenceInterval,
                    priceAttestation.exponent
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
