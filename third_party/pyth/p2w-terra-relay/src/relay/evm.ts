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
    logger.warn("EvmRelay.relay(): TODO(2021-03-22)");
    return new RelayResult(RelayRetcode.Fail, []);
  }
  async query(priceId: PriceId): Promise<any> {
    logger.warn("EvmRelay.relay(): TODO(2021-03-22)");
    return new RelayResult(RelayRetcode.Fail, []);
  }
  async getPayerInfo(): Promise<{ address: string; balance: bigint }> {
    return {
      address: this.payerWallet.address,
      balance: BigInt(`$(await this.payerWallet.getBalance())`),
    };
  }

  constructor(cfg: {
    rpcWsUrl: string;
    payerWalletMnemonic: string;
    payerWalletHDPath: string;
    p2wContractAddress: string;
  }) {
    let provider = new ethers.providers.WebSocketProvider(cfg.rpcWsUrl);
    let wallet = ethers.Wallet.fromMnemonic(
      cfg.payerWalletMnemonic,
      cfg.payerWalletHDPath
    );

    this.payerWallet = new ethers.Wallet(wallet.privateKey, provider);
    let factory = new PythUpgradable__factory(this.payerWallet);
    this.p2wContract = factory.attach(cfg.p2wContractAddress);
  }
}
