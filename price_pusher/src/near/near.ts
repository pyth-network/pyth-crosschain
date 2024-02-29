import os from "os";
import path from "path";
import fs from "fs";

import {
  IPricePusher,
  PriceInfo,
  ChainPriceListener,
  PriceItem,
} from "../interface";
import {
  PriceServiceConnection,
  HexString,
} from "@pythnetwork/price-service-client";
import { DurationInSeconds } from "../utils";

import { Account, Connection, KeyPair } from "near-api-js";
import {
  ExecutionStatus,
  ExecutionStatusBasic,
  FinalExecutionOutcome,
} from "near-api-js/lib/providers/provider";
import { InMemoryKeyStore } from "near-api-js/lib/key_stores";

export class NearPriceListener extends ChainPriceListener {
  constructor(
    private account: NearAccount,
    priceItems: PriceItem[],
    config: {
      pollingFrequency: DurationInSeconds;
    }
  ) {
    super("near", config.pollingFrequency, priceItems);
  }

  async getOnChainPriceInfo(priceId: string): Promise<PriceInfo | undefined> {
    try {
      const priceRaw = await this.account.getPriceUnsafe(priceId);

      console.log(
        `Polled a NEAR on chain price for feed ${this.priceIdToAlias.get(
          priceId
        )} (${priceId}) ${JSON.stringify(priceRaw)}.`
      );

      if (priceRaw) {
        return {
          conf: priceRaw.conf,
          price: priceRaw.price,
          publishTime: priceRaw.publish_time,
        };
      } else {
        return undefined;
      }
    } catch (e) {
      console.error(`Polling on-chain price for ${priceId} failed. Error:`);
      console.error(e);
      return undefined;
    }
  }
}

export class NearPricePusher implements IPricePusher {
  constructor(
    private account: NearAccount,
    private connection: PriceServiceConnection
  ) {}

  async updatePriceFeed(
    priceIds: string[],
    pubTimesToPush: number[]
  ): Promise<void> {
    if (priceIds.length === 0) {
      return;
    }

    if (priceIds.length !== pubTimesToPush.length)
      throw new Error("Invalid arguments");

    let priceFeedUpdateData;
    try {
      priceFeedUpdateData = await this.getPriceFeedsUpdateData(priceIds);
    } catch (e: any) {
      console.error(new Date(), "getPriceFeedsUpdateData failed:", e);
      return;
    }

    console.log("Pushing ", priceIds);

    for (const data of priceFeedUpdateData) {
      let updateFee;
      try {
        updateFee = await this.account.getUpdateFeeEstimate(data);
        console.log(`Update fee: ${updateFee}`);
      } catch (e: any) {
        console.error(new Date(), "getUpdateFeeEstimate failed:", e);
        continue;
      }

      try {
        const outcome = await this.account.updatePriceFeeds(data, updateFee);
        const failureMessages: (ExecutionStatus | ExecutionStatusBasic)[] = [];
        const is_success = Object.values(outcome["receipts_outcome"]).reduce(
          (is_success, receipt) => {
            if (
              Object.prototype.hasOwnProperty.call(
                receipt["outcome"]["status"],
                "Failure"
              )
            ) {
              failureMessages.push(receipt["outcome"]["status"]);
              return false;
            }
            return is_success;
          },
          true
        );
        if (is_success) {
          console.log(
            new Date(),
            "updatePriceFeeds successful. Tx hash: ",
            outcome["transaction"]["hash"]
          );
        } else {
          console.error(
            new Date(),
            "updatePriceFeeds failed:",
            JSON.stringify(failureMessages, undefined, 2)
          );
        }
      } catch (e: any) {
        console.error(new Date(), "updatePriceFeeds failed:", e);
      }
    }
  }

  private async getPriceFeedsUpdateData(
    priceIds: HexString[]
  ): Promise<string[]> {
    const latestVaas = await this.connection.getLatestVaas(priceIds);
    return latestVaas.map((vaa) => Buffer.from(vaa, "base64").toString("hex"));
  }
}

export class NearAccount {
  private account: Account;

  constructor(
    network: string,
    accountId: string,
    nodeUrl: string,
    privateKeyPath: string,
    private pythAccountId: string
  ) {
    const connection = this.getConnection(
      network,
      accountId,
      nodeUrl,
      privateKeyPath
    );
    this.account = new Account(connection, accountId);
  }

  async getPriceUnsafe(priceId: string): Promise<any> {
    return await this.account.viewFunction({
      contractId: this.pythAccountId,
      methodName: "get_price_unsafe",
      args: {
        price_identifier: priceId,
      },
    });
  }

  async getUpdateFeeEstimate(data: string): Promise<any> {
    return await this.account.viewFunction({
      contractId: this.pythAccountId,
      methodName: "get_update_fee_estimate",
      args: {
        data,
      },
    });
  }

  async updatePriceFeeds(
    data: string,
    updateFee: any
  ): Promise<FinalExecutionOutcome> {
    return await this.account.functionCall({
      contractId: this.pythAccountId,
      methodName: "update_price_feeds",
      args: {
        data,
      },
      gas: "300000000000000" as any,
      attachedDeposit: updateFee,
    });
  }

  private getConnection(
    network: string,
    accountId: string,
    nodeUrl: string,
    privateKeyPath: string
  ): Connection {
    const content = fs.readFileSync(
      privateKeyPath ||
        path.join(
          os.homedir(),
          ".near-credentials",
          network,
          accountId + ".json"
        )
    );
    const accountInfo = JSON.parse(content.toString());
    let privateKey = accountInfo.private_key;
    if (!privateKey && accountInfo.secret_key) {
      privateKey = accountInfo.secret_key;
    }
    if (accountInfo.account_id && privateKey) {
      const keyPair = KeyPair.fromString(privateKey);
      const keyStore = new InMemoryKeyStore();
      keyStore.setKey(network, accountInfo.account_id, keyPair);
      return Connection.fromConfig({
        networkId: network,
        provider: { type: "JsonRpcProvider", args: { url: nodeUrl } },
        signer: { type: "InMemorySigner", keyStore },
        jsvmAccountId: `jsvm.${network}`,
      });
    } else {
      throw new Error("Invalid key file!");
    }
  }
}
