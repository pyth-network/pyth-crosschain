/* biome-ignore-all lint/style/noNonNullAssertion: pre-existing; gas-pool code asserts on Sui RPC results */
/* biome-ignore-all lint/suspicious/noExplicitAny: pre-existing; untyped Sui RPC error/result shapes */
/* biome-ignore-all lint/complexity/noForEach: pre-existing */
/* biome-ignore-all lint/suspicious/useAwait: pre-existing */

import { ChannelCredentials } from "@grpc/grpc-js";
import type { ClientWithCoreApi, SuiClientTypes } from "@mysten/sui/client";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import type { SuiObjectRef } from "@mysten/sui/jsonRpc";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import type { HermesClient } from "@pythnetwork/hermes-client";
import { getStructFields, SuiPythClient } from "@pythnetwork/pyth-sui-js";
import type { Logger } from "pino";

import type { IPricePusher, PriceInfo, PriceItem } from "../interface.js";
import { ChainPriceListener } from "../interface.js";
import type { DurationInSeconds } from "../utils.js";

// The SUI coin type, used for address-balance withdrawals and deposits.
const SUI_COIN_TYPE = "0x2::sui::SUI";
// Gas budget for the one-time startup transaction that consolidates the wallet's
// Coin objects into its SIP-58 address balance. It doubles as the amount left
// behind in the gas coin to pay for that transaction; the small remainder stays
// as a residual coin and is swept into the address balance on the next startup.
const GAS_BUDGET_FOR_CONSOLIDATION = 100_000_000;
// TODO: read this from on chain config
const MAX_NUM_GAS_OBJECTS_IN_PTB = 256;

type ObjectId = string;
type SuiAddress = string;

/**
 * Sui transport selector. `json-rpc` is the legacy default; `grpc` migrates to
 * the transport Sui Foundation is replacing JSON-RPC with (public JSON-RPC
 * endpoints are turned off in July 2026, removed entirely by mid-Oct 2026).
 */
export type SuiEndpointType = "json-rpc" | "grpc";

/** Sui network label passed to the `@mysten/sui` v2 clients. */
export type SuiNetwork = "mainnet" | "testnet" | "devnet" | "localnet";

/** gRPC request metadata (e.g. `{ "x-token": "<secret>" }`) sent on every call. */
export type SuiGrpcMetadata = Record<string, string>;

/**
 * Turn a gRPC endpoint into a `@grpc/grpc-js` `host:port` plus channel
 * credentials. Third-party Sui gRPC endpoints (QuikNode `:9000`, Ankr /
 * BlockVision `:443`) serve **native gRPC over HTTP/2**, so the host must be
 * a bare `host:port` with no scheme or path. A `http://` prefix selects an
 * insecure channel (local devnet); anything else uses TLS.
 */
function parseGrpcEndpoint(url: string): {
  host: string;
  credentials: ChannelCredentials;
} {
  let host = url.trim();
  let insecure = false;
  if (host.startsWith("https://")) {
    host = host.slice("https://".length);
  } else if (host.startsWith("http://")) {
    host = host.slice("http://".length);
    insecure = true;
  }
  // Drop any path/token segment — native gRPC authenticates via metadata, not URL.
  host = host.replace(/\/.*$/, "");
  return {
    credentials: insecure
      ? ChannelCredentials.createInsecure()
      : ChannelCredentials.createSsl(),
    host,
  };
}

/**
 * Both the `@mysten/sui` v2 JSON-RPC client (`SuiJsonRpcClient`) and the
 * experimental gRPC client (`SuiGrpcClient`) expose the unified `.core` API.
 * The pusher reads and writes exclusively through `.core` so the same driver
 * works over either transport.
 *
 * `SuiGrpcClient` defaults to a grpc-web (HTTP/1.1) transport, which the Sui
 * providers' native-gRPC (HTTP/2) endpoints reject; it also drops the `meta`
 * option on that default path, so credentials never reach the wire. We
 * therefore build an explicit `@protobuf-ts/grpc-transport` (native gRPC over
 * `@grpc/grpc-js`) and pass the auth header through its `meta`.
 */
