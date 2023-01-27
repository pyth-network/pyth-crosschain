import { PriceFeed, Price, UnixTimestamp } from "@pythnetwork/pyth-sdk-js";

export type PriceAttestation = {
  productId: string;
  priceId: string;
  price: string;
  conf: string;
  expo: number;
  emaPrice: string;
  emaConf: string;
  status: number;
  numPublishers: number;
  maxNumPublishers: number;
  attestationTime: UnixTimestamp;
  publishTime: UnixTimestamp;
  prevPublishTime: UnixTimestamp;
  prevPrice: string;
  prevConf: string;
};

export type BatchPriceAttestation = {
  priceAttestations: PriceAttestation[];
};

/// Precedes every message implementing the wormhole attester serialization format
const P2W_FORMAT_MAGIC: string = "P2WH";
const P2W_FORMAT_VER_MAJOR = 3;
const P2W_FORMAT_VER_MINOR = 0;
const P2W_FORMAT_PAYLOAD_ID = 2;

export function parsePriceAttestation(bytes: Buffer): PriceAttestation {
  let offset = 0;

  const productId = bytes.slice(offset, offset + 32).toString("hex");
  offset += 32;

  const priceId = bytes.slice(offset, offset + 32).toString("hex");
  offset += 32;

  const price = bytes.readBigInt64BE(offset).toString();
  offset += 8;

  const conf = bytes.readBigUint64BE(offset).toString();
  offset += 8;

  const expo = bytes.readInt32BE(offset);
  offset += 4;

  const emaPrice = bytes.readBigInt64BE(offset).toString();
  offset += 8;

  const emaConf = bytes.readBigUint64BE(offset).toString();
  offset += 8;

  const status = bytes.readUint8(offset);
  offset += 1;

  const numPublishers = bytes.readUint32BE(offset);
  offset += 4;

  const maxNumPublishers = bytes.readUint32BE(offset);
  offset += 4;

  const attestationTime = Number(bytes.readBigInt64BE(offset));
  offset += 8;

  const publishTime = Number(bytes.readBigInt64BE(offset));
  offset += 8;

  const prevPublishTime = Number(bytes.readBigInt64BE(offset));
  offset += 8;

  const prevPrice = bytes.readBigInt64BE(offset).toString();
  offset += 8;

  const prevConf = bytes.readBigUint64BE(offset).toString();
  offset += 8;

  return {
    productId,
    priceId,
    price,
    conf,
    expo,
    emaPrice,
    emaConf,
    status,
    numPublishers,
    maxNumPublishers,
    attestationTime,
    publishTime,
    prevPublishTime,
    prevPrice,
    prevConf,
  };
}

// Read the sdk/rust as the reference implementation and documentation.
export function parseBatchPriceAttestation(
  bytes: Buffer
): BatchPriceAttestation {
  let offset = 0;

  const magic = bytes.slice(offset, offset + 4).toString("utf8");
  offset += 4;
  if (magic !== P2W_FORMAT_MAGIC) {
    throw new Error(`Invalid magic: ${magic}, expected: ${P2W_FORMAT_MAGIC}`);
  }

  const versionMajor = bytes.readUInt16BE(offset);
  offset += 2;
  if (versionMajor !== P2W_FORMAT_VER_MAJOR) {
    throw new Error(
      `Unsupported major version: ${versionMajor}, expected: ${P2W_FORMAT_VER_MAJOR}`
    );
  }

  const versionMinor = bytes.readUInt16BE(offset);
  offset += 2;
  if (versionMinor < P2W_FORMAT_VER_MINOR) {
    throw new Error(
      `Unsupported minor version: ${versionMinor}, expected: ${P2W_FORMAT_VER_MINOR}`
    );
  }

  // Header size is added for future-compatibility
  const headerSize = bytes.readUint16BE(offset);
  offset += 2;

  let headerOffset = 0;

  const payloadId = bytes.readUint8(offset + headerOffset);
  headerOffset += 1;

  if (payloadId !== P2W_FORMAT_PAYLOAD_ID) {
    throw new Error(
      `Invalid payloadId: ${payloadId}, expected: ${P2W_FORMAT_PAYLOAD_ID}`
    );
  }

  offset += headerSize;

  const batchLen = bytes.readUInt16BE(offset);
  offset += 2;

  const attestationSize = bytes.readUint16BE(offset);
  offset += 2;

  let priceAttestations: PriceAttestation[] = [];

  for (let i = 0; i < batchLen; i += 1) {
    priceAttestations.push(
      parsePriceAttestation(bytes.subarray(offset, offset + attestationSize))
    );
    offset += attestationSize;
  }

  if (offset !== bytes.length) {
    throw new Error(`Invalid length: ${bytes.length}, expected: ${offset}`);
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

export function getBatchSummary(batch: BatchPriceAttestation): string {
  const abstractRepresentation = {
    num_attestations: batch.priceAttestations.length,
    prices: batch.priceAttestations.map((priceAttestation) => {
      const priceFeed = priceAttestationToPriceFeed(priceAttestation);
      return {
        price_id: priceFeed.id,
        price: priceFeed.getPriceUnchecked().getPriceAsNumberUnchecked(),
        conf: priceFeed.getEmaPriceUnchecked().getConfAsNumberUnchecked(),
      };
    }),
  };
  return JSON.stringify(abstractRepresentation);
}

export function priceAttestationToPriceFeed(
  priceAttestation: PriceAttestation
): PriceFeed {
  const emaPrice: Price = new Price({
    conf: priceAttestation.emaConf,
    expo: priceAttestation.expo,
    price: priceAttestation.emaPrice,
    publishTime: priceAttestation.publishTime,
  });

  let price: Price;

  if (priceAttestation.status === 1) {
    // 1 means trading
    price = new Price({
      conf: priceAttestation.conf,
      expo: priceAttestation.expo,
      price: priceAttestation.price,
      publishTime: priceAttestation.publishTime,
    });
  } else {
    price = new Price({
      conf: priceAttestation.prevConf,
      expo: priceAttestation.expo,
      price: priceAttestation.prevPrice,
      publishTime: priceAttestation.prevPublishTime,
    });

    // emaPrice won't get updated if the status is unknown and hence it uses
    // the previous publish time
    emaPrice.publishTime = priceAttestation.prevPublishTime;
  }

  return new PriceFeed({
    emaPrice,
    id: priceAttestation.priceId,
    price,
  });
}
