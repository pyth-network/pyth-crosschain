import { Relay, RelayResult, RelayRetcode, PriceId } from "./iface";
import { ethers } from "ethers";
import { logger } from "../helpers";
import { hexToUint8Array } from "@certusone/wormhole-sdk";
import { importCoreWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import { AbstractPyth__factory, AbstractPyth } from "../evm/bindings/";
import { parseBatchPriceAttestation } from "@pythnetwork/wormhole-attester-sdk";

let WH_WASM: any = null;

// Neat trick to import wormhole wasm cheaply
async function whWasm(): Promise<any> {
  if (!WH_WASM) {
    WH_WASM = await importCoreWasm();
  }
  return WH_WASM;
}

export class EvmRelay implements Relay {
  payerWallet: ethers.Wallet;
  p2wContract: AbstractPyth;
  // p2w contract sanity check; If set to true, we log query() results
  // on all prices in a batch before and after relaying.
  verifyPriceFeeds: boolean;
  async relay(signedVAAs: Array<string>): Promise<RelayResult> {
    let batchCount = signedVAAs.length;
    const { parse_vaa } = await whWasm();

    // Schedule all received batches in parallel
    let txs = [];
    for (let i = 0; i < signedVAAs.length; ++i) {
      let batchNo = i + 1;
      let parsedVAA = parse_vaa(hexToUint8Array(signedVAAs[i]));
      let parsedBatch = await parseBatchPriceAttestation(
        Buffer.from(parsedVAA.payload)
      );

      let priceIds: PriceId[] = [];
      for (let j = 0; j < parsedBatch.priceAttestations.length; ++j) {
        priceIds.push(parsedBatch.priceAttestations[j].priceId);
      }

      let batchFeedsBefore = this.verifyPriceFeeds
        ? await this.queryMany(priceIds)
        : null;

      const updateData = ["0x" + signedVAAs[i]];
      const updateFee = await this.p2wContract.getUpdateFee(
        updateData
      );

      let tx = this.p2wContract
        .updatePriceFeeds(updateData, { gasLimit: 2000000, value: updateFee })
        .then(async (pending) => {
          let receipt = await pending.wait();
          logger.info(
            `Batch ${batchNo}/${batchCount} tx OK, status ${receipt.status} tx hash ${receipt.transactionHash}`
          );
          logger.debug(
            `Batch ${batchNo}/${batchCount} Full details ${JSON.stringify(
              receipt
            )}`
          );
          let batchFeedsAfter = this.verifyPriceFeeds
            ? await this.queryMany(priceIds)
            : null;

          if (batchFeedsBefore && batchFeedsAfter) {
            this.logFeedCmp(batchFeedsBefore, batchFeedsAfter);
          }
          return new RelayResult(RelayRetcode.Success, [
            receipt.transactionHash,
          ]);
        })
        .catch((e) => {
          logger.error(
            `Batch ${batchNo}/${batchCount} tx failed: ${e.code}, failed tx hash ${e.transactionHash}`
          );
          let detailed_msg = `Batch ${batchNo}/${batchCount} failure details: ${JSON.stringify(
            e
          )}`;
          logger.debug(detailed_msg);
          return new RelayResult(RelayRetcode.Fail, []);
        });

      txs.push(tx);
    }

    logger.info(`scheduled ${txs.length} EVM transaction(s)`);

    let results = await Promise.all(txs);

    let ok = true;
    let txHashes: Array<string> = [];
    for (let res of results) {
      if (res.is_ok()) {
        txHashes.concat(res.txHashes);
      } else {
        ok = false;
      }
    }

    // TODO(2021-03-23): Make error reporting for caller more granular (Array<RelayResult>, retries etc.)
    if (ok) {
      return new RelayResult(RelayRetcode.Success, txHashes);
    } else {
      return new RelayResult(RelayRetcode.Fail, []);
    }
  }
  async query(priceId: PriceId): Promise<any> {
    return await this.p2wContract.queryPriceFeed(priceId);
  }
  /// Query many `priceIds` in parallel, used internally by `relay()`
  /// for implementing `this.verifyPriceFeeds`.
  async queryMany(priceIds: Array<PriceId>): Promise<any[]> {
    let batchFeedLookups = [];
    for (let i = 0; i < priceIds.length; ++i) {
      let lookup = this.query("0x" + priceIds[i]).catch((e) => {
        logger.warn(`Could not look up price ${priceIds[i]}`);
        return `<failed query() for ${priceIds[i]}>`;
      });
      batchFeedLookups.push(lookup);
    }

    return Promise.all(batchFeedLookups);
  }
  /// Helper method for relay(); compares two arrays of batch records with relevant log messages.
  /// A comparison before and after a relay() call is a useful sanity check.
  logFeedCmp(before: Array<any>, after: Array<any>) {
    if (before.length != after.length) {
      logger.error("INTERNAL: logFeedCmp() before/after length mismatch");
      return;
    }

    let changedCount = 0;
    for (let j = 0; j < before.length; ++j) {
      if (before[j] != after[j]) {
        changedCount++;
        logger.debug(
          `price ${j + 1}/${before.length} changed:\n==== OLD ====\n${
            before[j]
          }\n==== NEW ====\n${after[j]}`
        );
      } else {
        logger.debug(`price ${j + 1}/${before.length} unchanged`);
      }
    }

    if (changedCount > 0) {
      logger.info(`${changedCount} price feeds changed in relay() run`);
    } else {
      // Yell louder if feeds hadn't changed
      logger.warn(`All ${changedCount} price feeds unchanged in relay() run`);
    }
  }
  async getPayerInfo(): Promise<{ address: string; balance: bigint }> {
    return {
      address: this.payerWallet.address,
      balance: BigInt(`${await this.payerWallet.getBalance()}`),
    };
  }

  constructor(cfg: {
    jsonRpcUrl: string;
    payerWalletMnemonic: string;
    payerHDWalletPath: string;
    p2wContractAddress: string;
    verifyPriceFeeds: boolean;
  }) {
    let provider = new ethers.providers.JsonRpcProvider(cfg.jsonRpcUrl);
    let wallet = ethers.Wallet.fromMnemonic(
      cfg.payerWalletMnemonic,
      cfg.payerHDWalletPath
    );

    this.payerWallet = new ethers.Wallet(wallet.privateKey, provider);
    this.p2wContract = AbstractPyth__factory.connect(cfg.p2wContractAddress, this.payerWallet);
    this.verifyPriceFeeds = cfg.verifyPriceFeeds;

    // This promise and throw exist because of constructor() limitations.
    provider.getCode(cfg.p2wContractAddress).then((code) => {
      if (code == "0x") {
        let msg = `Address ${cfg.p2wContractAddress} does not appear to be a contract (getCode() yields 0x)`;
        logger.error(msg);
        throw msg;
      }
    });
  }
}