export function createSuiProvider(
  endpointType: SuiEndpointType,
  network: SuiNetwork,
  url: string,
  grpcMetadata?: SuiGrpcMetadata,
): ClientWithCoreApi {
  switch (endpointType) {
    case "grpc": {
      const { host, credentials } = parseGrpcEndpoint(url);
      const transport = new GrpcTransport({
        channelCredentials: credentials,
        host,
        ...(grpcMetadata && { meta: grpcMetadata }),
      });
      return new SuiGrpcClient({ network, transport });
    }
    case "json-rpc": {
      return new SuiJsonRpcClient({ network, url });
    }
    default: {
      throw new Error(`Unknown Sui endpoint type: ${endpointType as string}`);
    }
  }
}

/** Unwrap the executed transaction from the `.core` execution result union. */
function getExecutedTransaction(
  result: SuiClientTypes.TransactionResult<{ effects: true }>,
) {
  return result.$kind === "Transaction"
    ? result.Transaction
    : result.FailedTransaction;
}

/** Build an owned-object reference from a `.core` effects changed object. */
function changedObjectToRef(obj: SuiClientTypes.ChangedObject): SuiObjectRef {
  return {
    digest: obj.outputDigest!,
    objectId: obj.objectId,
    version: obj.outputVersion!,
  };
}

export class SuiPriceListener extends ChainPriceListener {
  private pythClient: SuiPythClient;
  private provider: ClientWithCoreApi;
  private logger: Logger;

  constructor(
    pythStateId: ObjectId,
    wormholeStateId: ObjectId,
    endpoint: string,
    endpointType: SuiEndpointType,
    network: SuiNetwork,
    priceItems: PriceItem[],
    logger: Logger,
    config: {
      pollingFrequency: DurationInSeconds;
    },
    grpcMetadata?: SuiGrpcMetadata,
  ) {
    super(config.pollingFrequency, priceItems);
    this.provider = createSuiProvider(
      endpointType,
      network,
      endpoint,
      grpcMetadata,
    );
    this.pythClient = new SuiPythClient(
      this.provider,
      pythStateId,
      wormholeStateId,
    );
    this.logger = logger;
  }

  async getOnChainPriceInfo(priceId: string): Promise<PriceInfo | undefined> {
    try {
      const priceInfoObjectId =
        await this.pythClient.getPriceFeedObjectId(priceId);
      if (priceInfoObjectId === undefined) {
        throw new Error("Price not found on chain for price id " + priceId);
      }

      // Fetching the price info object for the above priceInfoObjectId
      const { object } = await this.provider.core.getObject({
        include: { json: true },
        objectId: priceInfoObjectId,
      });

      if (!object.json)
        throw new Error("Price not found on chain for price id " + priceId);

      // PriceInfoObject -> price_info -> price_feed -> price (the `Price` struct,
      // holding the signed `price` magnitude, `conf`, and `timestamp`).
      const priceFields = getStructFields(
        getStructFields(getStructFields(object.json.price_info).price_feed)
          .price,
      );
      const magnitudeFields = getStructFields(priceFields.price);
      const magnitude = magnitudeFields.magnitude as string;
      const negative = magnitudeFields.negative;

      return {
        conf: priceFields.conf as string,
        price: negative ? `-${magnitude}` : magnitude,
        publishTime: Number(priceFields.timestamp),
      };
    } catch (error) {
      this.logger.error(
        error,
        `Polling Sui on-chain price for ${priceId} failed.`,
      );
      return undefined;
    }
  }
}

/**
 * The `SuiPricePusher` is designed for high-throughput of price updates.
 * Achieving this property requires sacrificing some nice-to-have features of other
 * pusher implementations that can reduce cost when running multiple pushers. It also requires
 * jumping through some Sui-specific hoops in order to maximize parallelism.
 *
 * The two main design features are:
 * 1. This implementation does not use `update_price_feeds_if_necssary` and simulate the transaction
 *    before submission. If multiple instances of this pusher are running in parallel, all of them will
 *    land all of their pushed updates on-chain.
 * 2. The pusher pays both transaction gas and the per-update fee directly from the account's SIP-58
 *    address balance instead of from owned Coin objects. Address-balance withdrawals settle through the
 *    accumulator with no per-object locking, so many pushes execute in parallel without contending on a
 *    shared gas coin. On startup all pre-existing Coin objects are consolidated into the address balance.
 */
