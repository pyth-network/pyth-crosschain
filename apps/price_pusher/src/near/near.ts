import os from "os";
import path from "path";
import fs from "fs";

import {
  IPricePusher,
  PriceInfo,
  ChainPriceListener,
  PriceItem,
} from "../interface";
import { HermesClient, HexString } from "@pythnetwork/hermes-client";
import { DurationInSeconds } from "../utils";

import { Account, Connection, KeyPair } from "near-api-js";
import {
  ExecutionStatus,
  ExecutionStatusBasic,
  FinalExecutionOutcome,
} from "near-api-js/lib/providers/provider";
import { InMemoryKeyStore } from "near-api-js/lib/key_stores";
import { Logger } from "pino";

export class NearPriceListener extends ChainPriceListener {
  constructor(
    private account: NearAccount,
    priceItems: PriceItem[],
    private logger: Logger,
    config: {
      pollingFrequency: DurationInSeconds;
    },
  ) {
    super(config.pollingFrequency, priceItems);
  }

  async getOnChainPriceInfo(priceId: string): Promise<PriceInfo | undefined> {
    try {
      const priceRaw = await this.account.getPriceUnsafe(priceId);

      this.logger.debug(
        `Polled a NEAR on chain price for feed ${this.priceIdToAlias.get(
          priceId,
        )} (${priceId}) ${JSON.stringify(priceRaw)}.`,
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
    } catch (err) {
      this.logger.error(err, `Polling on-chain price for ${priceId} failed.:`);
      return undefined;
    }
  }
}

export class NearPricePusher implements IPricePusher {
  constructor(
    private account: NearAccount,
    private hermesClient: HermesClient,
    private logger: Logger,
  ) {}

  async updatePriceFeed(
    priceIds: string[],
    pubTimesToPush: number[],
  ): Promise<void> {
    if (priceIds.length === 0) {
      return;
    }

    if (priceIds.length !== pubTimesToPush.length)
      throw new Error("Invalid arguments");

    let priceFeedUpdateData;
    try {
      priceFeedUpdateData = await this.getPriceFeedsUpdateData(priceIds);
    } catch (err: any) {
      this.logger.error(err, "getPriceFeedsUpdateData failed");
      return;
    }

    for (const data of priceFeedUpdateData) {
      let updateFee;
      try {
        updateFee = await this.account.getUpdateFeeEstimate(data);
        this.logger.debug(`Update fee: ${updateFee}`);
      } catch (err: any) {
        this.logger.error(err, "getUpdateFeeEstimate failed");
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
                "Failure",
              )
            ) {
              failureMessages.push(receipt["outcome"]["status"]);
              return false;
            }
            return is_success;
          },
          true,
        );
        if (is_success) {
          this.logger.info(
            { hash: outcome["transaction"]["hash"] },
            "updatePriceFeeds successful.",
          );
        } else {
          this.logger.error({ failureMessages }, "updatePriceFeeds failed");
        }
      } catch (err: any) {
        this.logger.error(err, "updatePriceFeeds failed");
      }
    }
  }

  private async getPriceFeedsUpdateData(
    priceIds: HexString[],
  ): Promise<string[]> {
    const response = await this.hermesClient.getLatestPriceUpdates(priceIds, {
      encoding: "base64",
      ignoreInvalidPriceIds: true,
    });
    return response.binary.data;
  }
}

export class NearAccount {
  private account: Account;

  constructor(
    network: string,
    accountId: string,
    nodeUrl: string,
    privateKeyPath: string | undefined,
    private pythAccountId: string,
  ) {
    const connection = this.getConnection(
      network,
      accountId,
      nodeUrl,
      privateKeyPath,
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
    updateFee: any,
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
    privateKeyPath: string | undefined,
  ): Connection {
    const content = fs.readFileSync(
      privateKeyPath ||
        path.join(
          os.homedir(),
          ".near-credentials",
          network,
          accountId + ".json",
        ),
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
