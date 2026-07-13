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
  TransactionExecutionError,
} from "viem";

import type { IPricePusher, PriceInfo, PriceItem } from "../interface.js";
import { ChainPriceListener } from "../interface.js";
import type { DurationInSeconds } from "../utils.js";
import { addLeading0x, assertDefined, removeLeading0x } from "../utils.js";
import type { GasPrice, GasPriceConfig } from "./gas-price.js";
import {
  describeGasPrice,
  escalateGasPrice,
  gasPriceToTxParams,
  getGasPrice,
  scaleGasPrice,
} from "./gas-price.js";
import type { PythAbi } from "./pyth-abi.js";
import type { PythContract } from "./pyth-contract.js";
import type { SuperWalletClient } from "./super-wallet.js";

type PushAttempt = {
  nonce: number;
  gasPrice: GasPrice;
};

// Some RPC providers surface the same underlying failure through different viem
// error classes. For example "replacement transaction underpriced" comes back as
// an `InternalRpcError` (code -32000) on most chains, but Soneium/Alchemy returns
// it as an `InvalidInputRpcError` (code -32602, "Missing or invalid parameters").
// Matching on the error text across the whole cause chain (rather than on a
// specific class) keeps the detection robust across providers.
const errorChainIncludes = (error: BaseError, needle: string): boolean =>
  error.walk(
    (e) =>
      (e instanceof BaseError && e.details.includes(needle)) ||
      (e instanceof Error && e.message.includes(needle)),
  ) !== null;

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
  // Bounded, per-nonce receipt trackers. Each poll self-terminates on landing or
  // at `receiptWaitTimeoutMs`. Same-nonce gas escalations ADD a tracker rather
  // than replacing the previous one: the original and the repriced tx compete
  // for the nonce and EITHER can land (a miner may include the old tx over the
  // replacement), so all competing hashes stay watched and whichever lands is
  // logged. A nonce advance means the previous nonce already resolved, so its
  // now-doomed stragglers are aborted. This replaces viem's
  // `waitForTransactionReceipt`, whose timeout (on the pinned version) rejects
  // without tearing down its internal `eth_getTransactionByHash` / block-number
  // poll — so a fire-and-forget wait for a tx that never becomes findable leaked
  // a detached poller that ran for the pod's whole lifetime, one per push. Here
  // the count is bounded: at most one nonce is tracked at a time, and each of
  // its trackers self-terminates at the deadline.
  private receiptTrackers = new Set<AbortController>();
  private trackedNonce: number | undefined;

  constructor(
    private hermesClient: HermesClient,
    private client: SuperWalletClient,
    private pythContract: PythContract,
    private logger: Logger,
    private overrideGasPriceMultiplier: number,
    private overrideGasPriceMultiplierCap: number,
    private updateFeeMultiplier: number,
    private gasPriceConfig: GasPriceConfig,
    private gasLimit?: number,
    // Upper bound on how long to poll for a tx receipt before giving up. Keeps a
    // tx that never lands from polling forever. Defaults to ~2 push cycles.
    private receiptWaitTimeoutMs = 60_000,
    // How often to poll `eth_getTransactionReceipt` while waiting.
    private receiptPollIntervalMs = 2000,
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
    } catch (error: any) {
      this.logger.error(
        error,
        "An unidentified error has occured when getting the update fee.",
      );
      throw error;
    }

    // Fetch a fresh gas price. With the eip1559 strategy this is sourced from
    // the chain base fee and priority fee (avoiding the deprecated eth_gasPrice
    // RPC); with the legacy strategy it falls back to the single gasPrice model
    // for chains that don't support eip1559 transactions.
    let gasPrice = await getGasPrice(
      this.client,
      this.gasPriceConfig,
      this.logger,
    );

    // Try to re-use the same nonce and increase the gas if the last tx is not landed yet.
    this.pusherAddress ??= this.client.account.address;

    const lastExecutedNonce =
      (await this.client.getTransactionCount({
        address: this.pusherAddress,
      })) - 1;

    let gasPriceToOverride = undefined;

    if (this.lastPushAttempt !== undefined) {
      if (this.lastPushAttempt.nonce <= lastExecutedNonce) {
        this.lastPushAttempt = undefined;
      } else {
        gasPriceToOverride = scaleGasPrice(
          this.lastPushAttempt.gasPrice,
          this.overrideGasPriceMultiplier,
        );
      }
    }

    if (gasPriceToOverride !== undefined) {
      // Bump every fee component to override the stuck transaction, capping the
      // bump relative to the fresh gas price returned by the RPC.
      gasPrice = escalateGasPrice(
        gasPrice,
        gasPriceToOverride,
        this.overrideGasPriceMultiplierCap,
      );
    }

    const txNonce = lastExecutedNonce + 1;

    this.logger.debug(
      `Using ${describeGasPrice(gasPrice)} and nonce: ${txNonce}`,
    );

    const pubTimesToPushParam = pubTimesToPush.map(BigInt);

    const priceIdsWith0x = priceIds.map((priceId) => addLeading0x(priceId));

    // Update lastAttempt
    this.lastPushAttempt = {
      gasPrice: gasPrice,
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
            ...gasPriceToTxParams(gasPrice),
            nonce: txNonce,
            value: updateFee,
          },
        );

      this.logger.debug({ request }, "Simulated request successfully");

      const hash = await this.client.writeContract(request);

      this.logger.debug({ hash }, "Price update sent");

      this.trackTransactionReceipt(hash, txNonce);
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
          this.logger.debug(
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
          errorChainIncludes(error, "replacement transaction underpriced")
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
          this.logger.debug(
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
          this.logger.warn(
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
          this.logger.debug(
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
          this.logger.debug(
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

  // Stop all in-flight receipt trackers (graceful shutdown / tests). Safe to
  // call at any time; leaves no pending poll behind.
  public dispose(): void {
    for (const controller of this.receiptTrackers) {
      controller.abort();
    }
    this.receiptTrackers.clear();
    this.trackedNonce = undefined;
  }

  // Start a receipt tracker for a freshly-sent tx. Fire-and-forget by design —
  // the receipt is observational (it only produces the "Price update successful"
  // log the Grafana Tx-Hash panel scrapes); the controller never blocks on it,
  // and the re-send/nonce/gas decision is driven by a fresh `getTransactionCount`
  // each cycle, not by the receipt.
  private trackTransactionReceipt(hash: `0x${string}`, nonce: number): void {
    // A new nonce means the previous nonce already resolved (a tx for it landed,
    // advancing the on-chain count), so abort the stragglers still polling the
    // old nonce's hashes. They each do one final lookup on abort, so the hash
    // that actually landed is still logged before they stop. Same-nonce
    // escalations fall through and ADD a tracker so every competing hash for the
    // live nonce stays watched.
    if (this.trackedNonce !== undefined && nonce !== this.trackedNonce) {
      for (const controller of this.receiptTrackers) {
        controller.abort();
      }
      this.receiptTrackers.clear();
    }
    this.trackedNonce = nonce;

    const controller = new AbortController();
    this.receiptTrackers.add(controller);
    void this.pollTransactionReceipt(hash, controller).finally(() => {
      this.receiptTrackers.delete(controller);
    });
  }

  // Poll `eth_getTransactionReceipt` (one call per interval) until the tx lands,
  // the tracker is superseded, or the deadline elapses. Unlike viem's
  // `waitForTransactionReceipt` this issues no `eth_getTransactionByHash` and no
  // per-block full-block fetch, and its teardown is guaranteed by the bound +
  // AbortController — so an un-landing tx cannot leak a poller.
  private async pollTransactionReceipt(
    hash: `0x${string}`,
    controller: AbortController,
  ): Promise<void> {
    const deadline = Date.now() + this.receiptWaitTimeoutMs;

    for (;;) {
      let receipt;
      try {
        receipt = await this.client.getTransactionReceipt({ hash });
      } catch {
        // viem throws TransactionReceiptNotFoundError while the tx is unmined.
        // Treat any lookup failure as "not landed yet" and keep polling.
        receipt = undefined;
      }

      // A fetched receipt means the tx actually landed — it is never stale, so
      // log it even if this tracker was superseded (otherwise the Grafana panel
      // would miss the hash of a tx that landed just as the next push started).
      if (receipt !== undefined) {
        if (receipt.status === "success") {
          // Keep one non-debug hash line per landed tx: the bundled Grafana
          // "Tx Hash" panel scrapes this message from Loki and extracts {{.hash}}.
          this.logger.info({ hash }, "Price update successful");
        } else {
          this.logger.debug(
            { hash, receipt },
            "Price update did not succeed or its transaction did not land. " +
              "This is an expected behaviour in high frequency or multi-instance setup.",
          );
        }
        return;
      }

      // Not landed yet: stop if this tracker was superseded, or if we ran out
      // of time (only these bounded paths end the loop, so it cannot leak).
      if (controller.signal.aborted) {
        return;
      }
      if (Date.now() >= deadline) {
        this.logger.debug(
          { hash },
          "Gave up waiting for the transaction receipt within the timeout. " +
            "This is expected when a tx does not land; the next push re-derives " +
            "the nonce from the chain and replaces it if needed.",
        );
        return;
      }

      await this.interruptibleSleep(
        this.receiptPollIntervalMs,
        controller.signal,
      );
    }
  }

  // Sleep that resolves early if the signal aborts, so a superseded tracker
  // stops promptly instead of waiting out its poll interval.
  private interruptibleSleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve();
        return;
      }
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      signal.addEventListener("abort", onAbort, { once: true });
    });
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
