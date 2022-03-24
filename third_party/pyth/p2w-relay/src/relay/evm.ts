import { Relay, RelayResult, RelayRetcode, PriceId } from "./iface";
import { ethers } from "ethers";
import { logger } from "../helpers";

import {
  PythUpgradable__factory,
  PythUpgradable,
} from "../evm/bindings/";

export class EvmRelay implements Relay {
  payerWallet: ethers.Wallet;
  p2wContract: PythUpgradable;
  async relay(signedVAAs: Array<string>): Promise<RelayResult> {
    let batchCount = signedVAAs.length;

    // Schedule all received batches in parallel
    let txs = [];
    for (let i = 0; i < signedVAAs.length; ++i) {
      let tx = await this.p2wContract
        .updatePriceBatchFromVm("0x" + signedVAAs[i], { gasLimit: 1000000 })
        .then(async (pending) => {
          try {
            let receipt = await pending.wait();
            logger.info(`Batch ${i + 1}/${batchCount} tx OK`);
            return new RelayResult(RelayRetcode.Success, [
              receipt.transactionHash,
            ]);
          } catch (e: any) {
            logger.error(
              `Batch ${i + 1}/${batchCount} tx failed: ${
                e.code
              }, failed tx hash ${e.transactionHash}`
            );
            logger.error(
              `Batch ${i + 1}/${batchCount} failure details: ${JSON.stringify(
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
    logger.warn("EvmRelay.query(): TODO(2021-03-22)");
    return new RelayResult(RelayRetcode.Fail, []);
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
  }
}
