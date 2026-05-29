/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/require-await */
import type {
  HermesClient,
  HexString,
  UnixTimestamp,
} from "@pythnetwork/hermes-client";
import type { Logger } from "pino";
import type { WatchContractEventOnLogsParameter } from "viem";
import {
  BaseError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  FeeCapTooLowError,
  InsufficientFundsError,
  InternalRpcError,
  TransactionExecutionError,
} from "viem";

import type { GasParams, PushAttempt } from "../common.js";
import type { IPricePusher, PriceInfo, PriceItem } from "../interface.js";
import { ChainPriceListener } from "../interface.js";
import type { DurationInSeconds } from "../utils.js";
import { addLeading0x, assertDefined, removeLeading0x } from "../utils.js";
import type { CustomGasStation } from "./custom-gas-station";
import type { PythAbi } from "./pyth-abi.js";
import type { PythContract } from "./pyth-contract.js";
import type { SuperWalletClient } from "./super-wallet.js";

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
  override async start() {
    if (this.watchEvents) {
      this.logger.info("Watching target network pyth contract events...");
      void this.startWatching();
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
      { onLogs: this.onPriceFeedUpdate.bind(this), strict: true },
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
    } catch (error) {
      this.logger.error(error, `Polling on-chain price for ${priceId} failed.`);
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
    private legacy: boolean,
    private gasLimit?: number,
    private customGasStation?: CustomGasStation,
    private gasPriceOverride?: number,
  ) {}

  private async getGasParams(): Promise<GasParams> {
    if (this.customGasStation) {
      const custom = await this.customGasStation.getCustomGasPrice();
      if (custom) {
        if ("gasPrice" in custom) {
          return { type: "legacy", gasPrice: Number(custom.gasPrice) };
        }
        return {
          type: "eip1559",
          maxFeePerGas: Number(custom.maxFeePerGas),
          maxPriorityFeePerGas: Number(custom.maxPriorityFeePerGas),
        };
      }
    }

    if (this.legacy) {
      const gasPrice = await this.client.getGasPrice();
      return { type: "legacy", gasPrice: Number(gasPrice) };
    }

    const fees = await this.client.estimateFeesPerGas();
    return {
      type: "eip1559",
      maxFeePerGas: Number(fees.maxFeePerGas),
      maxPriorityFeePerGas: Number(fees.maxPriorityFeePerGas),
    };
  }

  private applyStaticOverride(gas: GasParams): GasParams {
    if (this.gasPriceOverride === undefined) return gas;

    if (gas.type === "legacy") {
      return { type: "legacy", gasPrice: this.gasPriceOverride };
    }

    // In EIP-1559 mode, use the override as maxFeePerGas and keep fetched priority fee
    return {
      type: "eip1559",
      maxFeePerGas: this.gasPriceOverride,
      maxPriorityFeePerGas: gas.maxPriorityFeePerGas,
    };
  }

  private escalateGas(gas: GasParams, multiplier: number): GasParams {
    if (gas.type === "legacy") {
      return { type: "legacy", gasPrice: gas.gasPrice * multiplier };
    }
    return {
      type: "eip1559",
      maxFeePerGas: gas.maxFeePerGas * multiplier,
      maxPriorityFeePerGas: gas.maxPriorityFeePerGas * multiplier,
    };
  }

  private capGas(escalated: GasParams, base: GasParams): GasParams {
    if (escalated.type === "legacy" && base.type === "legacy") {
      return {
        type: "legacy",
        gasPrice: Math.min(
          escalated.gasPrice,
          base.gasPrice * this.overrideGasPriceMultiplierCap,
        ),
      };
    }
    if (escalated.type === "eip1559" && base.type === "eip1559") {
      return {
        type: "eip1559",
        maxFeePerGas: Math.min(
          escalated.maxFeePerGas,
          base.maxFeePerGas * this.overrideGasPriceMultiplierCap,
        ),
        maxPriorityFeePerGas: Math.min(
          escalated.maxPriorityFeePerGas,
          base.maxPriorityFeePerGas * this.overrideGasPriceMultiplierCap,
        ),
      };
    }
    // Mismatched types shouldn't happen, return escalated as-is
    return escalated;
  }

  private gasIsHigherThan(a: GasParams, b: GasParams): boolean {
    if (a.type === "legacy" && b.type === "legacy") {
      return a.gasPrice > b.gasPrice;
    }
    if (a.type === "eip1559" && b.type === "eip1559") {
      return a.maxFeePerGas > b.maxFeePerGas;
    }
    return false;
  }

  private gasToTxParams(
    gas: GasParams,
  ):
    | { gasPrice: bigint }
    | { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } {
    if (gas.type === "legacy") {
      return { gasPrice: BigInt(Math.ceil(gas.gasPrice)) };
    }
    return {
      maxFeePerGas: BigInt(Math.ceil(gas.maxFeePerGas)),
      maxPriorityFeePerGas: BigInt(Math.ceil(gas.maxPriorityFeePerGas)),
    };
  }

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
    } catch (error: any) {
      this.logger.error(
        error,
        "An unidentified error has occured when getting the update fee.",
      );
      throw error;
    }

    let gas = this.applyStaticOverride(await this.getGasParams());

    // Try to re-use the same nonce and increase the gas if the last tx is not landed yet.
    this.pusherAddress ??= this.client.account.address;

    const lastExecutedNonce =
      (await this.client.getTransactionCount({
        address: this.pusherAddress,
      })) - 1;

    if (this.lastPushAttempt !== undefined) {
      if (this.lastPushAttempt.nonce <= lastExecutedNonce) {
        this.lastPushAttempt = undefined;
      } else {
        const escalated = this.escalateGas(
          this.lastPushAttempt.gas,
          this.overrideGasPriceMultiplier,
        );
        if (this.gasIsHigherThan(escalated, gas)) {
          gas = this.capGas(escalated, gas);
        }
      }
    }

    const txNonce = lastExecutedNonce + 1;

    const gasLogInfo =
      gas.type === "eip1559"
        ? `maxFeePerGas: ${gas.maxFeePerGas}, maxPriorityFeePerGas: ${gas.maxPriorityFeePerGas}`
        : `gasPrice: ${gas.gasPrice}`;
    this.logger.debug(`Using ${gasLogInfo} and nonce: ${txNonce}`);

    const pubTimesToPushParam = pubTimesToPush.map(BigInt);

    const priceIdsWith0x = priceIds.map((priceId) => addLeading0x(priceId));

    // Update lastAttempt
    this.lastPushAttempt = {
      gas,
      nonce: txNonce,
    };

    try {
      const { request } =
        await this.pythContract.simulate.updatePriceFeedsIfNecessary(
          [priceFeedUpdateDataWith0x, priceIdsWith0x, pubTimesToPushParam],
          {
            gas:
              this.gasLimit === undefined
                ? undefined
                : BigInt(Math.ceil(this.gasLimit)),
            ...this.gasToTxParams(gas),
            nonce: txNonce,
            value: updateFee,
          },
        );

      this.logger.debug({ request }, "Simulated request successfully");

      const hash = await this.client.writeContract(request);

      this.logger.info({ hash }, "Price update sent");

      void this.waitForTransactionReceipt(hash);
    } catch (error: any) {
      this.logger.debug(
        { err: error },
        "Simulating or sending transactions failed.",
      );

      if (error instanceof BaseError) {
        if (
          error.walk(
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

        if (error.walk((e) => e instanceof InsufficientFundsError)) {
          this.logger.error(
            { err: error },
            "Wallet doesn't have enough balance. In rare cases, there might be issues with gas price " +
              "calculation in the RPC.",
          );
          throw error;
        }

        if (
          error.walk((e) => e instanceof FeeCapTooLowError) ||
          error.walk(
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
          error.walk(
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
        if (error.walk((e) => e instanceof ContractFunctionExecutionError)) {
          this.logger.warn(
            { err: error },
            "The contract function execution failed in simulation. This is an expected behaviour in high frequency or multi-instance setup. " +
              "Please review this error and file an issue if it is a bug. Skipping this push.",
          );
          return;
        }

        // We normally crash on unknown failures but we believe that this type of error is safe to skip. The other reason is that
        // wometimes we see a TransactionExecutionError because of the nonce without any details and it is not catchable.
        if (error.walk((e) => e instanceof TransactionExecutionError)) {
          this.logger.error(
            { err: error },
            "Transaction execution failed. This is an expected behaviour in high frequency or multi-instance setup. " +
              "Please review this error and file an issue if it is a bug. Skipping this push.",
          );
          return;
        }

        // The following errors are part of the legacy code and might not work as expected.
        // We are keeping them in case they help with handling what is not covered above.
        if (
          error.message.includes("the tx doesn't have the correct nonce.") ||
          error.message.includes("nonce too low") ||
          error.message.includes("invalid nonce")
        ) {
          this.logger.info(
            "The nonce is incorrect (are multiple users using this account?). Skipping this push.",
          );
          return;
        }

        if (
          error.message.includes("max fee per gas less than block base fee")
        ) {
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
          error.message.includes("sender doesn't have enough funds to send tx.")
        ) {
          this.logger.error("Payer is out of balance, please top it up.");
          throw new Error("Please top up the wallet");
        }

        if (error.message.includes("could not replace existing tx")) {
          this.logger.error(
            "A transaction with the same nonce has been mined and this one is no longer needed. Skipping this push.",
          );
          return;
        }
      }

      // If the error is not handled, we will crash the process.
      this.logger.error(
        { err: error },
        "The transaction failed with an unhandled error. crashing the process. " +
          "Please review this error and file an issue if it is a bug.",
      );
      throw error;
    }
  }

  private async waitForTransactionReceipt(hash: `0x${string}`): Promise<void> {
    try {
      const receipt = await this.client.waitForTransactionReceipt({
        hash: hash,
      });

      switch (receipt.status) {
        case "success": {
          this.logger.debug({ hash, receipt }, "Price update successful");
          this.logger.info({ hash }, "Price update successful");
          break;
        }
        default: {
          this.logger.info(
            { hash, receipt },
            "Price update did not succeed or its transaction did not land. " +
              "This is an expected behaviour in high frequency or multi-instance setup.",
          );
        }
      }
    } catch (error: any) {
      this.logger.warn({ err: error }, "Failed to get transaction receipt");
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
