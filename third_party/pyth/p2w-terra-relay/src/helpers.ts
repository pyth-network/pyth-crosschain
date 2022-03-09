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
9   u16       attestation_size // 150
11  ..        price_attestation [n_attestations]

*/

export const PYTH_PRICE_ATTESTATION_LENGTH: number = 150;
export const PYTH_BATCH_PRICE_ATTESTATION_MIN_LENGTH: number = 11 + PYTH_PRICE_ATTESTATION_LENGTH;

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
  const magic = arr.readUInt32BE(0);
  const version = arr.readUInt16BE(4);
  const payloadId = arr[6];
  const nAttestations = arr.readUInt16BE(7);
  const attestationSize = arr.readUInt16BE(9);

  assert.equal(attestationSize, PYTH_PRICE_ATTESTATION_LENGTH);

  let priceAttestations: PythPriceAttestation[] = []

  let offset = 11;
  for (let i = 0; i < nAttestations; i += 1) {
    priceAttestations.push(parsePythPriceAttestation(arr.subarray(offset, offset + PYTH_PRICE_ATTESTATION_LENGTH)));
    offset += PYTH_PRICE_ATTESTATION_LENGTH;
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

export function getBatchSummary(batchAttestation: PythBatchPriceAttestation): string {
  let abstractRepresentation = {
    "num_attestations": batchAttestation.nAttestations,
    "prices": batchAttestation.priceAttestations.map((priceAttestion) => {
        return {
          "price_id": priceAttestion.priceId,
          "price": computePrice(priceAttestion.price, priceAttestion.exponent),
          "conf": computePrice(priceAttestion.confidenceInterval, priceAttestion.exponent)
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
