import {
  IPricePusher,
  PriceInfo,
  ChainPriceListener,
  PriceItem,
} from "../interface";
import {
  addLeading0x,
  assertDefined,
  DurationInSeconds,
  removeLeading0x,
} from "../utils";
import { PythAbi } from "./pyth-abi";
import { Logger } from "pino";
import {
  HermesClient,
  HexString,
  UnixTimestamp,
} from "@pythnetwork/hermes-client";
import { CustomGasStation } from "./custom-gas-station";
import { PushAttempt } from "../common";
import {
  WatchContractEventOnLogsParameter,
  TransactionExecutionError,
  BaseError,
  ContractFunctionRevertedError,
  FeeCapTooLowError,
  InternalRpcError,
  InsufficientFundsError,
  ContractFunctionExecutionError,
} from "viem";

import { PythContract } from "./pyth-contract";
import { SuperWalletClient } from "./super-wallet";

export class EvmPriceListener extends ChainPriceListener {
  constructor(
    private pythContract: PythContract,
    priceItems: PriceItem[],
    private watchEvents: boolean,
    private logger: Logger,
    config: {
      pollingFrequency: DurationInSeconds;
    },
  ) {
    super(config.pollingFrequency, priceItems);

    this.pythContract = pythContract;
    this.logger = logger;
  }

  // This method should be awaited on and once it finishes it has the latest value
  // for the given price feeds (if they exist).
  async start() {
    if (this.watchEvents) {
      this.logger.info("Watching target network pyth contract events...");
      this.startWatching();
    } else {
      this.logger.info(
        "The target network RPC endpoint is not Websocket. " +
          "Listening for updates only via polling....",
      );
    }

    // base class for polling
    await super.start();
  }

  private async startWatching() {
    this.pythContract.watchEvent.PriceFeedUpdate(
      { id: this.priceItems.map((item) => addLeading0x(item.id)) },
      { strict: true, onLogs: this.onPriceFeedUpdate.bind(this) },
    );
  }

  private onPriceFeedUpdate(
    logs: WatchContractEventOnLogsParameter<typeof PythAbi, "PriceFeedUpdate">,
  ) {
    for (const log of logs) {
      const priceId = removeLeading0x(assertDefined(log.args.id));

      const priceInfo: PriceInfo = {
        conf: assertDefined(log.args.conf).toString(),
        price: assertDefined(log.args.price).toString(),
        publishTime: Number(assertDefined(log.args.publishTime)),
      };

      this.logger.debug(
        { priceInfo },
        `Received a new Evm PriceFeedUpdate event for price feed ${this.priceIdToAlias.get(
          priceId,
        )} (${priceId}).`,
      );

      this.updateLatestPriceInfo(priceId, priceInfo);
    }
  }

  async getOnChainPriceInfo(
    priceId: HexString,
  ): Promise<PriceInfo | undefined> {
    let priceRaw: any;
    try {
      priceRaw = await this.pythContract.read.getPriceUnsafe([
        addLeading0x(priceId),
      ]);
    } catch (err) {
      this.logger.error(err, `Polling on-chain price for ${priceId} failed.`);
      return undefined;
    }

    this.logger.debug(
      `Polled an EVM on chain price for feed ${this.priceIdToAlias.get(
        priceId,
      )} (${priceId}).`,
    );

    return {
      conf: priceRaw.conf,
      price: priceRaw.price,
      publishTime: Number(priceRaw.publishTime),
    };
  }
}

export class EvmPricePusher implements IPricePusher {
  private pusherAddress: `0x${string}` | undefined;
  private lastPushAttempt: PushAttempt | undefined;

  constructor(
    private hermesClient: HermesClient,
    private client: SuperWalletClient,
    private pythContract: PythContract,
    private logger: Logger,
    private overrideGasPriceMultiplier: number,
    private overrideGasPriceMultiplierCap: number,
    private updateFeeMultiplier: number,
    private gasLimit?: number,
    private customGasStation?: CustomGasStation,
    private gasPrice?: number,
  ) {}

