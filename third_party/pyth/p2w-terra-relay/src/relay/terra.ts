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

import { Relay, PriceId } from "./iface";

export class TerraRelay implements Relay {
  readonly nodeUrl: string = envOrErr("TERRA_NODE_URL");
  readonly terraChainId: string = envOrErr("TERRA_CHAIN_ID");
  readonly terraName: string = envOrErr("TERRA_NAME");
  readonly walletPrivateKey: string = envOrErr("TERRA_PRIVATE_KEY");
  readonly coin: string = envOrErr("TERRA_COIN");
  readonly contractAddress: string = envOrErr("TERRA_PYTH_CONTRACT_ADDRESS");
  readonly lcdConfig: LCDClientConfig;
  walletSeqNum: number = 0;
  walletAccountNum: number = 0;

  constructor() {
    this.lcdConfig = {
      URL: this.nodeUrl,
      chainID: this.terraChainId,
      // name: process.env.TERRA_NAME,
    };
    logger.info(
      "Terra connection parameters: url: [" +
        this.nodeUrl +
        "], terraChainId: [" +
        this.terraChainId +
        "], terraName: [" +
        this.terraName +
        "], coin: [" +
        this.coin +
        "], contractAddress: [" +
        this.contractAddress +
        "]"
    );
  }

  async relay(signedVAAs: Array<string>) {
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

    // logger.debug("TIME: looking up gas");
    // //Alternate FCD methodology
    // //let gasPrices = await axios.get("http://localhost:3060/v1/txs/gas_prices").then((result) => result.data);
    // const gasPrices = lcdClient.config.gasPrices;

    // logger.debug("TIME: estimating fees");
    // //const walletSequence = await wallet.sequence();
    // const feeEstimate = await lcdClient.tx.estimateFee(
    //   wallet.key.accAddress,
    //   msgs,
    //   {
    //     //TODO figure out type mismatch
    //     feeDenoms: [this.coin],
    //     gasPrices,
    //   }
    // );

    logger.debug(
      "TIME: creating transaction using seq number " +
        this.walletSeqNum +
        " and account number " +
        this.walletAccountNum
    );
    const tx = await wallet.createAndSignTx({
      sequence: this.walletSeqNum,
      accountNumber: this.walletAccountNum,
      msgs: msgs,
      memo: "P2T",
      feeDenoms: [this.coin],
    });

    this.walletSeqNum = this.walletSeqNum + 1;

    logger.debug("TIME: sending msg");
    const receipt = await lcdClient.tx.broadcastSync(tx);
    logger.debug("TIME:submitted to terra: receipt: %o", receipt);
    return receipt;
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

// TODO(2021-03-17): Propagate the use of the interface into worker/listener logic.
export type TerraConnectionData = TerraRelay;

export function connectToTerra(): TerraConnectionData {
  return new TerraRelay();
}

export async function relayTerra(
  connectionData: TerraConnectionData,
  signedVAAs: Array<string>
) {}

export async function queryTerra(
  connectionData: TerraConnectionData,
  priceIdStr: string
) {
  let query_result = await connectionData.query(priceIdStr);
  logger.debug("queryTerra: query returned: %o", query_result);
  return query_result;
}

export async function queryBalanceOnTerra(connectionData: TerraConnectionData) {
  return (await connectionData.getPayerInfo()).balance;
}

export async function setAccountNumOnTerra(
  connectionData: TerraConnectionData
) {
  const lcdClient = new LCDClient(connectionData.lcdConfig);

  const mk = new MnemonicKey({
    mnemonic: process.env.TERRA_PRIVATE_KEY,
  });

  const wallet = lcdClient.wallet(mk);
  logger.debug("getting wallet account num");
  connectionData.walletAccountNum = await wallet.accountNumber();
  logger.debug("wallet account num is " + connectionData.walletAccountNum);
}

export async function setSeqNumOnTerra(connectionData: TerraConnectionData) {
  const lcdClient = new LCDClient(connectionData.lcdConfig);

  const mk = new MnemonicKey({
    mnemonic: process.env.TERRA_PRIVATE_KEY,
  });

  const wallet = lcdClient.wallet(mk);

  logger.debug("getting wallet seq num");
  connectionData.walletSeqNum = await wallet.sequence();
  logger.debug("wallet seq num is " + connectionData.walletSeqNum);
}