export class SuiPricePusher implements IPricePusher {
  constructor(
    private readonly signer: Ed25519Keypair,
    private readonly provider: ClientWithCoreApi,
    private logger: Logger,
    private hermesClient: HermesClient,
    private gasBudget: number,
    private pythClient: SuiPythClient,
  ) {}

  /**
   * Create a price pusher that pays gas from the account's SIP-58 address balance.
   * On startup every Coin object owned by the provided keypair is consolidated into
   * that address balance so subsequent pushes can draw gas from it in parallel.
   * `ignoreGasObjects` lists coins to leave untouched during consolidation (e.g. locked objects).
   */
  static async createWithAddressBalanceGas(
    hermesClient: HermesClient,
    logger: Logger,
    pythStateId: string,
    wormholeStateId: string,
    endpoint: string,
    endpointType: SuiEndpointType,
    network: SuiNetwork,
    keypair: Ed25519Keypair,
    gasBudget: number,
    ignoreGasObjects: string[],
    grpcMetadata?: SuiGrpcMetadata,
  ): Promise<SuiPricePusher> {
    const provider = createSuiProvider(
      endpointType,
      network,
      endpoint,
      grpcMetadata,
    );

    await SuiPricePusher.consolidateCoinsIntoAddressBalance(
      keypair,
      provider,
      ignoreGasObjects,
      logger,
    );

    const pythClient = new SuiPythClient(
      provider,
      pythStateId,
      wormholeStateId,
    );

    return new SuiPricePusher(
      keypair,
      provider,
      logger,
      hermesClient,
      gasBudget,
      pythClient,
    );
  }

  async updatePriceFeed(
    priceIds: string[],
    pubTimesToPush: number[],
  ): Promise<void> {
    if (priceIds.length === 0) {
      return;
    }

    if (priceIds.length !== pubTimesToPush.length)
      throw new Error("Invalid arguments");

    // 3 price feeds per transaction is the optimal number for gas cost.
    const priceIdChunks = chunkArray(priceIds, 3);

    const baseUpdateFee = await this.pythClient.getBaseUpdateFee();

    const txBlocks: Transaction[] = [];

    await Promise.all(
      priceIdChunks.map(async (priceIdChunk) => {
        const response = await this.hermesClient.getLatestPriceUpdates(
          priceIdChunk,
          {
            encoding: "base64",
            ignoreInvalidPriceIds: true,
          },
        );
        if (response.binary.data.length !== 1) {
          throw new Error(
            `Expected a single VAA for all priceIds ${priceIdChunk} but received ${response.binary.data.length} VAAs: ${response.binary.data}`,
          );
        }
        const vaa = response.binary.data[0];
        const tx = new Transaction();
        // Draw the per-update fee from the SIP-58 address balance rather than
        // from the gas coin (there is none — gas is paid from the address
        // balance too). `useGasCoin: false` forces the withdrawal path.
        const feeCoin = tx.coin({
          balance: baseUpdateFee * priceIdChunk.length,
          useGasCoin: false,
        });
        const feeCoins = tx.splitCoins(
          feeCoin,
          priceIdChunk.map(() => tx.pure.u64(baseUpdateFee)),
        );
        await this.pythClient.updatePriceFeedsWithCoins(
          tx,
          [Buffer.from(vaa ?? "", "base64")],
          priceIdChunk,
          feeCoins,
        );
        // The fee coin is emptied by the splits above; destroy the zero remainder
        // so the PTB has no dangling value.
        tx.moveCall({
          arguments: [feeCoin],
          target: "0x2::coin::destroy_zero",
          typeArguments: [SUI_COIN_TYPE],
        });
        txBlocks.push(tx);
      }),
    );

    await this.sendTransactionBlocks(txBlocks);
  }

  /** Send every transaction in txs in parallel, returning when all transactions have completed. */
  private async sendTransactionBlocks(txs: Transaction[]) {
    return Promise.all(txs.map((tx) => this.sendTransactionBlock(tx)));
  }

