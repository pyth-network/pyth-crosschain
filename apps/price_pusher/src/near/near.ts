/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable unicorn/no-array-reduce */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { HexString } from "@pythnetwork/hermes-client";
import { HermesClient } from "@pythnetwork/hermes-client";
import { Account, Connection, KeyPair } from "near-api-js";
import { InMemoryKeyStore } from "near-api-js/lib/key_stores";
import type {
  ExecutionStatus,
  FinalExecutionOutcome,
} from "near-api-js/lib/providers/provider";
import { ExecutionStatusBasic } from "near-api-js/lib/providers/provider";
import type { Logger } from "pino";

import type { IPricePusher, PriceInfo, PriceItem } from "../interface.js";
import { ChainPriceListener } from "../interface.js";
import type { DurationInSeconds } from "../utils.js";

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

      return priceRaw
        ? {
            conf: priceRaw.conf,
            price: priceRaw.price,
            publishTime: priceRaw.publish_time,
          }
        : undefined;
    } catch (error) {
      this.logger.error(
        error,
        `Polling on-chain price for ${priceId} failed.:`,
      );
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
    } catch (error: any) {
      this.logger.error(error, "getPriceFeedsUpdateData failed");
      return;
    }

    for (const data of priceFeedUpdateData) {
      let updateFee;
      try {
        updateFee = await this.account.getUpdateFeeEstimate(data);
        this.logger.debug(`Update fee: ${updateFee}`);
      } catch (error: any) {
        this.logger.error(error, "getUpdateFeeEstimate failed");
        continue;
      }

      try {
        const outcome = await this.account.updatePriceFeeds(data, updateFee);
        const failureMessages: (ExecutionStatus | ExecutionStatusBasic)[] = [];
        const is_success = Object.values(outcome.receipts_outcome).reduce(
          (is_success, receipt) => {
            if (
              Object.prototype.hasOwnProperty.call(
                receipt.outcome.status,
                "Failure",
              )
            ) {
              failureMessages.push(receipt.outcome.status);
              return false;
            }
            return is_success;
          },
          true,
        );
        if (is_success) {
          this.logger.info(
            { hash: outcome.transaction.hash },
            "updatePriceFeeds successful.",
          );
        } else {
          this.logger.error({ failureMessages }, "updatePriceFeeds failed");
        }
      } catch (error: any) {
        this.logger.error(error, "updatePriceFeeds failed");
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
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
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
      void keyStore.setKey(network, accountInfo.account_id, keyPair);
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