  // The pubTimes are passed here to use the values that triggered the push.
  // This is an optimization to avoid getting a newer value (as an update comes)
  // and will help multiple price pushers to have consistent behaviour.
  // To ensure that we transactions are landing and we are not pushing the prices twice
  // we will re-use the same nonce (with a higher gas price) if the previous transaction
  // is not landed yet.
  async updatePriceFeed(
    priceIds: string[],
    pubTimesToPush: UnixTimestamp[],
  ): Promise<void> {
    if (priceIds.length === 0) {
      return;
    }

    if (priceIds.length !== pubTimesToPush.length)
      throw new Error("Invalid arguments");

    const priceFeedUpdateData = (await this.getPriceFeedsUpdateData(
      priceIds,
    )) as `0x${string}`[];

    const priceFeedUpdateDataWith0x = priceFeedUpdateData.map((data) =>
      addLeading0x(data),
    );

    let updateFee;

    try {
      updateFee = await this.pythContract.read.getUpdateFee([
        priceFeedUpdateDataWith0x,
      ]);
      updateFee = BigInt(
        Math.round(Number(updateFee) * (this.updateFeeMultiplier || 1)),
      );
      this.logger.debug(`Update fee: ${updateFee}`);
    } catch (e: any) {
      this.logger.error(
        e,
        "An unidentified error has occured when getting the update fee.",
      );
      throw e;
    }

    // Gas price in networks with transaction type eip1559 represents the
    // addition of baseFee and priorityFee required to land the transaction. We
    // are using this to remain compatible with the networks that doesn't
    // support this transaction type.
    let gasPrice =
      this.gasPrice ??
      Number(
        await (this.customGasStation?.getCustomGasPrice() ??
          this.client.getGasPrice()),
      );

    // Try to re-use the same nonce and increase the gas if the last tx is not landed yet.
    if (this.pusherAddress === undefined) {
      this.pusherAddress = this.client.account.address;
    }

    const lastExecutedNonce =
      (await this.client.getTransactionCount({
        address: this.pusherAddress,
      })) - 1;

    let gasPriceToOverride = undefined;

    if (this.lastPushAttempt !== undefined) {
      if (this.lastPushAttempt.nonce <= lastExecutedNonce) {
        this.lastPushAttempt = undefined;
      } else {
        gasPriceToOverride =
          this.lastPushAttempt.gasPrice * this.overrideGasPriceMultiplier;
      }
    }

    if (
      gasPriceToOverride !== undefined &&
      gasPriceToOverride > Number(gasPrice)
    ) {
      gasPrice = Math.min(
        gasPriceToOverride,
        gasPrice * this.overrideGasPriceMultiplierCap,
      );
    }

    const txNonce = lastExecutedNonce + 1;

    this.logger.debug(`Using gas price: ${gasPrice} and nonce: ${txNonce}`);

    const pubTimesToPushParam = pubTimesToPush.map((pubTime) =>
      BigInt(pubTime),
    );

    const priceIdsWith0x = priceIds.map((priceId) => addLeading0x(priceId));

    // Update lastAttempt
    this.lastPushAttempt = {
      nonce: txNonce,
      gasPrice: gasPrice,
    };

    try {
      const { request } =
        await this.pythContract.simulate.updatePriceFeedsIfNecessary(
          [priceFeedUpdateDataWith0x, priceIdsWith0x, pubTimesToPushParam],
          {
            value: updateFee,
            gasPrice: BigInt(Math.ceil(gasPrice)),
            nonce: txNonce,
            gas:
              this.gasLimit !== undefined
                ? BigInt(Math.ceil(this.gasLimit))
                : undefined,
          },
        );

      this.logger.debug({ request }, "Simulated request successfully");

      const hash = await this.client.writeContract(request);

      this.logger.info({ hash }, "Price update sent");

      this.waitForTransactionReceipt(hash);
    } catch (err: any) {
      this.logger.debug({ err }, "Simulating or sending transactions failed.");

      if (err instanceof BaseError) {
        if (
          err.walk(
            (e) =>
              e instanceof ContractFunctionRevertedError &&
              e.data?.errorName === "NoFreshUpdate",
          )
        ) {
          this.logger.info(
            "Simulation reverted because none of the updates are fresh. This is an expected behaviour to save gas. Skipping this push.",
          );
          return;
        }

        if (err.walk((e) => e instanceof InsufficientFundsError)) {
          this.logger.error(
            { err },
            "Wallet doesn't have enough balance. In rare cases, there might be issues with gas price " +
              "calculation in the RPC.",
          );
          throw err;
        }

        if (
          err.walk((e) => e instanceof FeeCapTooLowError) ||
          err.walk(
            (e) =>
              e instanceof InternalRpcError &&
              e.details.includes("replacement transaction underpriced"),
          )
        ) {
          this.logger.warn(
            "The gas price of the transaction is too low or there is an existing transaction with higher gas with the same nonce. " +
              "The price will be increased in the next push. Skipping this push. " +
              "If this keeps happening or transactions are not landing you need to increase the override gas price " +
              "multiplier and the cap to increase the likelihood of the transaction landing on-chain.",
          );
          return;
        }

        if (
          err.walk(
            (e) =>
              e instanceof TransactionExecutionError &&
              (e.details.includes("nonce too low") ||
                e.message.includes("Nonce provided for the transaction")),
          )
        ) {
          this.logger.info(
            "The nonce is incorrect. This is an expected behaviour in high frequency or multi-instance setup. Skipping this push.",
          );
          return;
        }

        // Sometimes the contract function execution fails in simulation and this error is thrown.
        if (err.walk((e) => e instanceof ContractFunctionExecutionError)) {
          this.logger.warn(
            { err },
            "The contract function execution failed in simulation. This is an expected behaviour in high frequency or multi-instance setup. " +
              "Please review this error and file an issue if it is a bug. Skipping this push.",
          );
          return;
        }

        // We normally crash on unknown failures but we believe that this type of error is safe to skip. The other reason is that
        // wometimes we see a TransactionExecutionError because of the nonce without any details and it is not catchable.
        if (err.walk((e) => e instanceof TransactionExecutionError)) {
          this.logger.error(
            { err },
            "Transaction execution failed. This is an expected behaviour in high frequency or multi-instance setup. " +
              "Please review this error and file an issue if it is a bug. Skipping this push.",
          );
          return;
        }

        // The following errors are part of the legacy code and might not work as expected.
        // We are keeping them in case they help with handling what is not covered above.
        if (
          err.message.includes("the tx doesn't have the correct nonce.") ||
          err.message.includes("nonce too low") ||
          err.message.includes("invalid nonce")
        ) {
          this.logger.info(
            "The nonce is incorrect (are multiple users using this account?). Skipping this push.",
          );
          return;
        }

        if (err.message.includes("max fee per gas less than block base fee")) {
          // We just have to handle this error and return.
          // LastPushAttempt was stored with the class
          // Next time the update will be executing, it will check the last attempt
          // and increase the gas price accordingly.
          this.logger.warn(
            "The transaction failed with error: max fee per gas less than block base fee. " +
              "The fee will be increased in the next push. Skipping this push.",
          );
          return;
        }

        if (
          err.message.includes("sender doesn't have enough funds to send tx.")
        ) {
          this.logger.error("Payer is out of balance, please top it up.");
          throw new Error("Please top up the wallet");
        }

        if (err.message.includes("could not replace existing tx")) {
          this.logger.error(
            "A transaction with the same nonce has been mined and this one is no longer needed. Skipping this push.",
          );
          return;
        }
      }

      // If the error is not handled, we will crash the process.
      this.logger.error(
        { err },
        "The transaction failed with an unhandled error. crashing the process. " +
          "Please review this error and file an issue if it is a bug.",
      );
      throw err;
    }
  }

  private async waitForTransactionReceipt(hash: `0x${string}`): Promise<void> {
    try {
      const receipt = await this.client.waitForTransactionReceipt({
        hash: hash,
      });

      switch (receipt.status) {
        case "success":
          this.logger.debug({ hash, receipt }, "Price update successful");
          this.logger.info({ hash }, "Price update successful");
          break;
        default:
          this.logger.info(
            { hash, receipt },
            "Price update did not succeed or its transaction did not land. " +
              "This is an expected behaviour in high frequency or multi-instance setup.",
          );
      }
    } catch (err: any) {
      this.logger.warn({ err }, "Failed to get transaction receipt");
    }
  }

  private async getPriceFeedsUpdateData(
    priceIds: HexString[],
  ): Promise<string[]> {
    const response = await this.hermesClient.getLatestPriceUpdates(priceIds, {
      encoding: "hex",
      ignoreInvalidPriceIds: true,
    });
    return response.binary.data;
  }
}