  /** Send a single transaction block, paying gas from the SIP-58 address balance. */
  private async sendTransactionBlock(tx: Transaction): Promise<void> {
    // An empty gas payment tells the network to withdraw gas from the sender's
    // address balance (SIP-58) instead of an owned gas coin.
    tx.setGasPayment([]);
    tx.setGasBudget(this.gasBudget);
    try {
      const result = await this.provider.core.signAndExecuteTransaction({
        include: { effects: true },
        signer: this.signer,
        transaction: tx,
      });
      const executed = getExecutedTransaction(result);

      // The `.core` API returns a `FailedTransaction` for on-chain execution
      // failures rather than throwing, so check the status explicitly — otherwise
      // a failed push would emit the success log below and silently miss updates.
      if (executed.effects.status.error) {
        throw new Error(
          `Transaction ${executed.digest} failed on-chain: ${JSON.stringify(
            executed.effects.status.error,
          )}`,
        );
      }

      // Keep at INFO: the bundled Grafana "Tx Hash" panel scrapes this message
      // from Loki and extracts {{.hash}}; debug is not emitted under the default
      // log level, which would hide successful Sui hashes from the dashboard.
      this.logger.debug(
        { hash: executed.digest },
        "Successfully updated price with transaction digest",
      );
    } catch (error: any) {
      if (
        String(error).includes("Balance of gas object") ||
        String(error).includes("GasBalanceTooLow") ||
        String(error).includes("InsufficientBalanceForWithdraw")
      ) {
        this.logger.error(error, "Insufficient gas balance");
        // If the error is caused by insufficient gas, we should panic
        throw error;
      } else {
        this.logger.error(error, "Failed to update price.");
      }
    }
  }

  // Smash every Coin object owned by the signer into one and deposit it into the
  // signer's own SIP-58 address balance, leaving only a small residual coin to pay
  // for this transaction. Subsequent pushes then draw gas from the address balance.
  // ignoreGasObjects is a list of coins to leave untouched (e.g. locked objects).
  private static async consolidateCoinsIntoAddressBalance(
    signer: Ed25519Keypair,
    provider: ClientWithCoreApi,
    ignoreGasObjects: string[],
    logger: Logger,
  ): Promise<void> {
    const signerAddress = signer.toSuiAddress();

    if (ignoreGasObjects.length > 0) {
      logger.info(
        { ignoreGasObjects },
        "Ignoring some gas objects for coin merging",
      );
    }

    const gasCoins = await SuiPricePusher.getAllGasCoins(
      provider,
      signerAddress,
    );
    const coinsToConsolidate = gasCoins.filter(
      (coin) => !ignoreGasObjects.includes(coin.objectId),
    );
    if (coinsToConsolidate.length === 0) {
      logger.info(
        "No coins to consolidate; gas will be paid from the address balance.",
      );
      return;
    }

    const consolidatedCoin = await SuiPricePusher.mergeGasCoinsIntoOne(
      signer,
      provider,
      signerAddress,
      ignoreGasObjects,
      logger,
    );
    const { object } = await provider.core.getObject({
      include: { json: true },
      objectId: consolidatedCoin.objectId,
    });
    if (!object.json) throw new Error("Bad coin object");
    const balance = BigInt(object.json.balance as string);
    const depositAmount = balance - BigInt(GAS_BUDGET_FOR_CONSOLIDATION);
    if (depositAmount <= 0n) {
      logger.warn(
        { balance: balance.toString() },
        "Consolidated coin balance too low to seed the address balance; leaving it as an owned coin.",
      );
      return;
    }

    const tx = new Transaction();
    tx.setGasPayment([consolidatedCoin]);
    tx.setGasBudget(GAS_BUDGET_FOR_CONSOLIDATION);
    const [deposit] = tx.splitCoins(tx.gas, [tx.pure.u64(depositAmount)]);
    tx.moveCall({
      arguments: [deposit!, tx.pure.address(signerAddress)],
      target: "0x2::coin::send_funds",
      typeArguments: [SUI_COIN_TYPE],
    });
    const executed = getExecutedTransaction(
      await provider.core.signAndExecuteTransaction({
        include: { effects: true },
        signer,
        transaction: tx,
      }),
    );
    if (executed.effects.status.error) {
      throw new Error(
        `Failed to deposit coins into the address balance: ${JSON.stringify(executed.effects.status.error)}. Try re-running the script`,
      );
    }
    // Block until the deposit is settled before the pusher starts drawing gas
    // from the address balance (gRPC endpoints are load-balanced across
    // fullnodes at different checkpoints).
    await provider.core.waitForTransaction({ digest: executed.digest });
    logger.info(
      { depositAmount: depositAmount.toString(), digest: executed.digest },
      "Consolidated coins into the address balance",
    );
  }

