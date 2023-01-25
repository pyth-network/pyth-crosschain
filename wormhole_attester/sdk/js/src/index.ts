import { getSignedVAA, CHAIN_ID_SOLANA } from "@certusone/wormhole-sdk";
import { zeroPad } from "ethers/lib/utils";
import { PublicKey } from "@solana/web3.js";
import { PriceFeed, Price, UnixTimestamp } from "@pythnetwork/pyth-sdk-js";

let _P2W_WASM: any;

async function importWasm() {
  if (!_P2W_WASM) {
    if (typeof window === "undefined") {
      _P2W_WASM = await import("./solana/p2w-core/nodejs/p2w_sdk");
    } else {
      _P2W_WASM = await import("./solana/p2w-core/bundler/p2w_sdk");
    }
  }
  return _P2W_WASM;
}

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

export async function parseBatchPriceAttestation(
  arr: Buffer
): Promise<BatchPriceAttestation> {
  const wasm = await importWasm();
  const rawVal = await wasm.parse_batch_attestation(arr);

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

export async function getSignedAttestation(
  host: string,
  p2wAddr: string,
  sequence: number,
  extraGrpcOpts = {}
): Promise<any> {
  const [emitter, _] = await PublicKey.findProgramAddress(
    [Buffer.from("p2w-emitter")],
    new PublicKey(p2wAddr)
  );

  const emitterHex = sol_addr2buf(emitter).toString("hex");
  return await getSignedVAA(
    host,
    CHAIN_ID_SOLANA,
    emitterHex,
    "" + sequence,
    extraGrpcOpts
  );
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

function sol_addr2buf(addr: PublicKey): Buffer {
  return Buffer.from(zeroPad(addr.toBytes(), 32));
}
