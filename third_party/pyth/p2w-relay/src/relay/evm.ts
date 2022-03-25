import { Relay, RelayResult, RelayRetcode, PriceId } from "./iface";
import { ethers } from "ethers";
import { logger, parsePythBatchPriceAttestation } from "../helpers";
import { hexToUint8Array } from "@certusone/wormhole-sdk";
import { importCoreWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import { PythUpgradable__factory, PythUpgradable } from "../evm/bindings/";

export class EvmRelay implements Relay {
  payerWallet: ethers.Wallet;
  p2wContract: PythUpgradable;
  async relay(signedVAAs: Array<string>): Promise<RelayResult> {
    let code = await this.p2wContract.provider.getCode(
      this.p2wContract.address
    );

    if (code == "0x") {
      logger.error(
        `Address ${this.p2wContract.address} does not appear to be a contract (getCode() yields 0x)`
      );
      return new RelayResult(RelayRetcode.Fail, []);
    }

    let batchCount = signedVAAs.length;
    const { parse_vaa } = await importCoreWasm();

    // Schedule all received batches in parallel
    let txs = [];
    for (let i = 0; i < signedVAAs.length; ++i) {
      let batchNo = i + 1;
      let parsedVAA = parse_vaa(hexToUint8Array(signedVAAs[i]));
      let parsedBatch = parsePythBatchPriceAttestation(
        Buffer.from(parsedVAA.payload)
      );

      let batch_feeds_before: any[] = [];
      for (let j = 0; j < parsedBatch.nAttestations; ++j) {
        try {
          batch_feeds_before.push(
            await this.query("0x" + parsedBatch.priceAttestations[j].priceId)
          );
        } catch (e) {
          logger.warn(
            `Could not look up price ${j + 1} / ${
              parsedBatch.nAttestations
            } before tx`
          );
          batch_feeds_before.push("<failed query() before tx>");
        }
      }
      let tx = await this.p2wContract
        .updatePriceBatchFromVm("0x" + signedVAAs[i], { gasLimit: 1000000 })
        .then(async (pending) => {
          try {
            let receipt = await pending.wait();
            logger.info(
              `Batch ${batchNo}/${batchCount} tx OK, status ${receipt.status} tx hash ${receipt.transactionHash}`
            );
            logger.debug(
              `Batch ${batchNo}/${batchCount} Full details ${JSON.stringify(
                receipt
              )}`
            );
            let no_diff_count = 0;
            for (let j = 0; j < parsedBatch.nAttestations; ++j) {
              let feed_before = batch_feeds_before[j];
              let feed_after;
              try {
                feed_after = await this.query(
                  "0x" + parsedBatch.priceAttestations[j].priceId
                );
              } catch (e) {
                logger.warn(
                  `Could not look up price ${j + 1} / ${
                    parsedBatch.nAttestations
                  } after tx`
                );
                feed_after = "<Failed query() after tx>";
              }

              if (feed_before != feed_after) {
                logger.debug(
                  `[Batch ${batchNo}/${batchCount}] price ${j}/${batch_feeds_before.length} changed:\n==== OLD ====\n${feed_before}\n==== NEW ====\n${feed_after}`
                );
              } else {
                no_diff_count++;
                logger.debug(
                  `[Batch ${batchNo}/${batchCount}] price ${j}/${batch_feeds_before.length} unchanged`
                );
              }
            }

            if (no_diff_count > 0) {
              logger.info(
                `${no_diff_count}/${parsedBatch.nAttestations} price feeds changed`
              );
            } else {
              logger.warn(
                `[Batch ${batchNo}/${batchCount}] All ${parsedBatch.nAttestations} price feeds unchanged after relay() run`
              );
            }
            return new RelayResult(RelayRetcode.Success, [
              receipt.transactionHash,
            ]);
          } catch (e: any) {
            logger.error(
              `Batch ${batchNo}/${batchCount} tx failed: ${e.code}, failed tx hash ${e.transactionHash}`
            );
            logger.error(
              `Batch ${batchNo}/${batchCount} failure details: ${JSON.stringify(
                e
              )}`
            );
          }
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
  async getPayerInfo(): Promise<{ address: string; balance: bigint }> {
    return {
      address: this.payerWallet.address,
      balance: BigInt(`${await this.payerWallet.getBalance()}`),
    };
  }

  constructor(cfg: {
    rpcWsUrl: string;
    payerWalletMnemonic: string;
    payerHDWalletPath: string;
    p2wContractAddress: string;
  }) {
    let provider = new ethers.providers.WebSocketProvider(cfg.rpcWsUrl);
    let wallet = ethers.Wallet.fromMnemonic(
      cfg.payerWalletMnemonic,
      cfg.payerHDWalletPath
    );

    this.payerWallet = new ethers.Wallet(wallet.privateKey, provider);
    let factory = new PythUpgradable__factory(this.payerWallet);
    this.p2wContract = factory.attach(cfg.p2wContractAddress);

    provider.getCode(cfg.p2wContractAddress).then((code) => {
      if (code == "0x") {
        let msg = `Address ${cfg.p2wContractAddress} does not appear to be a contract (getCode() yields 0x)`;
        logger.error(msg);
        throw msg;
      }
    });
  }
}