  private static async getAllGasCoins(
    provider: ClientWithCoreApi,
    owner: SuiAddress,
  ): Promise<SuiObjectRef[]> {
    let hasNextPage = true;
    let cursor: string | null = null;
    const coins = new Set<string>([]);
    let numCoins = 0;
    while (hasNextPage) {
      const paginatedCoins = await provider.core.listCoins({
        cursor,
        owner,
      });
      numCoins += paginatedCoins.objects.length;
      for (const c of paginatedCoins.objects)
        coins.add(
          JSON.stringify({
            digest: c.digest,
            objectId: c.objectId,
            version: c.version,
          }),
        );
      hasNextPage = paginatedCoins.hasNextPage;
      cursor = paginatedCoins.cursor;
    }

    if (numCoins !== coins.size) {
      throw new Error("Unexpected listCoins result: duplicate coins found");
    }
    return [...coins].map((item) => JSON.parse(item));
  }

  private static async mergeGasCoinsIntoOne(
    signer: Ed25519Keypair,
    provider: ClientWithCoreApi,
    owner: SuiAddress,
    initialLockedAddresses: string[],
    logger: Logger,
  ): Promise<SuiObjectRef> {
    const gasCoins = await SuiPricePusher.getAllGasCoins(provider, owner);
    // skip merging if there is only one coin
    if (gasCoins.length === 1) {
      return gasCoins[0]!;
    }

    const gasCoinsChunks = chunkArray<SuiObjectRef>(
      gasCoins,
      MAX_NUM_GAS_OBJECTS_IN_PTB - 2,
    );
    let finalCoin: SuiObjectRef | undefined;
    const lockedAddresses = new Set<string>();
    for (const value of initialLockedAddresses) lockedAddresses.add(value);
    for (let i = 0; i < gasCoinsChunks.length; i++) {
      const mergeTx = new Transaction();
      let coins = gasCoinsChunks[i];
      coins =
        coins?.filter((coin) => !lockedAddresses.has(coin.objectId)) ?? [];
      if (finalCoin) {
        coins = [finalCoin, ...coins];
      }
      mergeTx.setGasPayment(coins);
      let mergeResult;
      try {
        mergeResult = await provider.core.signAndExecuteTransaction({
          include: { effects: true },
          signer,
          transaction: mergeTx,
        });
      } catch (error_) {
        logger.error(error_, "Merge transaction failed with error");

        if (
          String(error_).includes(
            "quorum of validators because of locked objects. Retried a conflicting transaction",
          )
        ) {
          // eslint-disable-next-line unicorn/no-array-for-each
          Object.values((error_ as any).data).forEach((lockedObjects: any) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, unicorn/no-array-for-each
            lockedObjects.forEach((lockedObject: [string, number, string]) => {
              lockedAddresses.add(lockedObject[0]);
            });
          });
          // retry merging without the locked coins
          i--;
          continue;
        }
        throw error_;
      }
      const executed = getExecutedTransaction(mergeResult);
      const effects = executed.effects;
      if (effects.status.error) {
        throw new Error(
          `Failed to merge coins when initializing gas pool: ${JSON.stringify(effects.status.error)}. Try re-running the script`,
        );
      }
      finalCoin = changedObjectToRef(effects.gasObject!);
      // Block until this merge is observable before the next transaction spends
      // its output (the next chunk's gas, or the subsequent split). gRPC
      // endpoints are load-balanced across fullnodes at different checkpoints,
      // so without this the follow-up tx can be simulated against a backend
      // that has not yet applied this merge and fail with a version conflict.
      // The legacy JSON-RPC path got this for free via WaitForLocalExecution.
      await provider.core.waitForTransaction({ digest: executed.digest });
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return finalCoin!;
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunked = [];
  let index = 0;
  while (index < array.length) {
    chunked.push(array.slice(index, size + index));
    index += size;
  }
  return chunked;
}
