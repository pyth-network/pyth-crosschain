import assert = require("assert");

////////////////////////////////// Start of Logger Stuff //////////////////////////////////////

export let logger: any;

export function initLogger() {
  const winston = require("winston");

  let useConsole: boolean = true;
  let logFileName: string = "";
  if (process.env.LOG_DIR) {
    useConsole = false;
    logFileName =
      process.env.LOG_DIR + "/pyth_relay." + new Date().toISOString() + ".log";
  }

  let logLevel = "info";
  if (process.env.LOG_LEVEL) {
    logLevel = process.env.LOG_LEVEL;
  }

  let transport: any;
  if (useConsole) {
    console.log("pyth_relay is logging to the console at level [%s]", logLevel);

    transport = new winston.transports.Console({
      level: logLevel,
    });
  } else {
    console.log(
      "pyth_relay is logging to [%s] at level [%s]",
      logFileName,
      logLevel
    );

    transport = new winston.transports.File({
      filename: logFileName,
      level: logLevel,
    });
  }

  const logConfiguration = {
    transports: [transport],
    format: winston.format.combine(
      winston.format.splat(),
      winston.format.simple(),
      winston.format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss.SSS",
      }),
      winston.format.printf(
        (info: any) => `${[info.timestamp]}|${info.level}|${info.message}`
      )
    ),
  };

  logger = winston.createLogger(logConfiguration);
}

////////////////////////////////// Start of PYTH Stuff //////////////////////////////////////

/*
  // Pyth messages are defined in whitepapers/0007_pyth_over_wormhole.md

  // The Pyth smart contract stuff is in terra/contracts/pyth-bridge

  struct Ema {
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

      Ema twap;
      Ema twac;

      uint64 confidenceInterval;

      uint8 status;
      uint8 corpAct;

      uint64 timestamp;
  }

0   uint32    magic // constant "P2WH"
4   u16       version
6   u8        payloadId // 1
7   [u8; 32]  productId
39  [u8; 32]  priceId
71  u8        priceType
72  i64       price
80  i32       exponent
84  PythEma   twap
108 PythEma   twac
132 u64       confidenceInterval
140 u8        status
141 u8        corpAct
142 u64       timestamp

Note: Price Attestation can append new fields in the future.

In version 2 prices are sent in batch with the following structure:

  struct BatchPriceAttestation {
      uint32 magic; // constant "P2WH"
      uint16 version;

      // PayloadID uint8 = 2
      uint8 payloadId;

      // number of attestations 
      uint16 nAttestations;

      // attestation_size = 150
      uint16 attestationSize;
      
      priceAttestations: PriceAttestation[]
  }

0   uint32    magic // constant "P2WH"
4   u16       version
6   u8        payloadId // 2
7   u16       n_attestations
9   u16       attestation_size // >= 150, price attestation might append new fields and the library should tolerate it.
11  ..        price_attestation (Size: attestation_size x [n_attestations])

*/

export const PYTH_PRICE_ATTESTATION_V2_LENGTH: number = 150;
export const PYTH_BATCH_PRICE_ATTESTATION_MIN_LENGTH: number = 11 + PYTH_PRICE_ATTESTATION_V2_LENGTH;

export type PythEma = {
  value: BigInt;
  numerator: BigInt;
  denominator: BigInt;
};

export type PythPriceAttestation = {
  magic: number;
  version: number;
  payloadId: number;
  productId: string;
  priceId: string;
  priceType: number;
  price: BigInt;
  exponent: number;
  twap: PythEma;
  twac: PythEma;
  confidenceInterval: BigInt;
  status: number;
  corpAct: number;
  timestamp: BigInt;
};

export type PythBatchPriceAttestation = {
  magic: number;
  version: number; 
  payloadId: number;
  nAttestations: number;
  attestationSize: number;
  priceAttestations: PythPriceAttestation[];
}

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

export function parsePythPriceAttestation(arr: Buffer): PythPriceAttestation {
  return {
    magic: arr.readUInt32BE(0),
    version: arr.readUInt16BE(4),
    payloadId: arr[6],
    productId: arr.slice(7, 7 + 32).toString("hex"),
    priceId: arr.slice(39, 39 + 32).toString("hex"),
    priceType: arr[71],
    price: arr.readBigInt64BE(72),
    exponent: arr.readInt32BE(80),
    twap: {
      value: arr.readBigInt64BE(84),
      numerator: arr.readBigInt64BE(92),
      denominator: arr.readBigInt64BE(100),
    },
    twac: {
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

export function parsePythBatchPriceAttestation(arr: Buffer): PythBatchPriceAttestation {
  if (!isPyth(arr)) {
    throw new Error("Cannot parse payload. Header mismatch: This is not a Pyth 2 Wormhole message");
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

  if (attestationSize <= PYTH_PRICE_ATTESTATION_V2_LENGTH) {
    throw new Error(
      `Cannot parse payload. Size of attestation ${attestationSize} is less than V2 length ${PYTH_PRICE_ATTESTATION_V2_LENGTH}`
    );
  }

  let priceAttestations: PythPriceAttestation[] = []

  let offset = 11;
  for (let i = 0; i < nAttestations; i += 1) {
    priceAttestations.push(parsePythPriceAttestation(arr.subarray(offset, offset + attestationSize)));
    offset += attestationSize;
  }

  return {
      magic,
      version,
      payloadId,
      nAttestations,
      attestationSize,
      priceAttestations
    }
}

// Returns a hash of all priceIds within the batch, it can be used to identify whether there is a
// new batch with exact same symbols (and ignore the old one)
export function getBatchAttestationHashKey(batchAttestation: PythBatchPriceAttestation): number {
  let hash: number = 0;

  for (let priceAttestation of batchAttestation.priceAttestations) {
    for (let i = 0; i < priceAttestation.priceId.length; i++) {
      hash = hash * 709 + priceAttestation.priceId.charCodeAt(i);
      hash = hash & hash; //Bitwise & converts number to 32-bit integer and then result is converted back to number
    }
  }

  return hash;
}

export function getBatchSummary(batchAttestation: PythBatchPriceAttestation): string {
  let abstractRepresentation = {
    "num_attestations": batchAttestation.nAttestations,
    "prices": batchAttestation.priceAttestations.map((priceAttestation) => {
        return {
          "price_id": priceAttestation.priceId,
          "price": computePrice(priceAttestation.price, priceAttestation.exponent),
          "conf": computePrice(priceAttestation.confidenceInterval, priceAttestation.exponent)
        }
    })
  }
  return JSON.stringify(abstractRepresentation)
}

////////////////////////////////// Start of Other Helpful Stuff //////////////////////////////////////

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function computePrice(rawPrice: BigInt, expo: number): number {
  return Number(rawPrice) * 10 ** expo;
}
