import { fromUint8Array } from "js-base64";
import {
  LCDClient,
  LCDClientConfig,
  MnemonicKey,
  MsgExecuteContract,
} from "@terra-money/terra.js";
import { hexToUint8Array } from "@certusone/wormhole-sdk";
import { redeemOnTerra } from "@certusone/wormhole-sdk";

import { logger, envOrErr } from "../helpers";

import { Relay, RelayResult, RelayRetcode, PriceId } from "./iface";

export class TerraRelay implements Relay {
  readonly nodeUrl: string;
  readonly terraChainId: string;
  readonly walletPrivateKey: string;
  readonly coin: string;
  readonly contractAddress: string;
  readonly lcdConfig: LCDClientConfig;
  walletSeqNum: number = 0;
  walletAccountNum: number = 0;

  constructor(cfg: {
    nodeUrl: string;
    terraChainId: string;
    walletPrivateKey: string;
    coin: string;
    contractAddress: string;
  }) {
    this.nodeUrl = cfg.nodeUrl;
    this.terraChainId = cfg.terraChainId;
    this.walletPrivateKey = cfg.walletPrivateKey;
    this.coin = cfg.coin;
    this.contractAddress = cfg.contractAddress;

    this.lcdConfig = {
      URL: this.nodeUrl,
      chainID: this.terraChainId,
    };
    logger.info(
      "Terra connection parameters: url: [" +
        this.nodeUrl +
        "], terraChainId: [" +
        this.terraChainId +
        "], coin: [" +
        this.coin +
        "], contractAddress: [" +
        this.contractAddress +
        "]"
    );
  }

  async relay(signedVAAs: Array<string>) {
    let terraRes;
    try {
      logger.debug("relaying " + signedVAAs.length + " messages to terra");

      logger.debug("TIME: connecting to terra");
      const lcdClient = new LCDClient(this.lcdConfig);

      const mk = new MnemonicKey({
        mnemonic: this.walletPrivateKey,
      });

      const wallet = lcdClient.wallet(mk);

      logger.debug("TIME: creating messages");
      let msgs = new Array<MsgExecuteContract>();
      for (let idx = 0; idx < signedVAAs.length; ++idx) {
        const msg = new MsgExecuteContract(
          wallet.key.accAddress,
          this.contractAddress,
          {
            submit_vaa: {
              data: Buffer.from(signedVAAs[idx], "hex").toString("base64"),
            },
          }
        );

        msgs.push(msg);
      }

      const tx = await wallet.createAndSignTx({
        sequence: await wallet.sequence(),
        accountNumber: await wallet.accountNumber(),
        msgs: msgs,
        memo: "P2T",
        feeDenoms: [this.coin],
      });

      this.walletSeqNum = this.walletSeqNum + 1;

      logger.debug("TIME: sending msg");
      terraRes = await lcdClient.tx.broadcastSync(tx);
      logger.debug(
        `TIME:submitted to terra: terraRes: ${JSON.stringify(terraRes)}`
      );
      // Act on known Terra errors

      if (terraRes.raw_log) {
        if (terraRes.raw_log.search("VaaAlreadyExecuted") >= 0) {
          logger.error(
            "Already Executed:",
            terraRes.txhash
              ? terraRes.txhash
              : "<INTERNAL: no txhash for AlreadyExecuted>"
          );
          return new RelayResult(RelayRetcode.AlreadyExecuted, null);
        } else if (terraRes.raw_log.search("insufficient funds") >= 0) {
          logger.error(
            "relay failed due to insufficient funds: ",
            JSON.stringify(terraRes)
          );
          return new RelayResult(RelayRetcode.InsufficientFunds, null);
        } else if (terraRes.raw_log.search("failed") >= 0) {
          logger.error(
            "relay seems to have failed: ",
            JSON.stringify(terraRes)
          );
          return new RelayResult(RelayRetcode.Fail, null);
        }
      } else {
        logger.warn("No logs were found, result: ", JSON.stringify(terraRes));
      }

      // Base case, no errors were detected and no exceptions were thrown
      if (terraRes.txhash) {
        return new RelayResult(RelayRetcode.Success, terraRes.txhash);
      }
    } catch (e: any) {
      // Act on known Terra exceptions
      if (
        e.message &&
        e.message.search("timeout") >= 0 &&
        e.message.search("exceeded") >= 0
      ) {
        logger.error("relay timed out: %o", e);
        return new RelayResult(RelayRetcode.Timeout, null);
      } else if (
        e.response?.data?.error &&
        e.response.data.error.search("VaaAlreadyExecuted") >= 0
      ) {
        return new RelayResult(RelayRetcode.AlreadyExecuted, null);
      } else if (
        e.response?.data?.message &&
        e.response.data.message.search("account sequence mismatch") >= 0
      ) {
        return new RelayResult(RelayRetcode.SeqNumMismatch, null);
      } else {
        logger.error("Unknown error:", e.toString());
        return new RelayResult(RelayRetcode.Fail, null);
      }
    }

    logger.error("INTERNAL: Terra relay() logic failed to produce a result");
    return new RelayResult(RelayRetcode.Fail, null);
  }

  async query(priceId: PriceId) {
    const encodedPriceId = fromUint8Array(hexToUint8Array(priceId));

    logger.info(
      "Querying terra for price info for priceId [" +
        priceId +
        "], encoded as [" +
        encodedPriceId +
        "]"
    );

    const lcdClient = new LCDClient(this.lcdConfig);

    const mk = new MnemonicKey({
      mnemonic: this.walletPrivateKey,
    });

    const wallet = lcdClient.wallet(mk);

    const query_result = await lcdClient.wasm.contractQuery(
      this.contractAddress,
      {
        price_info: {
          price_id: encodedPriceId,
        },
      }
    );
  }

  async getPayerInfo(): Promise<{ address: string; balance: number }> {
    const lcdClient = new LCDClient(this.lcdConfig);

    const mk = new MnemonicKey({
      mnemonic: this.walletPrivateKey,
    });

    const wallet = lcdClient.wallet(mk);

    let balance: number = NaN;
    try {
      logger.debug("querying wallet balance");
      let coins: any;
      let pagnation: any;
      [coins, pagnation] = await lcdClient.bank.balance(wallet.key.accAddress);
      logger.debug("wallet query returned: %o", coins);
      if (coins) {
        let coin = coins.get(this.coin);
        if (coin) {
          balance = parseInt(coin.toData().amount);
        } else {
          logger.error(
            "failed to query coin balance, coin [" +
              this.coin +
              "] is not in the wallet, coins: %o",
            coins
          );
        }
      } else {
        logger.error("failed to query coin balance!");
      }
    } catch (e) {
      logger.error("failed to query coin balance: %o", e);
    }

    return { address: wallet.key.accAddress, balance };
  }
}
